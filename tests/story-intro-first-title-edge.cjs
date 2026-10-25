const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const page=await browser.newPage();await page.setContent('<main id="host"></main>');await page.addScriptTag({path:path.resolve('story-intro.js')});await page.clock.install();
 await page.evaluate(()=>{window.ZargotaI18n={getLocale:()=> 'ru'};window.original={title:'Episode',intro:{enabled:true,place:'Place',title:'Title',time:'Time',titleMs:1000,revealMs:400,sound:false}};window.other=structuredClone(original);ZargotaStoryIntro.edit(original,fn=>fn(original));});
 const field=page.getByLabel('Появление первого титра, мс');assert.equal(await field.inputValue(),'');await field.fill('1600');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 assert.equal(await page.evaluate(()=>original.intro.firstTitleFadeMs),1600);assert.equal(await page.evaluate(()=>other.intro.firstTitleFadeMs),undefined);
 await page.evaluate(()=>ZargotaStoryIntro.edit(original,fn=>fn(original)));assert.equal(await field.inputValue(),'1600');await page.getByRole('button',{name:'Отмена',exact:true}).click();
 async function start(name){await page.evaluate(name=>{ZargotaStoryIntro.cancel();window.done=false;ZargotaStoryIntro.play(window[name],document.getElementById('host'),()=>{},()=>{done=true;});document.querySelector('.zg-intro-start')?.click();},name);}
 async function state(){return page.evaluate(()=>({text:document.querySelector('.zg-intro-title h1')?.textContent,opacity:Number(document.querySelector('.zg-intro-title')?.style.opacity),done}));}
 await start('original');await page.clock.runFor(100);let s=await state();assert.equal(s.text,'Place');assert(s.opacity>.02&&s.opacity<.1);
 await page.clock.runFor(1500);s=await state();assert.equal(s.text,'Place');assert(s.opacity>.98);await page.clock.runFor(880);s=await state();assert.equal(s.text,'Title');assert(s.opacity>.35&&s.opacity<.55,'later titles retain the original 220ms fade');
 await page.clock.runFor(2400);assert.equal((await state()).done,true);
 await start('other');await page.clock.runFor(100);s=await state();assert(s.opacity>.35&&s.opacity<.55,'unchanged episode uses legacy fade');await page.clock.runFor(1100);assert.equal((await state()).text,'Title');await page.clock.runFor(2300);assert.equal((await state()).done,true);
 // Clearing the field restores automatic timing and localized controls persist.
 await page.evaluate(()=>{ZargotaI18n.getLocale=()=> 'uk';ZargotaStoryIntro.edit(original,fn=>fn(original));});await page.getByLabel('Поява першого титру, мс').fill('');await page.getByRole('button',{name:'Зберегти',exact:true}).click();await start('original');await page.clock.runFor(100);s=await state();assert(s.opacity>.35&&s.opacity<.55);await page.locator('.zg-intro-skip').click();assert.equal((await state()).done,true);
 console.log('PASS Edge: per-episode save/reopen, slow first fade reaches full visibility, later titles unchanged, legacy timing, automatic reset, RU/UK controls and skip.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
