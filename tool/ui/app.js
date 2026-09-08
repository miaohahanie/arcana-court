/* 铭刻室桌面版 · 前端逻辑 */
const $ = (s) => document.querySelector(s);
const GLYPHS = ['✦', '❋', '☾', '⚜', '⟡', '✧', '☉', '❖', '✵', '❈'];
const BLOG_URL = 'https://miaohahanie.github.io/arcana-court/';

const STATE = { posts: [], drafts: [], settings: {}, projectDir: '', projectFound: false };
let EDIT = null; // 当前编辑对象

/* ---------- 基础 ---------- */
async function api(path, body) {
  const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  const r = await fetch('/api/' + path, opt);
  let j;
  try { j = await r.json(); } catch { throw new Error('HTTP ' + r.status); }
  if (!r.ok && j.error === undefined) throw new Error('HTTP ' + r.status);
  return j;
}
let toastTimer = null;
function toast(msg, warn = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('warn', warn);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function moonPhaseName(iso) {
  if (!iso) return '';
  const synodic = 29.53058867;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (Date.parse(iso + 'T00:00:00Z') - ref) / 86400000;
  if (isNaN(days)) return '';
  const age = ((days % synodic) + synodic) % synodic;
  const table = [[1.85, '新月'], [5.54, '娥眉月'], [9.23, '上弦月'], [12.91, '盈凸月'], [16.61, '满月'], [20.30, '亏凸月'], [23.99, '下弦月'], [27.68, '残月']];
  for (const [lim, name] of table) if (age < lim) return name;
  return '新月';
}
function moonLabel(iso) {
  const [y, m, d] = iso.split('-');
  return moonPhaseName(iso) + ' · ' + `${y}.${m}.${d}`;
}
function autoSlug(title, sortDate) {
  let s = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s) s = 'scroll-' + sortDate.replace(/-/g, '');
  return s;
}
function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [], quote = [], list = false, code = null;
  const inline = (s) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; } };
  const flushList = () => { if (list) { out.push('</ul>'); list = false; } };
  const flushAll = () => { flushPara(); flushQuote(); flushList(); };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      if (code) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; }
      else { flushAll(); code = []; }
      continue;
    }
    if (code) { code.push(raw); continue; }
    if (/^##\s+/.test(line)) { flushAll(); out.push('<h2>' + inline(line.replace(/^##\s+/, '')) + '</h2>'); continue; }
    if (/^---+\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
    if (/^>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); flushQuote(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>'); continue; }
    if (!line.trim()) { flushAll(); continue; }
    flushQuote(); flushList(); para.push(line.trim());
  }
  if (code) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
  flushAll();
  return out.join('\n') || '<p class="pv-empty">—— 显影等待咒文 ——</p>';
}

/* ---------- 待推送队列（断网兜底，存本浏览器） ---------- */
function pendingGet() { try { return JSON.parse(localStorage.getItem('scribe_pending') || '{}'); } catch { return {}; } }
function pendingSet(q) { localStorage.setItem('scribe_pending', JSON.stringify(q)); }

/* ---------- 视图 ---------- */
function showView(name) {
  for (const v of ['list', 'editor', 'settings']) $('#view' + v[0].toUpperCase() + v.slice(1)).hidden = v !== name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  if (t.dataset.view === 'list') renderList();
  if (t.dataset.view === 'settings') renderSettings();
  showView(t.dataset.view);
}));

/* ---------- 列表 ---------- */
async function refreshState() {
  const s = await api('state');
  Object.assign(STATE, s);
  renderList();
}

