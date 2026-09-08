import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { POSTS } = await import(pathToFileURL(path.join(root, 'posts.js')).href);
const user = JSON.parse(fs.readFileSync(path.join(root, 'posts.user.json'), 'utf8'));

const map = new Map();
for (const p of POSTS) map.set(p.slug, { ...p, origin: 'archive' });
for (const p of user) map.set(p.slug, { ...(map.get(p.slug) || {}), ...p, origin: 'user' });

const merged = [...map.values()];
fs.writeFileSync(path.join(root, 'posts.user.json'), JSON.stringify(merged, null, 2));
fs.writeFileSync(
  path.join(root, 'posts.user.js'),
  '// 由铭刻室桌面版维护 —— posts.js 已冻结为创世存档\nwindow.__USER_POSTS = ' + JSON.stringify(merged, null, 2) + ';\n'
);
console.log('seeded:', merged.length, 'posts ->', merged.map(p => p.slug).join(', '));
