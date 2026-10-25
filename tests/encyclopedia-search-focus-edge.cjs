const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  for(const mobile of [true,false])for(const locale of ['ru','uk']){
   const context=await browser.newContext({viewport:mobile?{width:390,height:700}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
   await page.evaluate(locale=>{ZargotaI18n.setLocale(locale);showPage('world');setWorldTab('enc');encState.query='';renderEncSidebar();},locale);
   const input=page.locator('#world-enc-sidebar .enc-search');
   if(mobile)await input.tap();else await input.click();
   await page.evaluate(()=>{window.searchNode=document.querySelector('.enc-search');window.searchBlurCount=0;searchNode.addEventListener('blur',()=>searchBlurCount++);});
   const verify=async(value,caret)=>{
    const state=await page.evaluate(()=>{const input=document.querySelector('.enc-search');return {same:input===searchNode,focused:document.activeElement===input,value:input.value,query:encState.query,caret:input.selectionStart,blurs:searchBlurCount};});
    assert.equal(state.same,true,'search input was replaced');assert.equal(state.focused,true,'search lost focus');assert.equal(state.blurs,0,'search blurred');
    assert.equal(state.value,value);assert.equal(state.query,value);if(caret!==undefined)assert.equal(state.caret,caret);
   };
   let value='';
   for(const char of 'Иерархия') {await page.keyboard.insertText(char);value+=char;await verify(value,value.length);}
   assert.ok(await page.locator('.enc-sidebar-results').innerText().then(t=>t.includes('Иерархия Зарготы') || t.includes('Ієрархія Зарготи')),'matching entry remains in results');
   await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await page.keyboard.insertText('Х');
   await verify('ИерархХия',7);
   await page.keyboard.press('Backspace');await verify('Иерархия',6);
   await page.evaluate(()=>searchNode.setSelectionRange(0,searchNode.value.length));
   await page.keyboard.insertText('Заргота');await verify('Заргота',7);
   // Changing the viewport models the resize that can accompany a mobile keyboard.
   await page.setViewportSize(mobile?{width:390,height:450}:{width:1280,height:800});
   await page.waitForTimeout(350);await verify('Заргота',7);
   await page.evaluate(()=>searchNode.setSelectionRange(0,searchNode.value.length));
   await page.keyboard.press('Backspace');await verify('',0);
   await cdp.send('Input.imeSetComposition',{text:'Ки',selectionStart:2,selectionEnd:2});
   await verify('Ки');
   await cdp.send('Input.imeSetComposition',{text:'Киев',selectionStart:4,selectionEnd:4});
   await verify('Киев');
   await cdp.send('Input.insertText',{text:'Киев'});await verify('Киев',4);
   await page.evaluate(()=>{encState.query='Заргота';renderEncSidebar();});await verify('Заргота');
   console.log((mobile?'mobile':'desktop')+' '+locale+': continuous input, caret, deletion, insertion, resize, IME and external query: OK');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
