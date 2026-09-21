const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};vm.runInNewContext(fs.readFileSync('story-ai-dialogues.js','utf8'),{window});const api=window.ZargotaStoryAIDialogues;
const fixture={format:'zargota-dialogue-branch',version:1,entry:'a',nodes:[
 {id:'a',kind:'dialogue',title:'Встреча',titleUk:'Зустріч',pages:[{speaker:'',text:'Начало',textUk:'Початок'},{speaker:'hero',text:'Привет',textUk:'Привіт'}],links:[{to:'b'}]},
 {id:'b',kind:'choice',pages:[{speaker:'hero',text:'Что делать?',textUk:'Що робити?'}],links:[{to:'c',label:'Пойти',labelUk:'Піти'},{to:'d',label:'Остаться',labelUk:'Залишитися'}]},
 {id:'c',kind:'image',imagePrompt:'Лесная тропа',pages:[{speaker:'',text:'Лес',textUk:'Ліс'}],links:[{to:'d'}]},
 {id:'d',kind:'dialogue',pages:[{speaker:'hero',text:'Конец',textUk:'Кінець'}],links:[]}
]};
const raw=JSON.stringify(fixture),branch=api.parse('```json\n'+raw+'\n```');
assert.equal(branch.groupCount,1);
const data={activeSceneId:'scene',entryId:'old',speakers:{hero:{name:'Hero'}},nodes:[{id:'old',text:'untouched',links:[]}]};const old=JSON.stringify(data.nodes[0]);
const id=api.append(data,branch,{},'');assert.equal(JSON.stringify(data.nodes[0]),old);assert.equal(data.entryId,'old');assert.equal(data.nodes.length,5);assert.equal(data.nodes[1].id,id);assert.equal(data.nodes[1].slides[0].speaker,'hero');assert.equal(data.nodes[1].showPortrait,false);assert.equal(data.nodes[1].slides[0].showPortrait,true);assert.ok(data.nodes.slice(1).every(n=>n.editorSceneId==='scene'));assert.equal(data.nodes[3].aiImagePrompt,'Лесная тропа');
const ids=new Set(data.nodes.map(n=>n.id));for(const n of data.nodes)for(const l of n.links)assert.ok(ids.has(l.to));
api.append(data,branch,{},'old');assert.equal(new Set(data.nodes.map(n=>n.id)).size,9);assert.equal(data.nodes[0].links.length,1);
function bad(edit){const f=JSON.parse(raw);edit(f);assert.throws(()=>api.parse(JSON.stringify(f)));}
bad(f=>f.nodes[1].id='a');bad(f=>f.nodes[0].links[0].to='missing');bad(f=>f.entry='missing');bad(f=>f.nodes[2].imagePrompt='');bad(f=>f.nodes[0].pages=[]);bad(f=>f.nodes[1].links[0].label=f.nodes[1].links[0].labelUk='');
bad(f=>f.nodes[0].pages[0].text='x'.repeat(12001));
bad(f=>f.nodes[0].pages[0].text={unexpected:'object'});
bad(f=>f.nodes[0].pages[0].musicEvent={action:'play'});
bad(f=>f.nodes[0].title='x'.repeat(201));
bad(f=>f.nodes[0].pages[0]=null);
bad(f=>f.nodes[0].links[0].label='x'.repeat(2001));
const exact=JSON.parse(raw);exact.nodes[0].pages[0].text='x'.repeat(12000);assert.equal(api.parse(JSON.stringify(exact)).nodes[0].pages[0].text.length,12000);
const separate={format:'zargota-dialogue-branch',version:1,entry:'one',nodes:[
 {id:'one',kind:'dialogue',pages:[{speaker:'',text:'Один',textUk:'Один'}],links:[]},
 {id:'two',kind:'dialogue',pages:[{speaker:'',text:'Два',textUk:'Два'}],links:[]},
 {id:'three',kind:'dialogue',pages:[{speaker:'',text:'Три',textUk:'Три'}],links:[{to:'four'}]},
 {id:'four',kind:'dialogue',pages:[{speaker:'',text:'Четыре',textUk:'Чотири'}],links:[]}
]};
const separateBranch=api.parse(JSON.stringify(separate));assert.equal(separateBranch.groupCount,3);const separateData={activeSceneId:'room',speakers:{},nodes:[]};api.append(separateData,separateBranch,{},'');assert.equal(separateData.nodes.length,4);assert.equal(separateData.nodes[0].x,separateData.nodes[1].x);assert.ok(separateData.nodes[2].x<separateData.nodes[3].x);
const unknown=api.parse(raw.replaceAll('hero','unknown')),before=JSON.stringify(data);assert.throws(()=>api.append(data,unknown,{},''));assert.equal(JSON.stringify(data),before);api.append(data,unknown,{unknown:'hero'},'');
assert.equal(JSON.stringify(fixture),raw);assert.ok(api.prompt(data).includes('Hero'));console.log('PASS: validated connected, separate and mixed AI dialogue imports, remapped IDs, pages, image tasks, character mapping and atomic failure.');
