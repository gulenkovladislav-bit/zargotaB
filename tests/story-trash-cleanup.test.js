const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let stored={live:{text:'keep'},active:{_deleted:true},old:{_deleted:true,text:'old'},edited:{_deleted:true,text:'before'}},fail=false;
const snapshot=structuredClone(stored);stored.edited.text='changed';
const ctx={activeKey:'active',loadAll:()=>structuredClone(stored),saveAll:value=>{if(fail)return false;stored=value;return true;}};vm.createContext(ctx);
const source=fs.readFileSync('story-editor.js','utf8');vm.runInContext(source.slice(source.indexOf('  function purgeDeletedEpisodes('),source.indexOf('  function episodeLibrary(')),ctx);
fail=true;assert.equal(ctx.purgeDeletedEpisodes(snapshot),0);assert.ok(stored.old);
fail=false;assert.equal(ctx.purgeDeletedEpisodes(snapshot),1);assert.equal(stored.old,undefined);assert.equal(stored.live.text,'keep');assert.ok(stored.active);assert.equal(stored.edited.text,'changed');assert.equal(ctx.purgeDeletedEpisodes(snapshot),0);
console.log('Trash cleanup: removes only backed-up unchanged deleted records; preserves active, edited and failed writes.');