function renderList() {
  const posts = STATE.posts.filter((p) => p.slug);
  const online = posts.filter((p) => !p.deleted).sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
  const offline = posts.filter((p) => p.deleted);
  const pending = pendingGet();
  const pendCount = Object.keys(pending).length;

  $('#projName').textContent = STATE.projectDir || '⚠ 未找到博客目录';
  $('#projName').title = STATE.projectDir || '';
  $('#listStats').textContent = `共 ${online.length} 卷在线 · ${offline.length} 卷已下线` + (pendCount ? ` · ${pendCount} 篇待推送` : '');
  $('#btnRetry').hidden = pendCount === 0;
  $('#btnRetry').textContent = `⟳ 补推待推送（${pendCount}）`;

  const row = (p, off) => {
    const isPending = !!pending[p.slug];
    const chip = off
      ? '<span class="chip off">已下线</span>'
      : isPending
        ? '<span class="chip pending">待推送</span>'
        : '<span class="chip ok">在线</span>';
    const acts = off
      ? `<button class="ghost mini" data-act="restore" data-slug="${esc(p.slug)}">恢复上线</button>`
      : `<button class="ghost mini" data-act="edit" data-slug="${esc(p.slug)}">编辑</button>
         <button class="ghost mini" data-act="view" data-slug="${esc(p.slug)}">查看</button>
         <button class="ghost mini" data-act="remove" data-slug="${esc(p.slug)}">下线</button>`;
    return `<div class="prow${off ? ' off' : ''}">
      <span class="glyph">${p.glyph || '✦'}</span>
      <div class="main">
        <div class="t">${esc(p.title || p.slug)}</div>
        <div class="m">${esc(p.tag || '')} · ${esc(p.date || '')} · ${esc(p.time || '')}${isPending ? ' · 推送失败待重试' : ''}</div>
      </div>
      ${chip}
      <div class="acts">${acts}</div>
    </div>`;
  };

  $('#postList').innerHTML =
    online.map((p) => row(p, false)).join('') +
    (offline.length ? '<p class="kicker" style="margin:20px 0 10px">已下线 · 可恢复</p>' + offline.map((p) => row(p, true)).join('') : '');

  $('#postList').querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', () => rowAction(b.dataset.act, b.dataset.slug));
  });
}

async function rowAction(act, slug) {
  const post = STATE.posts.find((p) => p.slug === slug);
  if (act === 'edit') return openEditor(slug);
  if (act === 'view') return window.open(BLOG_URL + '#/post/' + slug);
  if (act === 'remove') {
    if (!confirm('下线《' + (post?.title || slug) + '》？线上将消失，本地保留存档，可随时恢复。')) return;
    const r = await api('remove', { slug });
    toast(r.pushed ? '已下线并推送' : '已下线（本地）· 推送失败可稍后补推', !r.pushed);
  }
  if (act === 'restore') {
    const r = await api('restore', { slug });
    toast(r.pushed ? '已恢复上线' : '已本地恢复 · 推送失败可稍后补推', !r.pushed);
  }
  await refreshState();
}

$('#btnRetry').addEventListener('click', async () => {
  const q = pendingGet();
  const slugs = Object.keys(q);
  let okN = 0;
  for (const slug of slugs) {
    try {
      const r = await api('publish', { post: q[slug], push: true });
      if (r.ok) { delete q[slug]; okN++; }
    } catch (e) { /* 网络仍不通则停下 */ toast('推送中断：' + e.message, true); break; }
  }
  pendingSet(q);
  toast(`补推完成：成功 ${okN}/${slugs.length}`);
  await refreshState();
});

$('#btnNew').addEventListener('click', () => openEditor(null));
$('#btnOpenBlog').addEventListener('click', () => window.open(BLOG_URL));

