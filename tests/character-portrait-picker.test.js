'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const window={};
vm.runInNewContext(fs.readFileSync('character-portrait-picker.js','utf8'),{window,Promise});
const api=window.ZargotaPortraitPicker;
(async()=>{
 const old='images/portraits/char_1776627463516.png';
 const hero={id:1776627463516,portrait:old,hpCur:4,stats:{str:{cur:7}}};
 assert.equal(api.choices(hero).length,3);
 for(const option of api.choices(hero))assert.ok(fs.existsSync(option.src));
 assert.equal(await api.upgradeDefaults([hero],async()=>false),true);
 assert.ok(hero.portrait.endsWith('evan-2026-11.png'));assert.equal(hero.hpCur,4);assert.equal(hero.stats.str.cur,7);
 for(const extras of [{portraitThumb:'data:image/png;base64,personal'},{portraitChoice:old},{portrait:'data:image/png;base64,personal'},{portrait:'images/heroart/Evan.png'}]){
  const c=Object.assign({id:hero.id,portrait:old},extras),before=JSON.stringify(c);
  assert.equal(await api.upgradeDefaults([c],async()=>false),false);assert.equal(JSON.stringify(c),before);
 }
 const uploaded={id:hero.id,portrait:old};
 assert.equal(await api.upgradeDefaults([uploaded],async()=>true),false);assert.equal(uploaded.portrait,old);
 const duringRead={id:hero.id,portrait:old};
 assert.equal(await api.upgradeDefaults([duringRead],async()=>{duringRead.portrait='new-personal.png';return false;}),false);
 assert.equal(duringRead.portrait,'new-personal.png');
 assert.equal(await api.upgradeDefaults([{id:hero.id,portrait:old}]),false,'unavailable storage must preserve existing portrait');
 console.log('PASS: default upgrade, 3 stock choices, preserved uploads/choices/stats, storage failure and in-flight choice.');
})().catch(e=>{console.error(e);process.exitCode=1;});
