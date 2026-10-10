const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const prefs=new Map(),scripts=[],calls=[];let retry;const window={location:{protocol:'file:',href:'file:///project/index.html'}};
const context={window,URL,localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v),removeItem:k=>prefs.delete(k)},document:{createElement:()=>({remove(){}}),head:{append:s=>scripts.push(s)}},setInterval:fn=>{retry=fn;return 1},clearInterval(){},setTimeout(){},AbortSignal,fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({job:null})}}};
vm.runInNewContext(fs.readFileSync('story-exchange.js','utf8'),context);
const api={};window.ZargotaStoryExchange.autoConnect(api);assert.equal(scripts.length,1);assert(scripts[0].src.startsWith('file:///project/.story-exchange/connection.js?'));
window.__zgLocalExchangeKey='a'.repeat(64);scripts[0].onload();assert.equal(calls.length,1);assert.equal(calls[0].opts.headers.Authorization,'Bearer '+'a'.repeat(64));assert.equal(window.__zgLocalExchangeKey,undefined);
window.ZargotaStoryExchange.stop(true);retry();assert.equal(scripts.length,1,'explicit disconnect disables retries');prefs.clear();retry();assert.equal(scripts.length,2);scripts[1].onerror();retry();assert.equal(scripts.length,3,'missing key file can be retried');
console.log('PASS local file credential handoff, auto connection, explicit opt-out and retry.');