/* ---------- 编辑器 ---------- */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openEditor(slug) {
  const found = slug ? STATE.posts.find((p) => p.slug === slug) : null;
  const draft = slug ? STATE.drafts.find((d) => d.slug === slug) : null;
  EDIT = found
    ? { key: 'p-' + found.slug, slug: found.slug, title: found.title, tag: found.tag, date: found.sortDate || todayIso(), glyph: found.glyph || '✦', excerpt: found.excerpt || '', body: found.body ? found.body.replace(/<h2>/g, '\n## ').replace(/<blockquote>/g, '\n> ').replace(/<\/blockquote>/g, '').replace(/<li>/g, '\n- ').replace(/<[^>]+>/g, (m) => (m.startsWith('</') || m === '<hr>' ? '' : m)).trim() : '' }
    : (draft || { key: 'new-' + Date.now(), slug: '', title: '', tag: '', date: todayIso(), glyph: '✦', excerpt: '', body: '' });
  EDIT.isUpdate = !!found;

  $('#fTitle').value = EDIT.title || '';
  $('#fTag').value = EDIT.tag || '';
  $('#fDate').value = EDIT.date || todayIso();
  $('#fGlyph').innerHTML = GLYPHS.map((g) => `<option${(EDIT.glyph || '✦') === g ? ' selected' : ''}>${g}</option>`).join('');
  $('#fSlug').value = EDIT.slug || '';
  $('#fExcerpt').value = EDIT.excerpt || '';
  $('#fBody').value = EDIT.body || '';

  const tags = [...new Set(STATE.posts.filter((p) => !p.deleted).map((p) => p.tag).filter(Boolean))];
  $('#tagOptions').innerHTML = tags.map((t) => `<option value="${esc(t)}">`).join('');

  updatePreview();
  showView('editor');
}

function collectForm() {
  return {
    key: EDIT.key,
    slug: $('#fSlug').value.trim(),
    title: $('#fTitle').value.trim(),
    tag: $('#fTag').value.trim() || '未分类',
    date: $('#fDate').value || todayIso(),
    glyph: $('#fGlyph').value || '✦',
    excerpt: $('#fExcerpt').value.trim(),
    body: $('#fBody').value,
  };
}

let saveTimer = null;
function updatePreview() {
  const f = collectForm();
  EDIT = { ...EDIT, ...f };
  $('#pvBody').innerHTML = renderMarkdown(f.body);
  const chars = f.body.replace(/\s/g, '').length;
  const min = Math.max(1, Math.round(chars / 400));
  $('#edStats').textContent = `${chars} 字 · 约 ${min} 分钟咒读 · ${f.date ? moonLabel(f.date) : ''} · 流派：${f.tag}`;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { api('save_draft', { ...f, updatedAt: Date.now() }).catch(() => {}); }, 600);
}
['fTitle', 'fTag', 'fDate', 'fGlyph', 'fSlug', 'fExcerpt', 'fBody'].forEach((id) => {
  $('#' + id).addEventListener('input', updatePreview);
  $('#' + id).addEventListener('change', updatePreview);
});
$('#fTitle').addEventListener('blur', () => {
  if (!$('#fSlug').value.trim() && $('#fTitle').value.trim()) {
    $('#fSlug').value = autoSlug($('#fTitle').value.trim(), $('#fDate').value || todayIso());
    updatePreview();
  }
});

/* 图片：选择 / 拖拽 / 粘贴 */
$('#btnPickImg').addEventListener('click', () => $('#imgFile').click());
$('#imgFile').addEventListener('change', async (e) => {
  for (const file of e.target.files) await uploadImage(file);
  e.target.value = '';
});
async function uploadImage(file) {
  const ext = '.' + (file.name.split('.').pop() || 'png').toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return toast('仅支持 png/jpg/webp/gif', true);
  if (file.size > 10 * 1024 * 1024) return toast('图片超过 10MB', true);
  const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(file); });
  const slug = $('#fSlug').value.trim() || 'img';
  toast('正在铭刻图片……');
  const r = await api('save_image', { slug, filename: file.name, data: b64 });
  insertAtCursor(`![${file.name}](${r.path})`);
  toast('✦ 图片已入库：' + r.path);
}
function insertAtCursor(text) {
  const ta = $('#fBody');
  const s = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd ?? s);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}
