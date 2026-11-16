'use strict';

// Isolated UI regression: no production credentials, network, or character writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8896';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Local preview only');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const heroId = 987654389;
const art = 'images/characters/abilities/melissa-honey-balm.png';
const hero = JSON.parse(JSON.stringify(data.characters[0]));
Object.assign(hero, {
  id: heroId, name: 'QA personal actions', level: 3,
  spellRefs: [], spellsLearned: {}, preparedSpells: {kodex: [], folio: [], obrad: []}, spellCD: {},
  skills: [
    {name: 'Медовый бальзам', type: 'Активный', image: art, description: 'Эффект:\nВосстанавливает 1d6 здоровья.\nУспех: проверка Интеллекта Сл 12.', usages: '2 раза за долгий отдых', cdMax: 2, cdUsed: 0},
    {name: 'Тихий шаг', type: 'Пассивный', image: art, description: 'Пассивная способность без счётчика.', usages: '', cdMax: 0, cdUsed: 0},
    {name: 'Черта: Азарт у плоти', type: 'Черта', image: 'images/characters/abilities/evan-gamble-in-flesh.png', description: 'Бонус:\nПерекиньте 1d20 с помехой.\nНовый результат обязателен.', usages: '1 раз за долгий отдых', cdMax: 1, cdUsed: 0}
  ],
  mastery: [{name: 'Мастерство травника', type: 'Мастерство', image: 'images/characters/abilities/melissa-natural-remedies.png', description: 'Эффект:\nСоздаёт лечебное снадобье.\nПроверка Интеллекта Сл 12.', usages: '3 раза за короткий отдых', cdMax: 3, cdUsed: 0}]
});
delete hero.campaignKey;
const cases = [
  {group: 'personal', key: 'skills-0', field: 'skills', index: 0, max: 2},
  {group: 'features', key: 'skills-2', field: 'skills', index: 2, max: 1},
  {group: 'features', key: 'mastery-0', field: 'mastery', index: 0, max: 3}
];
const run = new Date().toISOString().replace(/[^0-9]/g, '');
const shots = {};
const labels = {
  ru: {apply: 'Применить', restore: 'Вернуть заряд', exhausted: 'Нет зарядов'},
  uk: {apply: 'Застосувати', restore: 'Повернути заряд', exhausted: 'Немає зарядів'}
};
const action = (page, name) => page.locator('#zgms-dialog [data-zgms="' + name + '"]');

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function open(page, entry) {
  if (await page.locator('#zgms-dialog').count()) await action(page, 'close').click();
  await page.locator('[data-zgms="group"][data-group="' + entry.group + '"]').click();
  await page.locator('.zgms-card[data-key="' + entry.key + '"]').click();
  await page.locator('#zgms-dialog .zgms-simple-panel').waitFor();
  await settle(page);
}
async function state(page, entry) {
  return page.evaluate(({heroId, field, index}) => {
    const item = characters.find(character => character.id === heroId)[field][index];
    return {used: item.cdUsed, max: item.cdMax, saves: window.__personalSaveCalls};
  }, {heroId, ...entry});
}
async function charges(page, left, max) {
  await page.waitForFunction(({left, max}) => document.querySelector('#zgms-dialog .zgms-charges strong')?.textContent.trim() === left + ' / ' + max, {left, max});
  await settle(page);
}
async function remember(page) {
  await page.evaluate(() => {
    const panel = document.querySelector('#zgms-dialog .zgms-simple-panel');
    window.__personalNodes = {panel, header: panel.querySelector('header'), art: panel.querySelector('.zgms-detail-art img')};
    window.__personalNodes.src = window.__personalNodes.art.src;
  });
}
async function stable(page) {
  assert.equal(await page.evaluate(() => {
    const old = window.__personalNodes, panel = document.querySelector('#zgms-dialog .zgms-simple-panel');
    return old.panel === panel && old.header === panel.querySelector('header') && old.art === panel.querySelector('.zgms-detail-art img') && old.src === old.art.src;
  }), true, 'Using or restoring charges preserves the panel, header, and artwork DOM nodes');
}
async function geometry(page, label) {
  const value = await page.locator('#zgms-dialog .zgms-simple-panel').evaluate(panel => {
    const r = element => {const b = element.getBoundingClientRect(); return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
    const controls = panel.querySelector('.zgms-personal-actions');
    return {
      panel:r(panel), width:innerWidth, height:innerHeight, overflow:panel.scrollWidth-panel.clientWidth,
      apply:r(controls.querySelector('.zgms-apply')), restore:r(controls.querySelector('.zgms-restore')), count:r(controls.querySelector('.zgms-charges')),
      recovery:r(controls.querySelector('.zgms-personal-recovery')),
      textOverflow:[...controls.querySelectorAll('button,strong,small')].map(n=>n.scrollWidth-n.clientWidth),
      font:parseFloat(getComputedStyle(controls.querySelector('.zgms-apply')).fontSize),
      body:r(panel.querySelector('.zgms-detail-body'))
    };
  });
  const message = label + ' ' + JSON.stringify(value);
  assert.ok(value.panel.left >= -1 && value.panel.right <= value.width+1 && value.panel.bottom <= value.height+1 && value.overflow <= 1, message);
  assert.ok(Math.abs((value.apply.left+value.apply.right)/2 - (value.panel.left+value.panel.right)/2) <= 1, 'Apply is centered: ' + message);
  assert.ok(value.restore.right <= value.apply.left && value.apply.right <= value.count.left, 'Controls do not overlap: ' + message);
  assert.ok(value.recovery.top >= value.apply.bottom - 1 && value.font >= 16 && value.apply.height >= 44 && value.body.height >= 120, message);
  assert.ok(value.textOverflow.every(n=>n <= 1), 'Control text fits: ' + message);
  assert.equal(await page.locator('#zgms-dialog [role="tab"],#zgms-dialog [data-zgms="learn"],#zgms-dialog [data-zgms="equip"]').count(), 0, 'Personal abilities have no spell-learning or equipment controls');
}
async function screenshot(page, label) {
  await page.locator('#zgms-dialog img').evaluateAll(images => Promise.all(images.map(image=>image.decode())));
  await page.waitForTimeout(350);
  const output = '/tmp/zargota-personal-actions-' + run + '-' + label + '.png';
  await page.screenshot({path:output}); shots[label]=output;
}

(async()=>{
  const browser = await chromium.launch({headless:true, executablePath:process.env.ZG_EDGE_EXECUTABLE || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  const errors=[], blockedOrigins=new Set();
  let checks=0;
  try {
    const context = await browser.newContext({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(!['http:','https:'].includes(url.protocol)||url.origin===origin)return route.continue();
      blockedOrigins.add(url.origin);return route.abort();
    });
    await context.addInitScript(({catalog,hero,version})=>{
      localStorage.setItem('grimoire_v3',JSON.stringify(catalog));
      localStorage.setItem('grimoire_chars',JSON.stringify([hero]));
      localStorage.setItem('zg_data_version',version);
    },{catalog:data.catalog,hero,version:manifest.version});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
    await page.evaluate(async heroId=>{
      await window.zgCharacterLoadPromise;
      window.__personalSaveCalls=0;window.__personalSaveMode='ok';
      window.saveChars=()=>{
        window.__personalSaveCalls++;
        if(window.__personalSaveMode==='deferred')return new Promise(resolve=>window.__personalFinishSave=resolve);
        if(window.__personalSaveMode==='throw')return Promise.reject(Error('isolated QA failed save'));
        return Promise.resolve({ok:window.__personalSaveMode!=='fail'});
      };
      window._charSheetTab='skills';showPage('characters');openCharSheet(heroId);
    },heroId);
    for(const locale of ['ru','uk']) {
      await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
      for(const [width,height] of [[320,568],[390,780],[430,932]]) {
        await page.setViewportSize({width,height});await page.waitForTimeout(200);
        for(const entry of cases) {
          await open(page,entry);await charges(page,entry.max,entry.max);await geometry(page,locale+'/'+width+'/'+entry.key);
          assert.equal(await action(page,'spend').innerText(),labels[locale].apply);
          assert.equal(await action(page,'restore').innerText(),labels[locale].restore);
          assert.equal(await action(page,'restore').isDisabled(),true);
          await remember(page);
          if(width===390&&entry.key==='skills-0')await screenshot(page,locale+'-390-ready');
          const before=await state(page,entry);
          for(let used=1;used<=entry.max;used++) {
            await action(page,'spend').click();await charges(page,entry.max-used,entry.max);await stable(page);
            assert.equal((await state(page,entry)).used,used);
          }
          assert.equal(await action(page,'spend').isDisabled(),true);
          assert.equal(await action(page,'spend').innerText(),labels[locale].exhausted);
          await geometry(page,locale+'/'+width+'/'+entry.key+'/empty');
          if(width===320&&entry.key==='skills-2')await screenshot(page,locale+'-320-exhausted');
          await action(page,'spend').evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
          assert.equal((await state(page,entry)).saves,before.saves+entry.max,'An exhausted ability cannot spend a further charge');
          for(let left=1;left<=entry.max;left++) {
            await action(page,'restore').click();await charges(page,left,entry.max);await stable(page);
            assert.equal((await state(page,entry)).used,entry.max-left);
          }
          assert.equal(await action(page,'restore').isDisabled(),true);
          await action(page,'restore').evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
          const after=await state(page,entry);
          assert.deepEqual(after,{used:0,max:entry.max,saves:before.saves+2*entry.max},'Restoration never exceeds the real maximum');
          checks++;
        }
        await open(page,{group:'personal',key:'skills-1'});
        assert.equal(await page.locator('#zgms-dialog .zgms-personal-actions,#zgms-dialog [data-zgms="spend"],#zgms-dialog [data-zgms="restore"]').count(),0,'Passive with no real maximum has no artificial charges');
        checks++;
      }
    }
    await page.setViewportSize({width:390,height:780});
    await page.evaluate(()=>ZargotaI18n.setLocale('ru'));
    const entry=cases[0];await open(page,entry);await remember(page);
    const beforePending=await state(page,entry);
    await page.evaluate(()=>window.__personalSaveMode='deferred');
    const box=await action(page,'spend').boundingBox(),cdp=await context.newCDPSession(page);
    // A real rapid double tap while the first transaction remains pending.
    for(let i=0;i<2;i++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await page.waitForFunction(()=>typeof window.__personalFinishSave==='function');
    assert.equal(await action(page,'spend').isDisabled(),true);
    assert.equal(await action(page,'restore').isDisabled(),true);
    await action(page,'restore').evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    assert.equal((await state(page,entry)).saves,beforePending.saves+1,'Rapid double tap and pending restore produce only one save');
    assert.equal(await page.locator('.skill-card-popup').count(),0,'Double tapping Apply does not open the editor');
    await stable(page);
    await page.evaluate(()=>window.__personalFinishSave({ok:true}));await charges(page,1,2);await stable(page);
    await page.waitForFunction(()=>!document.querySelector('#zgms-dialog [data-zgms="spend"]').disabled);
    for(const mode of ['fail','throw']) {
      await page.evaluate(mode=>window.__personalSaveMode=mode,mode);
      await action(page,'spend').click();await charges(page,1,2);await stable(page);
      assert.equal((await state(page,entry)).used,1,'Failed spend is rolled back');
      await action(page,'restore').click();await charges(page,1,2);await stable(page);
      assert.equal((await state(page,entry)).used,1,'Failed restore is rolled back');
    }
    await page.evaluate(()=>window.__personalSaveMode='ok');
    await action(page,'restore').click();await charges(page,2,2);
    // The existing explicit menu -> editor flow remains intact.
    await action(page,'detail-menu').click();await action(page,'edit').click();
    await page.locator('.sc-name').waitFor();
    assert.equal(await page.locator('.sc-name').inputValue(),hero.skills[0].name);
    assert.equal(await page.locator('.sc-type').inputValue(),hero.skills[0].type);
    assert.equal(Number(await page.locator('.sc-cdmax').inputValue()),2);
    assert.equal(await page.locator('.sc-desc').inputValue(),hero.skills[0].description);
    await page.locator('.sc-name').fill('QA edited personal');await page.locator('.sc-save-btn').click();
    await page.locator('#zgms-dialog .zgms-simple-panel').waitFor();await charges(page,2,2);
    assert.equal(await page.locator('#zgms-detail-title').innerText(),'QA edited personal');
    assert.equal(await page.locator('.skill-card-popup').count(),0);
    // Language changes patch the open reader and native image viewer in place.
    await page.evaluate(heroId=>{
      const item=characters.find(character=>character.id===heroId).skills[0];
      item.description='Описание:\n«Тепло остаётся на ладони».\n'+Array(18).fill('Эффект: восстанавливает 1d6 здоровья при проверке Интеллекта Сл 12.').join('\n');
      ZargotaMobileSkills.refresh();
    },heroId);
    await settle(page);await remember(page);
    const body=page.locator('#zgms-dialog .zgms-detail-body');
    await body.evaluate(node=>node.scrollTop=120);
    const scroll=await body.evaluate(node=>node.scrollTop);
    assert.ok(scroll>50,'The locale regression uses an actually scrolled reader');
    const beforeLocale=await state(page,entry);
    for(const locale of ['uk','ru']) {
      await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
      await page.waitForFunction(label=>document.querySelector('#zgms-dialog [data-zgms="spend"]')?.textContent===label,labels[locale].apply);
      await stable(page);
      assert.equal(await action(page,'restore').innerText(),labels[locale].restore);
      assert.equal(await body.evaluate(node=>node.scrollTop),scroll,'Changing locale preserves the reading position');
    }
    await action(page,'preview-art').click();
    await page.locator('#zgms-art-viewer').waitFor();
    await page.evaluate(()=>{
      const viewer=document.getElementById('zgms-art-viewer');
      window.__personalViewer={viewer,img:viewer.querySelector('img'),close:viewer.querySelector('button')};
    });
    for(const locale of ['uk','ru']) {
      await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
      const closeLabel=locale==='uk'?'Закрити зображення':'Закрыть изображение';
      await page.waitForFunction(label=>document.querySelector('#zgms-art-viewer [data-zgms="close-art"]')?.getAttribute('aria-label')===label,closeLabel);
      assert.equal(await page.evaluate(()=>{
        const before=window.__personalViewer,viewer=document.getElementById('zgms-art-viewer');
        return before.viewer===viewer&&viewer.open&&before.img===viewer.querySelector('img')&&before.close===viewer.querySelector('button');
      }),true,'Locale keeps the native viewer, artwork, and focused close button');
      await stable(page);
      assert.equal(await body.evaluate(node=>node.scrollTop),scroll,'Viewer locale change preserves the underlying reading position');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#zgms-art-viewer').count(),0);
    assert.equal(await body.evaluate(node=>node.scrollTop),scroll);
    assert.equal(await action(page,'preview-art').evaluate(node=>document.activeElement===node),true,'Closing viewer returns focus to the unchanged thumbnail');
    assert.deepEqual(await state(page,entry),beforeLocale,'Reading and language switches never save or change charges');
    assert.deepEqual(errors,[],'No browser script errors');
    console.log(JSON.stringify({ok:true,base,layoutAndChargeCases:checks,rapidDoubleTap:true,failedSpendAndRestoreRollback:true,stableArtwork:true,editorPreserved:true,openReaderAndViewerLocaleChanges:true,blockedOrigins:[...blockedOrigins],screenshots:shots},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
