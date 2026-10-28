'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8765');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{
   const c=JSON.parse(JSON.stringify(characters.find(c=>c.name==='Эстерос')||characters[0]));
   c.id=987654321;c.name='Эстерос';c.nameUk='Естерос';c.hpCur=12;c.hpMax=12;c.baseHpMax=12;
   c.arenaEquipSlots={};c.tempEffects=[];c.statuses=['poison','shield','burn','freeze','fear','blind'];
   c.tempEffects.push({id:12,type:'status',statusKey:'poison',label:'Отравлен',value:'Отравлен',remaining:2,duration:2,unit:'rounds'},{id:13,type:'status',statusKey:'shield',label:'Защитный щит',value:'Защитный щит',remaining:3,duration:3,unit:'rounds'});
   c.stats.str={base:0,cur:0,tmp:0};c.tempEffects.push({id:10,type:'str',label:'Сила',value:2,remaining:3,duration:3,unit:'rounds'});
   characters.push(c);window._charSheetTab='stats';showPage('characters');openCharSheet(c.id);
  });
  for(const locale of ['ru','uk']){
   await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
   for(const [width,height] of [[320,568],[390,700],[390,780],[430,932]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(450);
    const g=await page.evaluate(()=>{
     const root=document.querySelector('.zgmo-overview'),stats=document.querySelector('.zgmo-stats'),states=document.querySelector('.zgmo-states');
     return {scroll:root.scrollHeight-root.clientHeight,body:document.body.scrollHeight-innerHeight,width:document.documentElement.scrollWidth-innerWidth,top:root.getBoundingClientRect().top,end:states.getBoundingClientRect().bottom,nav:document.querySelector('#char-sheet-tab-bar').getBoundingClientRect().top,stats:stats.clientHeight,states:states.clientHeight,font:parseFloat(getComputedStyle(document.querySelector('#zgmo-str')).fontSize),labels:[...root.querySelectorAll('.zgmo-stat label')].map(e=>e.scrollWidth-e.clientWidth)};
    });
    assert.ok(g.scroll<=1,JSON.stringify({locale,width,height,g}));assert.equal(g.body,0);assert.ok(g.width<=1);assert.equal(g.top,0);assert.ok(g.end<=g.nav);assert.ok(g.stats>g.states*1.6);assert.ok(g.font>=30);assert.ok(g.labels.every(x=>x<=1),JSON.stringify(g));
    const portrait=await page.locator('.zgmo-portrait,.zgmo-portrait-image').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};}));assert.equal(portrait.length,2);assert.ok(portrait.every(r=>Math.abs(r.left)<1&&Math.abs(r.right-width)<1),JSON.stringify({width,portrait}));
    const tiles=await page.locator('.zgmo-state-cards>button').evaluateAll(els=>els.map(el=>({w:el.clientWidth,h:el.clientHeight,overflow:el.scrollHeight-el.clientHeight})));
    assert.ok(Math.abs(tiles[0].w-tiles[1].w)<=1);assert.equal(tiles[0].h,tiles[1].h);assert.ok(tiles.every(t=>t.overflow<=1),JSON.stringify(tiles));
    assert.ok(await page.locator('.zgmo-nav button>span:last-child').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.parentElement.clientWidth)), 'Navigation labels fit');
    const centers=await page.locator('.zgmo-stat').evaluateAll(els=>els.map(el=>{const card=el.getBoundingClientRect(),input=el.querySelector('input').getBoundingClientRect(),style=getComputedStyle(el.querySelector('input'));return {delta:card.x+card.width/2-input.x-input.width/2,align:style.textAlign,width:input.width,grid:style.gridColumn,justify:style.justifySelf};}));assert.ok(centers.every(x=>Math.abs(x.delta)<1&&x.align==='center'), JSON.stringify({width,height,centers}));
    const activeNav=await page.locator('.zgmo-nav button[aria-current=page]').evaluate(el=>{const d=getComputedStyle(el.querySelector('.zgmo-diamond')),m=new DOMMatrix(d.transform);return {scale:Math.hypot(m.a,m.b),underline:getComputedStyle(el.querySelector('span:last-child'),'::after').content,glow:d.boxShadow};});assert.ok(activeNav.scale>1.09,JSON.stringify(activeNav));assert.equal(activeNav.underline,'none');assert.notEqual(activeNav.glow,'none');
    assert.equal(await page.locator('.zgmo-hp>button').count(),3);
    assert.equal(await page.locator('.zgmo-overview button').evaluateAll(els=>els.filter(el=>el.textContent==='⋯').length),1);
    assert.ok(await page.locator('.zgmo-control-mark').evaluateAll(els=>els.every(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1&&Math.abs(a.y+a.height/2-b.y-b.height/2)<1;})), 'Plus/minus marks center in their controls');
    assert.equal(await page.locator('#char-sheet-tab-bar button').count(),4);assert.equal(await page.locator('.zgmo-state-cards>button').count(),2);
   }
  }
  await page.setViewportSize({width:390,height:780});await page.evaluate(()=>ZargotaI18n.setLocale('ru'));
  await page.waitForTimeout(550);await page.screenshot({path:'/tmp/zargota-mobile-stats-esteros.png'});
  const navStyle=await page.locator('#char-sheet-tab-bar').evaluate(el=>({border:getComputedStyle(el).borderTopWidth,bg:getComputedStyle(el).backgroundColor}));assert.equal(navStyle.border,'0px');assert.equal(navStyle.bg,'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.zgmo-nav svg').count(),4);
  assert.equal(await page.locator('.zgmo-nav button').first().innerText(),'Характеристики');
  assert.equal(await page.locator('.zgmo-nav button').nth(2).innerText(),'Инвентарь');
  assert.equal(await page.locator('.zgmo-nav .zgmo-diamond').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.notEqual(await page.locator('.zgmo-nav button[aria-current=page] svg').evaluate(el=>getComputedStyle(el).color),await page.locator('.zgmo-nav button:not([aria-current]) svg').first().evaluate(el=>getComputedStyle(el).color));
  assert.equal(await page.locator('.zgmo-count-diamond').innerText(),'6');
  assert.equal(await page.locator('.zgmo-states').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  assert.equal(await page.locator('.zgmo-state-cards img').evaluateAll(els=>els.every(el=>el.complete&&el.naturalWidth>0)),true);
  await page.locator('[data-zgmo=status]').first().click();await page.waitForTimeout(300);
  const detail=page.locator('#status-info-popup');assert.ok(await detail.isVisible());
  assert.ok(await page.evaluate(()=>document.querySelector('#status-info-popup').getBoundingClientRect().bottom<=document.querySelector('#char-sheet-tab-bar').getBoundingClientRect().top+1));
  assert.equal(await detail.locator('details').count(),0);assert.equal(await detail.locator('.zgmo-detail-icon').getAttribute('src'),'images/ui/character-mobile/status-poison-v1.webp');
  assert.ok(await detail.locator('#zgmo-status-actions').isHidden());await detail.locator('[aria-controls=zgmo-status-actions]').click();assert.ok(await detail.locator('#zgmo-status-actions').isVisible());assert.ok(await detail.locator('#zgmo-status-actions button').isVisible());
  if(await detail.locator('[aria-controls=zgmo-status-rules]').count()){await detail.locator('[aria-controls=zgmo-status-rules]').click();assert.ok(await detail.locator('#zgmo-status-rules').isVisible());assert.ok(await detail.locator('#zgmo-status-actions').isHidden());await detail.locator('[aria-controls=zgmo-status-rules]').click();}else await detail.locator('[aria-controls=zgmo-status-actions]').click();
  await page.screenshot({path:'/tmp/zargota-mobile-status-open.png'});
  await detail.click({position:{x:2,y:2}});await detail.waitFor({state:'detached'});
  await page.locator('[data-zgmo=status]').first().click();await page.locator('.zgmo-status-dismiss').click();await detail.waitFor({state:'detached'});
  await page.locator('[data-zgmo=status]').first().click();await page.locator('#char-sheet-tab-bar button').nth(1).tap();assert.equal(await detail.count(),0);await page.locator('#char-sheet-tab-bar button').first().tap();
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#char-sheet-tab-bar button').nth(1).tap();await page.locator('#char-sheet-tab-bar button').first().tap();
  assert.equal(await page.locator('.zgmo-overview').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('[data-zgmo=prev]').count(),0);
  const first=await page.locator('.zgmo-state-cards').textContent();assert.ok(first.includes('2 раунд.')&&first.includes('3 раунд.'));await page.locator('[data-zgmo=next]').click();assert.equal(await page.locator('[data-zgmo=prev]').count(),1);assert.equal(await page.locator('.zgmo-state-cards').evaluate(el=>getComputedStyle(el).overflow),'visible');assert.equal(await page.locator('.zgmo-state-cards').evaluate(el=>el.scrollTop),0);assert.notEqual(await page.locator('.zgmo-state-cards').textContent(),first);await page.locator('[data-zgmo=next]').click();assert.equal(await page.locator('[data-zgmo=next]').count(),0);
  await page.evaluate(()=>{const c=characters.find(c=>c.id===987654321);c.tempEffects.push({id:99,type:'status',label:'Тестовый эффект',value:'Тестовый эффект',description:'Особое состояние персонажа',remaining:1,duration:1,unit:'rounds'});renderCharSheet();});
  while(await page.locator('[data-zgmo=prev]').count())await page.locator('[data-zgmo=prev]').click();
  while(!(await page.locator('[data-zgmo=status][aria-label="Тестовый эффект"]').count())&&await page.locator('[data-zgmo=next]').count())await page.locator('[data-zgmo=next]').click();
  await page.locator('[data-zgmo=status][aria-label="Тестовый эффект"]').click();assert.ok((await page.locator('#status-info-popup').textContent()).includes('Особое состояние персонажа'));await page.keyboard.press('Escape');await page.locator('#status-info-popup').waitFor({state:'detached'});
  await page.locator('#zgmo-str').fill('5');await page.locator('#zgmo-str').press('Tab');assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654321).stats.str.base),3,'temporary bonus is not written into the base');
  await page.locator('[data-zgmo=temp][data-field=str]').click();assert.equal(await page.locator('#quick-temp-popup').count(),1);await page.evaluate(()=>document.querySelector('#quick-temp-popup').remove());
  await page.evaluate(()=>{let c=characters.find(c=>c.id===987654321);c.tempEffects.push({id:11,type:'hp',label:'HP',value:2,remaining:3,duration:3,unit:'rounds'});renderCharSheet();});
  await page.evaluate(()=>{window.zgStableNodes=[...document.querySelectorAll('.zgmo-portrait-image,.zgmo-stat .zg-stat-icon,#char-sheet-tab-bar,#char-sheet-tab-bar svg')];});
  await page.locator('[data-zgmo=damage]').click();assert.ok(await page.locator('.zgmo-hp-change').count());assert.ok(await page.locator('.zgmo-hp-value').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')));assert.ok(await page.evaluate(()=>zgStableNodes.every(n=>n.isConnected)), 'HP update must preserve portrait, stat icons and tabs');assert.deepEqual(await page.evaluate(()=>{let c=characters.find(c=>c.id===987654321);return [c.hpCur,readTempHpTotal(c)]}),[12,1]);
  await page.locator('[data-zgmo=damage]').click();await page.locator('[data-zgmo=damage]').click();assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654321).hpCur),11);
  await page.locator('[data-zgmo=heal]').tap();assert.ok(await page.evaluate(()=>zgStableNodes.every(n=>n.isConnected)));assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654321).hpCur),12);
  await page.locator('.zgmo-hp [data-zgmo=health]').first().click();assert.ok(await page.locator('#zgmo-modal>section').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')));assert.equal(await page.locator('#combat-panel-inline').count(),1);await page.locator('#zgmo-modal [data-zgmo=close]').click();
  await page.locator('[data-zgmo=add-status]').click();assert.ok(await page.locator('[data-zgmo=choose-status]').count()>15);await page.locator('#zgmo-modal [data-zgmo=close]').click();
  await page.locator('[data-zgmo=add-status]').click();await page.locator('[data-zgmo=choose-status][data-key=stun]').click();
  for(const width of [320,390]){await page.setViewportSize({width,height:780});await page.waitForTimeout(350);assert.ok(await page.locator('#status-popup button[onclick^="spAdjDur"]').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>=56&&r.height>=56&&s.boxShadow!=='none'&&parseFloat(s.fontSize)>=32;})));assert.ok(await page.locator('#status-popup').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().left>=0));}
  await page.locator('#status-popup button[onclick="spAdjDur(1)"]').tap();assert.equal(await page.locator('#sp-dur').inputValue(),'4');await page.locator('#status-popup button[onclick="spAdjDur(-1)"]').tap();assert.equal(await page.locator('#sp-dur').inputValue(),'3');await page.screenshot({path:'/tmp/zargota-large-status-controls.png'});await page.evaluate(()=>document.querySelector('#status-popup').remove());
  await page.locator('[data-zgmo=menu]').click();assert.ok(await page.locator('[data-zgmo=portrait]').count());await page.locator('#zgmo-modal [data-zgmo=health]').click();assert.equal(await page.locator('#combat-panel-inline').count(),1);await page.locator('#zgmo-modal [data-zgmo=close]').click();assert.equal(await page.locator('#sheet-portrait-input').count(),1);
  await page.locator('[data-zgmo=sync]').click();assert.equal(await page.locator('#character-cloud-dialog').count(),1);await page.evaluate(()=>document.querySelector('#character-cloud-dialog').close());
  await page.evaluate(()=>openQuickTemp(987654321,'hp'));assert.ok(await page.locator('#quick-temp-popup').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')));await page.waitForTimeout(350);assert.ok(await page.locator('#quick-temp-popup button[onclick^=qtAdjust]').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().width>=56&&el.getBoundingClientRect().height>=56)));await page.locator('#qt-dur').focus();await page.setViewportSize({width:390,height:340});await page.waitForTimeout(450);assert.ok(await page.locator('#quick-temp-popup').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=visualViewport.height+1;}));await page.locator('#qt-dur').fill('12');await page.locator('#qt-dur').press('Enter');await page.evaluate(()=>document.querySelector('#quick-temp-popup').remove());await page.setViewportSize({width:390,height:780});
  // A keyboard-height resize must not replace the focused input or discard typing.
  await page.locator('#zgmo-dex').focus();await page.locator('#zgmo-dex').fill('3');await page.setViewportSize({width:390,height:430});await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>document.activeElement.id),'zgmo-dex');assert.equal(await page.locator('#zgmo-dex').inputValue(),'3');assert.ok(await page.locator('#zgmo-dex').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=visualViewport.height;}));assert.equal(await page.locator('#char-sheet-tab-bar').isVisible(),false);await page.keyboard.type('7');assert.equal(await page.locator('#zgmo-dex').inputValue(),'37');await page.locator('#zgmo-dex').press('Enter');await page.setViewportSize({width:390,height:780});
  // iOS changes visualViewport without shrinking the layout viewport.
  await page.locator('#zgmo-con').focus();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:330});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForTimeout(450);
  assert.ok(await page.locator('#zgmo-con').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=330;}),'Focused card stays above the visual-viewport keyboard');
  await page.locator('#zgmo-con').fill('15');await page.keyboard.type('2');assert.equal(await page.locator('#zgmo-con').inputValue(),'152');await page.screenshot({path:'/tmp/zargota-mobile-number-entry.png'});
  await page.locator('#zgmo-con').press('Enter');await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});await page.waitForTimeout(250);
  assert.ok(await page.locator('#char-sheet-tab-bar').isVisible());assert.equal(await page.locator('.zgmo-portrait-image').evaluate(el=>getComputedStyle(el).objectPosition),'50% 50%');
  await page.locator('#char-sheet-tab-bar button').nth(3).click();assert.equal(await page.locator('.zgmo-fame').count(),1);assert.equal(await page.evaluate(()=>document.body.classList.contains('zg-stats-overview')),false);
  await page.locator('#char-sheet-tab-bar button').first().click();await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(450);assert.equal(await page.locator('.zgmo-overview').count(),0);assert.equal(await page.locator('#char-sheet-tab-bar').count(),0);
  await page.setViewportSize({width:390,height:780});await page.waitForTimeout(450);assert.equal(await page.locator('.zgmo-overview').count(),1);
  await page.locator('[data-zgmo=back]').click();assert.equal(await page.evaluate(()=>document.body.classList.contains('zg-stats-overview')),false);assert.ok(await page.locator('#header').isVisible());
  await page.evaluate(()=>{window._charSheetTab='stats';openCharSheet(characters[0].id);});await page.setViewportSize({width:320,height:568});await page.waitForTimeout(450);assert.ok(await page.locator('.zgmo-identity h1').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:'/tmp/zargota-mobile-stats-small.png'});
  await page.evaluate(()=>{showPage('home');renderCharSheet();});assert.equal(await page.evaluate(()=>document.body.classList.contains('zg-stats-overview')),false);assert.ok(await page.locator('#header').isVisible());
  assert.deepEqual(errors,[]);console.log('PASS: stable HP updates and animations, animated bonus windows, keyboard-visible inputs, edge-to-edge portrait, centered values/plus/minus, one menu with health tools, approved silhouette diamonds, equal centered state tiles and total count, state detail/backdrop/navigation, reduced motion, 8 phone/locale sizes, state paging, temporary stats and HP, tools, input focus, fame, desktop resize, return navigation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
