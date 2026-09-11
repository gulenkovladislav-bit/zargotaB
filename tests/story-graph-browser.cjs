const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5176/index.html');await page.getByRole('button',{name:'⚒ Мастерская',exact:true}).click();await page.getByRole('button',{name:/Создание сюжета Сцена/}).click();
const stage=page.locator('#zg-story-stage');
async function create(x,y,name){const box=await stage.boundingBox();await page.mouse.click(box.x+x,box.y+y,{button:'right'});await page.getByRole('menuitem',{name,exact:true}).click();return await page.evaluate(()=>zgStoryEditorProject().nodes.at(-1).id);}
const choice=await create(410,80,'⑂ Выбор');assert.equal(await page.locator('.zg-graph-choice-editor').count(),1);await page.getByRole('button',{name:'＋ Добавить вариант',exact:true}).click();assert.equal(await page.locator(`[data-node-id="${choice}"] .zg-graph-out`).count(),3);
const picture=await create(780,80,'▧ Картинка');await page.getByRole('button',{name:'Внешний вид',exact:true}).click();await page.locator('[data-story-extra="image"]').fill('images/story/vrotik-mountain-v1.png');await page.locator('[data-story-extra="image"]').press('Tab');
const dialogue=await create(770,400,'◇ Диалог');
async function wire(from,index,to){const a=await page.locator(`[data-node-id="${from}"] .zg-graph-out`).nth(index).boundingBox(),b=await page.locator(`[data-node-id="${to}"] .zg-graph-in`).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();}
await wire('dialog-1',0,choice);await wire(choice,0,picture);await wire(choice,1,dialogue);await wire(choice,2,picture);
const links=await page.evaluate(id=>zgStoryEditorProject().nodes.find(n=>n.id===id).links,choice);assert.deepEqual(links.map(l=>l.to),[picture,dialogue,picture]);assert.equal(await page.locator('.zg-story-link:not(.zg-wire-preview)').count(),4);
await page.locator(`[data-node-id="${choice}"]`).click({position:{x:50,y:30}});assert.equal(await page.locator('.zg-graph-advanced').getAttribute('open'),null);await page.screenshot({path:'/private/tmp/zargota-graph-board.png'});
await page.evaluate(id=>{const p=zgStoryEditorProject();p.scene.tokens=[{id:'test-npc',x:50,y:50,name:'Test NPC',size:64}];p.interactions={'test-npc':{entryId:id}};ZargotaStoryPlayer.start(p);},choice);
await page.locator('[data-token-id="test-npc"]').click();await page.locator('.zg-story-answers button').first().waitFor();assert.equal(await page.locator('.zg-story-answers button').count(),3);
await page.locator('.zg-story-answers button').first().click();await page.locator('.zg-story-inspection:not([hidden])').waitFor();assert.equal(await page.locator('.zg-story-inspection img').getAttribute('src'),'images/story/vrotik-mountain-v1.png');
await page.evaluate(()=>ZargotaStoryPlayer.stop());
await page.getByRole('button',{name:'▧ Сцена',exact:true}).click();await page.getByRole('button',{name:'？ Добавить точку осмотра',exact:true}).click();
const pin=page.locator('.zg-stage-pin').last(),before=await pin.boundingBox();assert.ok(Math.abs(before.width-before.height)<1);
await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+80,before.y+before.height/2+40,{steps:10});await page.mouse.up();
assert.ok(await page.evaluate(()=>zgStoryEditorProject().scene.tokens.at(-1).x)>50);assert.ok(await page.evaluate(()=>zgStoryEditorProject().scene.tokens.at(-1).y)>50);await page.screenshot({path:'/private/tmp/zargota-scene-drag.png'});assert.deepEqual(errors,[]);console.log('Context creation, three visual choice connections, image inspector and scene pin dragging passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
