const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-items.js','utf8'),ctx);
const icon=ctx.window.ZargotaStoryItems.icon,old='assets/stories/Evan/inspections/draft-folder-v1.png',item={itemId:'evan-draft-folder',image:old,inspectImage:old};
assert.equal(icon(item),'assets/stories/Evan/items/draft-folder-icon-v1.png');assert(fs.existsSync(icon(item)));assert.equal(item.image,old);assert.equal(item.inspectImage,old);
assert.equal(icon({...item,image:'custom.png'}),'custom.png');assert.equal(icon({itemId:'other',image:old}),old);
assert.equal(fs.readFileSync('story-actors.js','utf8').split('art.src=w.ZargotaStoryItems?.icon(item)||item.image').length-1,2);
console.log('Folder icon: old saved items supported, custom art preserved, inspection unchanged, both inventory views use the icon.');
