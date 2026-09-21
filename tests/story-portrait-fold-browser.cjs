const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const p=await browser.newPage();
  await p.setContent('<main></main>');
  await p.addScriptTag({path:'story-portrait-kit.js'});
  await p.evaluate(()=>{
   window.data={speakers:{hero:{name:'Hero',emotions:{angry:{name:'Злой',nameUk:'Злий'}}}}};
   window.first={speaker:'hero'};window.slide={};window.patchCount=0;
   window.render=function(){document.querySelector('main').innerHTML='';
    [first,Object.assign({},first,slide)].forEach((page,i)=>{
     const host=document.createElement('section');host.id='p'+i;document.querySelector('main').append(host);
     ZargotaStoryPortraitKit.picker(data,page,host,patch=>{patchCount++;Object.assign(i?slide:first,patch);render();},!i,i?slide:undefined);
    });
   };render();
  });
  assert.equal(await p.locator('#p0 details').first().getAttribute('open'),'');
  await p.locator('#p0 [data-portrait-choice=angry]').click();
  assert.equal(await p.locator('#p0 details').first().getAttribute('open'),null);
  assert.match(await p.locator('#p0 .zg-portrait-selection').innerText(),/Злой/);
  assert.equal(await p.locator('#p1 details').first().getAttribute('open'),'','New page stays open despite inherited emotion');
  await p.locator('#p0 .zg-portrait-selection').click();
  await p.locator('#p0 [data-portrait-choice=off]').click();
  assert.match(await p.locator('#p0 .zg-portrait-selection').innerText(),/Без портрета/);
  assert.equal(await p.locator('#p0 details').first().getAttribute('open'),null);
  await p.locator('#p1 [data-portrait-choice=angry]').click();
  assert.equal(await p.locator('#p1 details').first().getAttribute('open'),null);
  await p.evaluate(()=>render());
  assert.equal(await p.locator('#p1 details').first().getAttribute('open'),null);
  assert.equal(await p.evaluate(()=>patchCount),3);
  console.log('PASS: choice collapses, off collapses, reopen works, new page independent, rerender retained.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
