const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../assets/stories');
const types = { backgrounds: 'image', portraits: 'image', objects: 'image', animations: 'image', audio: 'audio' };
let files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    const type = ['.png','.jpg','.jpeg','.webp','.gif','.svg'].includes(ext) ? 'image' : ['.mp3','.ogg','.wav','.m4a','.webm'].includes(ext) ? 'audio' : '';
    if (!type) continue;
    const relative = path.relative(root, full).split(path.sep).join('/');
    const category = relative.split('/').find(part => types[part]) || (type === 'audio' ? 'audio' : 'objects');
    files.push({ path: 'assets/stories/' + relative.split('/').map(encodeURIComponent).join('/'), name: relative, type, category });
  }
}
function refresh() {
files = [];
walk(root);
files.sort((a,b) => a.path.localeCompare(b.path));
let changed = false;
for (const [name, content] of [['catalog.json', JSON.stringify({ version: 1, files }, null, 2) + '\n'], ['catalog.js', 'window.ZargotaStoryAssetCatalog=' + JSON.stringify({version:1,files}) + ';\n']]) {
  const target = path.join(root, name);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) { fs.writeFileSync(target, content); changed = true; }
}
console.log(`Story assets indexed: ${files.length}`);
}
refresh();
