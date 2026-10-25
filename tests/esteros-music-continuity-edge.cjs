const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.route('http://127.0.0.1:17349/**',r=>r.abort());
 await p.goto('file://'+path.resolve('index.html'));
 await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{window.musicInstances=[];const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);if(String(args[0]).includes('the-last-of-us-main-menu'))musicInstances.push(a);return a;};e=structuredClone(e);e.intro={enabled:false};e.nodes=[];e.quests=[];e.testLocation=true;e.startSceneId=e.activeSceneId='scene-mvctoydb';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;ZargotaStoryPlayer.start(e);},e);
 await p.waitForFunction(()=>musicInstances.length===1&&!musicInstances[0].paused&&musicInstances[0].currentTime>=8);
 await p.evaluate(()=>{window.musicProbe=musicInstances[0];window.musicPauses=0;musicProbe.addEventListener('pause',()=>musicPauses++);});
 const ids=e.scenes.map(s=>s.id).filter(id=>id!=='scene-mvctoydb').concat('scene-mvctoydb');
 for(const id of ids){
  const before=await p.evaluate(()=>musicProbe.currentTime);
  await p.evaluate(id=>new Promise(resolve=>ZargotaStoryPlayer.travel(id,resolve)),id);
  const state=await p.evaluate(()=>({count:musicInstances.length,paused:musicProbe.paused,time:musicProbe.currentTime,pauses:musicPauses,scene:ZargotaStoryPlayer.getState().sceneId}));
  assert.equal(state.scene,id);assert.equal(state.count,1,'same audio element across scenes');assert.equal(state.paused,false);assert.equal(state.pauses,0);assert(state.time>before,'playhead must advance without seeking back to 8s');
  console.log('Continues:',id,state.time.toFixed(2));
 }
 console.log('PASS: every episode location, intermediate map and return to shore share one uninterrupted music instance.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
