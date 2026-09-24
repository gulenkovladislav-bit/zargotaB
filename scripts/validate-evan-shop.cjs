// Static export validation only; does not launch the game or mutate editor data.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const doc = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[2] || 'story-content/evan/episode-1-shop.json'), 'utf8'));
const e = doc.episode, errors = [], assets = new Set();
const nodes = new Map(e.nodes.map(n => [n.id, n]));
const scenes = new Set(e.scenes.map(r => r.id));
const items = new Set(e.storyItems.map(i => i.itemId));
const requireNode = (id, where) => { if (id && !nodes.has(id)) errors.push(`${where}: missing node ${id}`); };
if (nodes.size !== e.nodes.length) errors.push('Duplicate node IDs');
for (const n of e.nodes) {
  if (!Array.isArray(n.links)) errors.push(`${n.id}: missing links`);
  for (const p of [n, ...(n.slides || [])]) {
    if (p.text && !p.textUk) errors.push(`${n.id}: missing UK text`);
    if (p.speaker && !e.speakers[p.speaker]) errors.push(`${n.id}: missing speaker ${p.speaker}`);
    if (p.emotion && !e.speakers[p.speaker]?.emotions?.[p.emotion]) errors.push(`${n.id}: missing emotion ${p.emotion}`);
  }
  for (const l of n.links) { requireNode(l.to, n.id); if (!l.labelUk) errors.push(`${n.id}: missing UK choice`); }
  requireNode(n.repeatId, n.id);
  for (const a of [...(n.beforeWorldActions || []), ...(n.afterWorldActions || [])]) {
    if (a.type === 'giveItem' && !items.has(a.itemId)) errors.push(`${n.id}: missing item`);
    if (a.type === 'move' && !e.scenes.find(r => r.id === a.sceneId)?.scene.tokens.some(t => t.id === a.id)) errors.push(`${n.id}: missing moved token`);
  }
}
for (const q of e.quests) {
  requireNode(q.dialogueId, q.id);
  if (q.nextId && !e.quests.some(x => x.id === q.nextId)) errors.push(`${q.id}: missing next quest`);
  for (const m of q.milestones || []) { requireNode(m.nodeId, q.id); (m.dialogueIds || []).forEach(id => requireNode(id, q.id)); }
}
for (const [id, i] of Object.entries(e.interactions)) requireNode(i.entryId, id);
for (const r of e.scenes) for (const t of r.scene.tokens || []) { requireNode(t.entryId, t.id); if (t.sceneId && !scenes.has(t.sceneId)) errors.push(`${t.id}: missing scene`); }
function walk(v) {
  if (typeof v === 'string' && /^(assets|audio|images)\//.test(v) && /\.(png|jpe?g|webp|mp3|wav|ogg)$/i.test(v)) assets.add(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
}
walk(e);
for (const asset of assets) if (!fs.existsSync(path.join(root, decodeURIComponent(asset)))) errors.push(`Missing asset: ${asset}`);
if (JSON.stringify(e.scene) !== JSON.stringify(e.scenes.find(r => r.id === e.activeSceneId).scene)) errors.push('Active scene snapshot mismatch');
console.log(JSON.stringify({nodes:e.nodes.length, scenes:e.scenes.length, assets:assets.size, errors}, null, 2));
process.exitCode = errors.length ? 1 : 0;
