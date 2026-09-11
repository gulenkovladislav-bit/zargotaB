const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const page=await browser.newPage({viewport:{width:1600,height:950},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5176/index.html?lookout-demo=1');await page.getByRole('button',{name:/Редактор/}).click();await page.locator('[data-workspace-tab=scene]').click();
 const zoom=page.getByRole('slider',{name:'Масштаб камеры',exact:true});await zoom.fill('2.1');await zoom.dispatchEvent('change');
 await page.getByRole('button',{name:'⬡ Нарисовать зону',exact:true}).waitFor({state:'visible'});
 const viewport=await page.locator('.zg-stage-viewport').boundingBox();assert.ok(Math.abs(viewport.width/viewport.height-1600/950)<.01);
 await page.mouse.move(viewport.x+100,viewport.y+100);await page.mouse.down();await page.mouse.move(viewport.x+150,viewport.y+120,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.zg-stage-viewport').clientWidth>100);
 const editor=await page.evaluate(()=>{const v=document.querySelector('.zg-stage-viewport').getBoundingClientRect(),token=document.querySelector('[data-stage-id=story-vrotik]').getBoundingClientRect();return{x:(token.x-v.x)/v.width,y:(token.y-v.y)/v.height,size:token.width/v.width};});
 await page.getByRole('button',{name:'▶ Пройти эпизод',exact:true}).click();
 const player=await page.evaluate(()=>{const token=document.querySelector('[data-token-id=story-vrotik]').getBoundingClientRect();return{x:token.x/innerWidth,y:token.y/innerHeight,size:token.width/innerWidth};});for(const k of ['x','y','size'])assert.ok(Math.abs(editor[k]-player[k])<.005,`${k}: ${editor[k]} vs ${player[k]}`);
 await page.getByRole('button',{name:/Редактор/}).click();await page.locator('.zg-stage-tabs [data-mode=world]').click();await page.getByRole('button',{name:'Ливень',exact:true}).click();assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.rain),1);
 await page.getByRole('slider',{name:'Сила дождя',exact:true}).fill('0.35');await page.getByRole('slider',{name:'Сила дождя',exact:true}).dispatchEvent('change');assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.rain),.35);
 await page.locator('.zg-stage-tabs [data-mode=look]').click();await page.getByRole('button',{name:'Медальон',exact:true}).click();await page.getByRole('button',{name:'Применить ко всем портретам эпизода',exact:true}).click();assert.equal(await page.evaluate(()=>zgStoryEditorProject().presentation.shape),'circle');
 await page.getByRole('button',{name:'▣ Предпросмотр диалога',exact:true}).click();assert.equal(await page.locator('.zg-story-dialogue-preview').getAttribute('data-portrait-shape'),'circle');await page.screenshot({path:'/private/tmp/zargota-camera-palette.png'});
 await page.reload();await page.getByRole('button',{name:/Редактор/}).click();assert.equal(await page.evaluate(()=>zgStoryEditorProject().presentation.shape),'circle');assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.rain),.35);assert.deepEqual(errors,[]);
 console.log('Camera/token parity including saved pan; visible palette; weather slider and shared portrait preset persistence passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
