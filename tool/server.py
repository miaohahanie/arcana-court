# -*- coding: utf-8 -*-
"""
铭刻室桌面版 · 本地服务
双击 exe 后：提供本地界面与 API，发布时直接写盘并 git 推流。
若 pywebview 可用则开原生窗口，否则自动打开默认浏览器。
"""
import base64
import json
import os
import socket
import subprocess
import sys
import time
import webbrowser

from flask import Flask, jsonify, request, send_from_directory

APP_NAME = 'ArcanaScribe'
BASE_PORT = 8517
ALLOWED_IMG = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
MAX_IMG = 10 * 1024 * 1024

# ---------- 路径 ----------

def exe_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def ui_dir():
    base = getattr(sys, '_MEIPASS', None)
    if base and os.path.exists(os.path.join(base, 'ui')):
        return os.path.join(base, 'ui')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')


def appdata_dir():
    base = os.environ.get('APPDATA') or os.path.expanduser('~')
    d = os.path.join(base, APP_NAME)
    os.makedirs(d, exist_ok=True)
    return d


SETTINGS_PATH = os.path.join(appdata_dir(), 'settings.json')
DRAFTS_PATH = os.path.join(appdata_dir(), 'drafts.json')
ARCHIVE_DIR = os.path.join(appdata_dir(), 'archive')

DEFAULT_SETTINGS = {
    'project_dir': '',
    'branch': 'main',
    'ssh_key': os.path.join(os.path.expanduser('~'), '.ssh', 'arcana-court'),
    'auto_push': True,
    'repo': 'miaohahanie/arcana-court',
}


def load_json(path, fallback):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return fallback


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_settings():
    s = dict(DEFAULT_SETTINGS)
    s.update(load_json(SETTINGS_PATH, {}))
    return s


def save_settings(s):
    save_json(SETTINGS_PATH, s)


def project_dir():
    s = load_settings()
    pd = s.get('project_dir')
    if pd and (os.path.exists(os.path.join(pd, 'posts.user.json')) or os.path.exists(os.path.join(pd, 'posts.js'))):
        return pd
    d = exe_dir()
    for _ in range(4):
        if os.path.exists(os.path.join(d, 'posts.user.json')) or os.path.exists(os.path.join(d, 'posts.js')):
            save_settings({**s, 'project_dir': d})
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return d


def user_json_path():
    return os.path.join(project_dir(), 'posts.user.json')


def user_js_path():
    return os.path.join(project_dir(), 'posts.user.js')


# ---------- git ----------

def git(args, timeout=240):
    proj = project_dir()
    r = subprocess.run(
        ['git', '-C', proj] + args,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=timeout,
    )
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or 'git 失败').strip())
    return r


