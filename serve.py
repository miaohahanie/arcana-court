# -*- coding: utf-8 -*-
"""
奥术之庭 · 本地卷轴库服务器
用法：  python serve.py        （默认 8291 端口）

在静态服务之上提供：
  GET  /api/health   -> {"api": true}   编辑器据此判断"上传模式"
  POST /api/publish  -> 把文章写入 posts.user.json（数据源）
                        并同步生成 posts.user.js（页面读取）
静态模式（如直接双击 index.html 或用其它静态服务器）下，
文章会退化为存入浏览器 localStorage，并可在编辑器里下载备份。
"""
import json
import os
import socketserver
import http.server

PORT = 8291
ROOT = os.path.dirname(os.path.abspath(__file__))
USER_JSON = os.path.join(ROOT, 'posts.user.json')
USER_JS = os.path.join(ROOT, 'posts.user.js')

# 管理员咒语：可在同目录 admin.json 里写 {"key": "你的咒语"} 覆盖
ADMIN_KEY = 'abracadabra'
_ADMIN_FILE = os.path.join(ROOT, 'admin.json')
if os.path.exists(_ADMIN_FILE):
    try:
        with open(_ADMIN_FILE, encoding='utf-8') as f:
            ADMIN_KEY = json.load(f).get('key', ADMIN_KEY)
    except Exception:
        pass


def load_user_posts():
    if not os.path.exists(USER_JSON):
        return []
    try:
        with open(USER_JSON, encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_user_posts(posts):
    with open(USER_JSON, 'w', encoding='utf-8') as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    with open(USER_JS, 'w', encoding='utf-8') as f:
        f.write('// 由铭刻室自动生成 —— 手写卷轴仍在 posts.js\nwindow.__USER_POSTS = ')
        f.write(json.dumps(posts, ensure_ascii=False, indent=2))
        f.write(';\n')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # 本地开发：永不缓存，改完即刷新
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/health':
            return self._json({'api': True})
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/auth':
            # 验证管理员咒语（不透露任何其它信息）
            try:
                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length).decode('utf-8'))
            except Exception:
                return self._json({'ok': False}, 400)
            return self._json({'ok': data.get('key') == ADMIN_KEY})
        if self.path != '/api/publish':
            return self._json({'ok': False, 'error': 'unknown endpoint'}, 404)
        if self.headers.get('X-Arcana-Key', '') != ADMIN_KEY:
            # 没有咒语，法阵不开
            return self._json({'ok': False, 'error': 'forbidden'}, 403)
        try:
            length = int(self.headers.get('Content-Length', 0))
            post = json.loads(self.rfile.read(length).decode('utf-8'))
            if not post.get('slug') or not post.get('title'):
                raise ValueError('缺少 slug 或 title')
        except Exception as err:
            return self._json({'ok': False, 'error': str(err)}, 400)

        posts = [p for p in load_user_posts() if p.get('slug') != post['slug']]
        posts.insert(0, post)
        save_user_posts(posts)
        self._json({'ok': True, 'slug': post['slug'], 'total': len(posts)})

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    if not os.path.exists(USER_JSON):
        save_user_posts([])
    with Server(('127.0.0.1', PORT), Handler) as httpd:
        print(f'奥术之庭已开启 · http://localhost:{PORT}  （Ctrl-C 合上法阵）')
        httpd.serve_forever()
