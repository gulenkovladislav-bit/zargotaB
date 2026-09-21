const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('zargota_ui_locale_v1','uk'));
    await page.goto((process.env.STORY_TEST_URL||'http://127.0.0.1:5176')+'/index.html?lookout-demo=1');
    async function actors(){await page.locator('#zg-story-player .zg-play-settings summary').click();await page.getByRole('button',{name:/Редактор/}).click();await page.locator('[data-workspace-tab=actors]').click();}
    await actors();
    await page.getByRole('button',{name:'Портрети й емоції',exact:true}).click();
    const tokens=await page.evaluate(()=>JSON.stringify(zgStoryEditorProject().scene.tokens));
    await page.getByRole('button',{name:'＋ Додати мовця',exact:true}).click();
    await page.getByLabel('Ім’я мовця',{exact:true}).fill('Мандрівник');
    await page.getByLabel('Ім’я мовця',{exact:true}).press('Tab');
    await page.locator('#zg-story-actors').getByLabel('Звичайний портрет').fill('assets/stories/backgrounds/cliff-lookout-v1.png');
    await page.locator('#zg-story-actors').getByLabel('Звичайний портрет').press('Tab');
    await page.getByRole('button',{name:'＋ Додати емоцію',exact:true}).click();
    await page.getByLabel('Портрет емоції').fill('assets/stories/backgrounds/distant-beacon-v1.png');
    await page.getByLabel('Портрет емоції').press('Tab');
    const id=await page.locator('#zg-story-actors select').first().inputValue();
    // Reload without blurring the edited name.
    await page.getByLabel('Назва емоції',{exact:true}).fill('Подив');
    await page.reload();await actors();
    assert.equal(await page.locator('#zg-story-actors select').first().inputValue(),id);
    assert.equal(await page.getByLabel('Ім’я мовця',{exact:true}).inputValue(),'Мандрівник');
    assert.equal(await page.getByLabel('Назва емоції',{exact:true}).inputValue(),'Подив');
    assert.equal(await page.getByLabel('Портрет емоції').inputValue(),'assets/stories/backgrounds/distant-beacon-v1.png');
    const data=await page.evaluate(()=>zgStoryEditorProject());
    assert.equal(data.speakers[id].name,'Мандрівник');assert.equal(data.speakers[id].nameUk,'Мандрівник');
    assert.equal(JSON.stringify(data.scene.tokens),tokens,'speaker edits preserve tokens');
    // Old records keep their payload, but no longer hide their real name behind a placeholder.
    await page.evaluate(id=>{
      const all=JSON.parse(localStorage.getItem('zargota_story_editor_v1'));
      const project=Object.values(all).find(d=>d.speakers&&d.speakers[id]);
      project.speakers[id].name='Старое имя';project.speakers[id].nameUk='Новий персонаж';
      localStorage.setItem('zargota_story_editor_v1',JSON.stringify(all));
    },id);
    await page.reload();await actors();
    assert.equal(await page.getByLabel('Ім’я мовця',{exact:true}).inputValue(),'Старое имя');
    assert.equal(await page.evaluate(id=>zgStoryEditorProject().speakers[id].nameUk,id),'Новий персонаж','display fallback does not rewrite old records');
    await page.locator('[data-workspace-tab=dialogues]').click();
    assert.equal(await page.locator('[data-story-field=speaker] option').filter({hasText:'Старое имя'}).count(),1);
    assert.deepEqual(errors,[]);
    console.log('Speaking character, bilingual name, emotion portrait and focused edit survive reload; selected tab/character restored; tokens unchanged.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
