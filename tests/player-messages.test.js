'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{append}=require('../functions/character-messages');
const message={messageId:'message_fixture_0001',text:'  Привет  '};
test('messages are private, bounded and independent of sheet data',()=>{
  assert.throws(()=>append(null,message,'outsider',null,1000),/access-denied/);
  for(const text of ['', '  ', 'x'.repeat(501), {text:'x'}])assert.throws(()=>append(null,{...message,text},'gm','master',1000),/invalid-message/);
  assert.throws(()=>append(null,{...message,messageId:'../x'},'gm','master',1000),/invalid-message/);
  const first=append(null,message,'gm','master',1000);assert.equal(first.messages[message.messageId].text,'Привет');
  assert.deepEqual(append(first,message,'gm','master',1001),first);
  assert.throws(()=>append(first,{...message,text:'changed'},'gm','master',2000),/invalid-message/);
  assert.throws(()=>append(first,message,'player','player',2000),/invalid-message/);
  assert.throws(()=>append(first,{...message,messageId:'message_fixture_0002'},'gm','master',1500),/message-rate-limit/);
  let thread={...first,read:{gm:1000}};
  for(let n=2;n<55;n++)thread=append(thread,{messageId:'message_fixture_'+String(n).padStart(4,'0'),text:'Hi'},'gm','master',n*1100);
  assert.equal(Object.keys(thread.messages).length,50);assert.equal(thread.read.gm,1000);assert.equal(Object.keys(first.messages).length,1);
});
