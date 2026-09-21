const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const e=require('../output/vrotik-standing-branch/episode-live-additive.json').episode;
const standing=e.nodes.find(n=>n.title==='Уклониться и устоять').id;
const together=e.nodes.find(n=>n.title==='Дальше вместе').id;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1500,height:950},reducedMotion:'reduce'});
 await p.addInitScript(()=>localStorage.setItem('zargota_ui_locale_v1','uk'));
 await p.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
 for(const route of [[2,0],[2,1]]){
  await p.evaluate(d=>{d.testDialogueId='graph-mu056z0n-136qh';d.intro={enabled:false};ZargotaStoryPlayer.start(d);},structuredClone(e));
  let id='graph-mu056z0n-136qh',choice=0,visited=[];
  for(let guard=0;guard<20;guard++){
   const n=e.nodes.find(n=>n.id===id);visited.push(id);
   for(const [i,page] of [n,...(n.slides||[])].entries()){
    const expected=page.textUk||page.text||'';
    await p.waitForFunction(t=>document.querySelector('#zg-story-player .zg-story-line')?.textContent===t,expected);
    if(i===0&&n.image){await p.waitForFunction(()=>{const img=document.querySelector('.zg-story-inspection>img');return img&&img.complete&&img.naturalWidth>0;});}
    if(i===0&&id===standing)await p.screenshot({path:'/private/tmp/vrotik-standing-edge.png'});
    if(i<(n.slides||[]).length)await p.locator('#zg-story-player').getByRole('button',{name:'Наступна репліка',exact:true}).click();
   }
   const buttons=p.locator('#zg-story-player .zg-story-answers button');
   if(!n.links.length){assert.equal(id,together);await buttons.first().click();break;}
   const index=n.links.length>1?route[choice++]:0;
   await buttons.nth(index).click();id=n.links[index].to;
  }
  assert(visited.includes(together));
  assert.equal(visited.includes('graph-mu07atak-15w4f'),false);
  await p.evaluate(()=>ZargotaStoryPlayer.stop());
  console.log('PASS Edge route',route.join('/'),visited.length,'nodes; every page and image loaded');
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