$('#fBody').addEventListener('paste', async (e) => {
  const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'));
  if (!items.length) return;
  e.preventDefault();
  for (const item of items) {
    const file = item.getAsFile();
    if (file) await uploadImage(new File([file], 'paste.' + (item.type.split('/')[1] || 'png'), { type: item.type }));
  }
});
['fBody', 'edPreview'].forEach((id) => { /* 拖拽（编辑区 + 预览区都接） */ });
const edPane = document.querySelector('.editor-grid');
edPane.addEventListener('dragover', (e) => { e.preventDefault(); edPane.classList.add('drop-hint'); });
edPane.addEventListener('dragleave', () => edPane.classList.remove('drop-hint'));
edPane.addEventListener('drop', async (e) => {
  e.preventDefault();
  edPane.classList.remove('drop-hint');
  for (const file of [...(e.dataTransfer?.files || [])]) if (file.type.startsWith('image/')) await uploadImage(file);
});

/* 发布 */
$('#btnPublish').addEventListener('click', async () => {
  const f = collectForm();
  if (!f.title.trim()) return toast('卷轴还没有名字', true);
  if (!f.body.trim()) return toast('正文还是空的', true);
  let slug = f.slug || autoSlug(f.title, f.date);
  if (STATE.posts.some((p) => p.slug === slug && p.slug !== EDIT.slug && !p.deleted)) {
    let i = 2;
    while (STATE.posts.some((p) => p.slug === slug + '-' + i)) i++;
    slug = slug + '-' + i;
  }
  const bodyHTML = renderMarkdown(f.body);
  const plain = f.body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*\-!`]/g, ' ').replace(/\s/g, '');
  const chars = plain.length;
  const post = {
    slug,
    glyph: f.glyph,
    tag: f.tag,
    date: moonLabel(f.date),
    sortDate: f.date,
    title: f.title,
    excerpt: f.excerpt || plain.slice(0, 60) + (plain.length > 60 ? '……' : ''),
    time: `${Math.max(1, Math.round(chars / 400))} 分钟`,
    likes: (STATE.posts.find((p) => p.slug === slug) || {}).likes || 0,
    comments: (STATE.posts.find((p) => p.slug === slug) || {}).comments || [],
    body: bodyHTML,
  };
  const btn = $('#btnPublish');
  btn.disabled = true;
  btn.textContent = '✦ 正在铭刻……';
  try {
    const r = await api('publish', { post, push: !!STATE.settings.auto_push, isUpdate: !!EDIT.isUpdate });
    if (r.pushed === false) {
      const q = pendingGet(); q[slug] = post; pendingSet(q);
      toast('已保存在线内容 · 推送失败（已标记待推送）', true);
    } else {
      toast('✦ 卷轴已发布 · 约 1 分钟后线上可见');
    }
    if (EDIT.key.startsWith('new-')) api('delete_draft', { key: EDIT.key }).catch(() => {});
    await refreshState();
    showView('list');
  } catch (e) {
    toast('发布失败：' + e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ 上传卷轴';
  }
});
$('#btnBack').addEventListener('click', () => { renderList(); showView('list'); });

/* ---------- 设置 ---------- */
function renderSettings() {
  const s = STATE.settings;
  $('#sProj').value = s.project_dir || '';
  $('#sBranch').value = s.branch || 'main';
  $('#sKey').value = s.ssh_key || '';
  $('#sAuto').checked = s.auto_push !== false;
  $('#setNote').textContent = STATE.projectFound
    ? '当前博客目录：' + STATE.projectDir
    : '⚠ 尚未找到博客目录——请填写含 posts.user.json 的文件夹路径';
}
$('#btnSaveSet').addEventListener('click', async () => {
  const s = await api('settings', {
    project_dir: $('#sProj').value.trim(),
    branch: $('#sBranch').value.trim() || 'main',
    ssh_key: $('#sKey').value.trim(),
    auto_push: $('#sAuto').checked,
  });
  Object.assign(STATE.settings, s.settings);
  await refreshState();
  toast('✦ 设置已保存');
});

/* ---------- 启动 ---------- */
(async function init() {
  try {
    await refreshState();
    if (!STATE.projectFound) {
      toast('未找到博客目录 · 请到「设置」中选择', true);
      renderSettings();
      showView('settings');
    }
  } catch (e) {
    toast('启动失败：' + e.message, true);
  }
})();
