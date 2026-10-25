const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1600,height:1000}});p.setDefaultTimeout(15000);await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));await p.waitForFunction(()=>window.zgStoryEditorOpen);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{e.nodes=[{id:'a',title:'A',titleUk:'A',x:150,y:200,text:'A',links:[],editorSceneId:e.activeSceneId}];e.entryId='a';const all=JSON.parse(localStorage.getItem('zargota_story_editor_v1')||'{}');all['board-pointer-test']=e;localStorage.setItem('zargota_story_editor_v1',JSON.stringify(all));zgStoryEditorOpen('board-pointer-test');},episode);await p.locator('[data-workspace-tab=dialogues]').click();
 const canvas=p.locator('.zg-story-canvas'),slider=p.locator('.zg-board-tools input');
 async function frame(){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 async function setView(scale,x,y){await slider.fill(String(scale));await slider.dispatchEvent('input');await canvas.evaluate((c,{x,y})=>{c.scrollLeft=x;c.scrollTop=y;},{x,y});await frame();}
 for(const [scale,scroll] of [[1,0],[.5,0],[.25,420],[1.25,900]]){
  await setView(scale,scroll,scroll);const box=await canvas.boundingBox(),x=box.x+Math.min(260,box.width-80),y=box.y+210;
  await p.mouse.click(x,y,{button:'right'});await p.getByRole('menuitem',{name:/⑂ (Выбор|Вибір)/}).click();await frame();
  const id=await p.evaluate(()=>zgStoryEditorProject().nodes.at(-1).id),card=p.locator(`[data-node-id="${id}"]`),rect=await card.boundingBox();assert(Math.abs(rect.x-x)<3&&Math.abs(rect.y-y)<3,`creation at cursor ${scale}: ${JSON.stringify({rect,x,y})}`);
 }
 await setView(.5,700,700);
 const box=await canvas.boundingBox(),x=box.x+240,y=box.y+220;await p.mouse.click(x,y,{button:'right'});await p.getByRole('menuitem',{name:/◇ (Диалог|Діалог)/}).click();await frame();const id=await p.evaluate(()=>zgStoryEditorProject().nodes.at(-1).id),card=p.locator(`[data-node-id="${id}"]`);let r=await card.boundingBox();
 let mx=r.x+35,my=r.y+20;await p.mouse.move(mx,my);await p.mouse.down();mx+=30;my+=25;await p.mouse.move(mx,my);await frame();
 const grab=await card.evaluate((c,{mx,my})=>{const r=c.getBoundingClientRect();return{x:(mx-r.x)/r.width,y:(my-r.y)/r.height};},{mx,my});
 async function anchored(){const r=await card.boundingBox();assert(Math.abs(r.x+r.width*grab.x-mx)<3&&Math.abs(r.y+r.height*grab.y-my)<3,'grab point stays under pointer');}
 // Wheel scrolling, pan chord, and zoom all retain the same point on the held node.
 await p.mouse.wheel(0,80);await frame();await anchored();await p.mouse.down({button:'middle'});mx-=45;my-=35;await p.mouse.move(mx,my,{steps:4});await frame();await anchored();await p.mouse.up({button:'middle'});mx+=20;my+=10;await p.mouse.move(mx,my);await frame();await anchored();
 await p.keyboard.down('Control');await p.mouse.wheel(0,-100);await p.keyboard.up('Control');await frame();await anchored();await p.mouse.up();await frame();const persisted=await p.evaluate(id=>zgStoryEditorProject().nodes.find(n=>n.id===id),id);const dom=await card.evaluate(c=>({x:parseFloat(c.style.left),y:parseFloat(c.style.top)}));assert(Math.abs(persisted.x-dom.x)<1&&Math.abs(persisted.y-dom.y)<1);
 // Crossing the top edge adds view space, not author-data offsets.
 const savedNodes=await p.evaluate(()=>JSON.stringify(zgStoryEditorProject().nodes));
 const first=p.locator('[data-node-id="a"]');
 for(const scale of [.25,1,1.5]){
  await setView(scale,0,0);const cb=await canvas.boundingBox();await p.mouse.move(cb.x+200,cb.y+180);
  const before=await first.boundingBox();await p.mouse.wheel(0,-120);await p.waitForTimeout(150);
  const after=await first.boundingBox();assert(Math.abs(after.y-before.y-120)<3,`ceiling wheel has no jump at ${scale}: ${after.y-before.y}`);
  assert(await canvas.evaluate(c=>c.scrollTop>0),'scroll reserve exists');
  await setView(scale,0,0);const start=await first.boundingBox();
  await p.mouse.move(cb.x+200,cb.y+140);await p.mouse.down({button:'middle'});await p.mouse.move(cb.x+200,cb.y+220,{steps:4});await p.mouse.up({button:'middle'});await frame();
  const end=await first.boundingBox();assert(Math.abs(end.y-start.y-80)<3,`ceiling middle pan has no jump at ${scale}: ${end.y-start.y}`);
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(zgStoryEditorProject().nodes)),savedNodes,'panning never rewrites node positions');
 // Existing world coordinates still map correctly after several extensions.
 await setView(.5,0,0);await canvas.evaluate(c=>c.scrollTop=parseFloat(c.querySelector('#zg-story-stage').style.marginTop)*.5);await frame();
 const cbAfter=await canvas.boundingBox(),px=cbAfter.x+230,py=cbAfter.y+200;
 await p.mouse.click(px,py,{button:'right'});await p.getByRole('menuitem',{name:/◇ (Диалог|Діалог)/}).click();await frame();
 const newestId=await p.evaluate(()=>zgStoryEditorProject().nodes.at(-1).id),newest=await p.locator(`[data-node-id="${newestId}"]`).boundingBox();assert(Math.abs(newest.x-px)<3&&Math.abs(newest.y-py)<3,'creation after ceiling expansion');
 const tools=p.locator('.zg-board-tools'),help=p.locator('.zg-board-help');assert.equal(await help.getAttribute('open'),null);assert.equal(await p.locator('.zg-board-help-text').isVisible(),false);await help.locator('summary').click();assert(await p.locator('.zg-board-help-text').isVisible());await help.locator('summary').click();
 const cb=await canvas.boundingBox(),tb=await tools.boundingBox();assert(tb.y>=cb.y&&tb.y+tb.height<cb.y+cb.height&&tb.x+tb.width<=cb.x+cb.width,'toolbar sits inside board');await p.screenshot({path:'/private/tmp/zargota-board-pointer-fixed.png'});
 await p.setViewportSize({width:1024,height:768});await frame();const narrowCanvas=await canvas.boundingBox(),narrowTools=await tools.boundingBox();assert(narrowTools.x>=narrowCanvas.x&&narrowTools.x+narrowTools.width<=narrowCanvas.x+narrowCanvas.width+1,'toolbar fits narrow board');
 console.log('PASS Edge: context creation at 4 zooms/scrolled origins; held node follows scroll, middle-button pan and cursor zoom; coordinates persist; toolbar stays on board and help is folded.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