def ensure_identity():
    r = subprocess.run(['git', '-C', project_dir(), 'config', 'user.email'],
                       capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        git(['config', 'user.name', 'miaohahanie'])
        git(['config', 'user.email', 'miaohahanie@users.noreply.github.com'])


def do_push(message):
    settings = load_settings()
    ensure_identity()
    git(['add', '-A'])
    c = git(['commit', '-m', message])
    if 'nothing to commit' in (c.stdout + c.stderr):
        return {'committed': False}
    key = os.path.expanduser(settings.get('ssh_key') or '')
    push_args = ['push', 'origin', settings.get('branch') or 'main']
    if key and os.path.exists(key):
        git(['-c', 'core.sshCommand=ssh -i "%s" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' % key] + push_args, timeout=300)
    else:
        git(push_args, timeout=300)
    return {'committed': True}


# ---------- 文章数据 ----------

def read_user_posts():
    return load_json(user_json_path(), [])


def write_user_posts(posts):
    save_json(user_json_path(), posts)
    with open(user_js_path(), 'w', encoding='utf-8') as f:
        f.write('// 由铭刻室桌面版维护 —— posts.js 已冻结为创世存档\nwindow.__USER_POSTS = ')
        f.write(json.dumps(posts, ensure_ascii=False, indent=2))
        f.write(';\n')


# ---------- Flask ----------

app = Flask(__name__, static_folder=None)


@app.get('/')
def index():
    return send_from_directory(ui_dir(), 'index.html')


@app.get('/<path:fname>')
def assets(fname):
    return send_from_directory(ui_dir(), fname)


@app.get('/api/state')
def api_state():
    s = load_settings()
    return jsonify({
        'settings': {**s, 'ssh_key': s.get('ssh_key', '')},
        'project_dir': project_dir(),
        'posts': read_user_posts(),
        'drafts': load_json(DRAFTS_PATH, []),
        'projectFound': bool(project_dir()),
    })


@app.post('/api/save_draft')
def api_save_draft():
    drafts = load_json(DRAFTS_PATH, [])
    draft = request.get_json(force=True)
    key = draft.get('key')
    if not key:
        return jsonify({'error': 'draft key missing'}), 400
    drafts = [d for d in drafts if d.get('key') != key]
    drafts.insert(0, draft)
    save_json(DRAFTS_PATH, drafts[:40])
    return jsonify({'ok': True})


@app.post('/api/delete_draft')
def api_delete_draft():
    key = (request.get_json(force=True) or {}).get('key')
    drafts = [d for d in load_json(DRAFTS_PATH, []) if d.get('key') != key]
    save_json(DRAFTS_PATH, drafts)
    return jsonify({'ok': True})


@app.post('/api/publish')
def api_publish():
    body = request.get_json(force=True)
    post = body.get('post') or {}
    push = bool(body.get('push', load_settings().get('auto_push', True)))
    if not post.get('slug') or not post.get('title'):
        return jsonify({'error': '缺少 slug 或标题', 'stage': 'write'}), 400
    if not project_dir():
        return jsonify({'error': '未找到博客目录，请先在设置中选择', 'stage': 'write'}), 400
    posts = [p for p in read_user_posts() if p.get('slug') != post['slug']]
    post = {**post, 'origin': 'user'}
    post.pop('deleted', None)
    posts.insert(0, post)
    try:
        write_user_posts(posts)
    except Exception as err:
        return jsonify({'error': str(err), 'stage': 'write'}), 500
    if not push:
        return jsonify({'ok': True, 'pushed': False})
    try:
        result = do_push('✍️ ' + ('更新文章' if body.get('isUpdate') else '发布文章') + '《%s》' % post['title'])
        return jsonify({'ok': True, 'pushed': True, **result})
    except Exception as err:
        return jsonify({'error': str(err), 'stage': 'push'}), 200


@app.post('/api/remove')
def api_remove():
    body = request.get_json(force=True)
    slug = body.get('slug')
    if not slug:
        return jsonify({'error': '缺少 slug'}), 400
    posts = read_user_posts()
    target = next((p for p in posts if p.get('slug') == slug and not p.get('deleted')), None)
    if target is None:
        return jsonify({'error': '未找到该文章（或已下线）'}), 400
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    save_json(os.path.join(ARCHIVE_DIR, slug + '.json'), target)  # 本地存档，可恢复
    posts = [p for p in posts if p.get('slug') != slug]
    posts.insert(0, {**target, 'deleted': True})
    write_user_posts(posts)
    out = {'ok': True}
    if body.get('push', True):
        try:
            do_push('🗑 下线文章《%s》' % target.get('title', slug))
            out['pushed'] = True
        except Exception as err:
            out['pushed'] = False
            out['error'] = str(err)
    return jsonify(out)


@app.post('/api/restore')
def api_restore():
    body = request.get_json(force=True)
    slug = body.get('slug')
    archive = load_json(os.path.join(ARCHIVE_DIR, slug + '.json'), None)
    if not archive:
        return jsonify({'error': '本地存档不存在'}), 404
    posts = [p for p in read_user_posts() if p.get('slug') != slug]
    archive.pop('deleted', None)
    posts.insert(0, archive)
    write_user_posts(posts)
    out = {'ok': True}
    try:
        do_push('♻️ 恢复文章《%s》' % archive.get('title', slug))
        out['pushed'] = True
    except Exception as err:
        out['pushed'] = False
        out['error'] = str(err)
    return jsonify(out)


@app.post('/api/save_image')
def api_save_image():
    body = request.get_json(force=True)
    filename = body.get('filename') or 'img.png'
    slug = body.get('slug') or 'img'
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMG:
        return jsonify({'error': '仅支持 png/jpg/webp/gif'}), 400
    try:
        data = base64.b64decode(body.get('data') or '')
    except Exception:
        return jsonify({'error': '图片数据无效'}), 400
    if len(data) > MAX_IMG:
        return jsonify({'error': '图片超过 10MB'}), 400
    folder = os.path.join(project_dir(), 'images')
    os.makedirs(folder, exist_ok=True)
    name = '%s-%d%s' % (slug or 'img', int(time.time() * 1000) % 100000000, ext)
    with open(os.path.join(folder, name), 'wb') as f:
        f.write(data)
    return jsonify({'ok': True, 'path': 'images/' + name})


@app.get('/api/settings')
def api_settings_get():
    return jsonify(load_settings())


@app.post('/api/settings')
def api_settings_post():
    s = request.get_json(force=True)
    merged = {**load_settings(), **s}
    save_settings(merged)
    return jsonify({'ok': True, 'settings': merged})


def find_free_port():
    for p in range(BASE_PORT, BASE_PORT + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    return BASE_PORT


def run_server(port):
    app.run(host='127.0.0.1', port=port, threaded=True, use_reloader=False)


def main():
    port = find_free_port()
    url = f'http://127.0.0.1:{port}'
    threading.Thread(target=run_server, args=(port,), daemon=True).start()
    time.sleep(0.8)

    use_browser = '--browser' in sys.argv
    if not use_browser:
        try:
            import webview  # noqa
            webview.create_window('铭刻室 · ARCANA COURT', url, width=1320, height=880)
            webview.start()
            return
        except Exception as err:
            print('pywebview 不可用（%s），改用浏览器模式' % err)
    webbrowser.open(url)
    print('铭刻室已开启：' + url)
    while True:
        time.sleep(3600)


if __name__ == '__main__':
    main()
