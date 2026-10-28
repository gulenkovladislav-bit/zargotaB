'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8876');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{
   const c=JSON.parse(JSON.stringify(characters.find(c=>c.name==='Эстерос')||characters[0]));
   c.id=987654322;c.name='Проверка навыков';c.skills=[{name:'Танец костей',type:'Активный',description:'Поднимает мертвеца.',usages:'1 раз за долгий отдых',cdMax:1,cdUsed:0,descByLevel:{1:'Первый уровень',3:'Третий уровень'}},{name:'Черта: Следопыт',type:'Черта',description:'Читает следы.'}];
   c.mastery=[{name:'Риса: Имитатор',type:'Стиль',description:'Подражает звукам.'},{name:'Приготовление снадобий',type:'Мастерство',description:'Создаёт снадобья.'},{name:'Не причиняй лишнего',type:'Позиция',description:'Позиция.'}];
   c.level=3;c.spellRefs=[];c.spellsLearned={};c.preparedSpells={kodex:[],folio:[],obrad:[]};c.spellCD={};
   const chosen=['Ответный Шип','Жар Пальцев','Луч Гнили','Огненный снаряд'].map(name=>entries.find(s=>s.name.toLowerCase().includes(name.toLowerCase()))).filter(Boolean);
   chosen.forEach(s=>{c.spellRefs.push(s.id);c.spellsLearned[s.id]=true;c.preparedSpells[s.spellType].push(String(s.id));});
   entries.filter(s=>!c.spellRefs.includes(s.id)).slice(0,5).forEach((s,i)=>{c.spellRefs.push(s.id);if(i<4)c.spellsLearned[s.id]=true;});
   characters.push(c);window._charSheetTab='skills';showPage('characters');openCharSheet(c.id);
  });
  await page.locator('.zgms-card').first().waitFor();
  assert.equal(await page.locator('.zgms-card').count(),4);
  assert.equal(await page.locator('.zgms-card em').count(),0,'Equipped filter does not repeat a badge on every card');
  assert.equal(await page.locator('.zgms-card').first().locator('small').innerText(),'За бой');
  assert.ok(await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.zgms-art'),'::before').height)>=8));
  assert.deepEqual(await page.locator('.zgms-source').evaluateAll(els=>els.map(el=>el.dataset.source)),['kodex','folio','obrad','folio']);
  for(const locale of ['ru','uk']){
   await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
   for(const [width,height] of [[320,568],[390,700],[390,780],[430,932]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    await page.waitForFunction(()=>Math.abs(document.querySelector(".zgms-screen").getBoundingClientRect().top)<0.1);
    const g=await page.evaluate(()=>{const root=document.querySelector('.zgms-screen'),nav=document.getElementById('char-sheet-tab-bar');return {root:root.scrollHeight-root.clientHeight,body:document.body.scrollHeight-innerHeight,width:document.documentElement.scrollWidth-innerWidth,top:root.getBoundingClientRect().top,end:root.getBoundingClientRect().bottom,nav:nav.getBoundingClientRect().top,cards:[...document.querySelectorAll('.zgms-card')].map(el=>({overflow:el.scrollHeight-el.clientHeight,h:el.clientHeight,art:el.querySelector('.zgms-art').clientHeight})),labels:[...document.querySelectorAll('.zgms-tabs button')].map(el=>el.scrollWidth-el.clientWidth)};});
    assert.ok(g.root<=1&&g.body<=1&&g.width<=1,JSON.stringify({locale,width,height,g}));assert.equal(g.top,0);assert.ok(g.end<=g.nav+1,JSON.stringify(g));assert.ok(g.cards.every(c=>c.overflow<=1&&c.art>=24),JSON.stringify(g));assert.ok(g.labels.every(n=>n<=1),JSON.stringify(g));
   }
  }
  await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await page.setViewportSize({width:390,height:780});
  await page.waitForTimeout(300);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.zgms-source img')].map(img=>img.decode())));await page.screenshot({path:'/tmp/zargota-mobile-skills.png'});
  // A spent equipped ability stays equipped; consuming a charge keeps DOM and pagination stable.
  await page.evaluate(()=>{window.__skillsNav=document.querySelector('.zgmo-nav');window.__skillsHeader=document.querySelector('.zgms-header');});
  await page.locator('.zgms-card').first().click();
  assert.match(await page.locator('.zgms-detail-body').innerText(),/2 раза за бой/);
  await page.locator('[data-zgms=spend]').click();await page.waitForTimeout(250);
  assert.match(await page.locator('.zgms-charges strong').innerText(),/1 \/ 2/);
  await page.locator('[data-zgms=close]').click();
  assert.match(await page.locator('.zgms-card').first().innerText(),/Осталось 1 из 2/);
  await page.locator('.zgms-filter [data-filter=all]').click();await page.waitForTimeout(100);
  assert.ok(await page.locator('.zgms-card em').count()>0,'All learned still identifies equipped cards');
  await page.locator('[data-zgms=next]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('.zgms-pagination span').innerText(),'2 / 2');
  assert.ok(await page.evaluate(()=>window.__skillsHeader===document.querySelector('.zgms-header')&&window.__skillsNav===document.querySelector('.zgmo-nav')));
  await page.locator('[data-group=traits]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-card').count(),2);
  assert.equal(await page.locator('.zgms-source[data-source=traits]').count(),2);
  await page.locator('[data-group=mastery]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-card').count(),2);
  assert.equal(await page.locator('.zgms-source[data-source=mastery]').count(),2);
  await page.locator('[data-group=personal]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-card').count(),1);
  assert.equal(await page.locator('.zgms-source[data-source=personal]').count(),1);
  await page.locator('.zgms-card').click();assert.match(await page.locator('.zgms-rules').innerText(),/Третий уровень/);
  await page.locator('[data-zgms=detail-menu]').click();await page.locator('[data-zgms=edit]').click();
  await page.locator('.sc-name').fill('Обновлённый навык');await page.locator('.sc-save-btn').click();await page.locator('.sc-close-x').click();
  await page.waitForTimeout(300);assert.match(await page.locator('.zgms-card').innerText(),/Обновлённый навык/);
  // Learn/unlearn and preparation use the existing data structure and limits.
  await page.locator('[data-group=learned]').click();await page.locator('[data-zgms=menu]').click();await page.locator('[data-zgms=unlearned]').click();await page.waitForTimeout(100);
  await page.locator('.zgms-card').click();assert.ok(await page.locator('[data-zgms=spend]').isDisabled());
  await page.locator('[data-zgms=detail-menu]').click();await page.locator('[data-zgms=learn]').click();await page.waitForTimeout(150);
  await page.locator('[data-zgms=detail-menu]').click();assert.ok(await page.locator('[data-zgms=equip]').isEnabled());
  await page.locator('[data-zgms=close]').click();
  // Enforce existing per-type preparation limits through the new detail action.
  const target=await page.evaluate(()=>{const c=characters.find(c=>c.id===987654322),list=c.spellRefs.map(id=>findCharacterCatalogSpell(id)).filter(s=>s.spellType==='kodex'&&c.spellsLearned[s.id]);c.preparedSpells.kodex=list.slice(0,3).map(s=>String(s.id));ZargotaMobileSkills.refresh();return list[3].id;});
  await page.locator('.zgms-filter [data-filter=all]').click();await page.waitForTimeout(150);
  const targetCard=page.locator('.zgms-card[data-key="spell-'+target+'"]');
  if(!await targetCard.count()){await page.locator('[data-zgms=next]').click();await page.waitForTimeout(150);}
  await targetCard.click();await page.locator('[data-zgms=detail-menu]').click();await page.locator('[data-zgms=equip]').click();
  assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654322).preparedSpells.kodex.length),3);
  await page.locator('[data-zgms=close]').click();
  // New traits can be created, edited, and deleted without losing the category.
  await page.locator('[data-group=traits]').click();await page.locator('[data-zgms=menu]').click();await page.locator('[data-zgms=add]').click();
  await page.locator('.sc-name').fill('Тестовая черта');await page.locator('.sc-save-btn').click();await page.locator('.sc-close-x').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('.zgms-card').count(),3);
  await page.locator('.zgms-card').filter({hasText:'Тестовая черта'}).click();await page.locator('[data-zgms=detail-menu]').click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-zgms=remove]').click();await page.waitForTimeout(150);assert.equal(await page.locator('.zgms-card').count(),2);
  // Saved character values survive a new page load (isolated browser storage).
  await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{const c=characters.find(c=>c.id===987654322);if(!c)throw Error('Saved character missing');if(c.skills[0].name!=='Обновлённый навык')throw Error('Skill edit lost');const spell=entries.find(s=>s.name.includes('Ответный Шип'));if(c.spellCD[spell.id].used!==1)throw Error('Charge edit lost');window._charSheetTab='skills';showPage('characters');openCharSheet(c.id);});
  // Leaving the tab restores the original character and desktop layouts.
  await page.locator('.zgmo-nav button').first().click();assert.ok(await page.locator('.zgmo-overview').isVisible());assert.equal(await page.locator('body.zg-skills-view').count(),0);
  await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(300);assert.equal(await page.locator('.zgms-screen').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS mobile skills: RU/UK 320–430px, four sections, learned/prepared filters, pagination, charges, editing, level descriptions, desktop return');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
