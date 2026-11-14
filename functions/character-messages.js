'use strict';
// Bounded private conversations, independent of character revisions and game rooms.
function fail(code){const error=new Error(code);error.code=code;throw error;}
function append(current,input,uid,role,now){
  if(!['master','player'].includes(role))fail('access-denied');
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>500)fail('invalid-message');
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(input.messageId||''))fail('invalid-message');
  const thread=JSON.parse(JSON.stringify(current||{}));
  const messages=thread.messages||(thread.messages={});
  const previous=messages[input.messageId];
  if(previous){
    if(previous.senderUid!==uid||previous.text!==input.text.trim())fail('invalid-message');
    return thread;
  }
  const own=Object.values(messages).filter(m=>m.senderUid===uid);
  if(own.some(m=>now-m.createdAt<1000))fail('message-rate-limit');
  messages[input.messageId]={text:input.text.trim(),senderUid:uid,role,createdAt:now};
  const ids=Object.keys(messages).sort((a,b)=>messages[a].createdAt-messages[b].createdAt||a.localeCompare(b));
  ids.slice(0,Math.max(0,ids.length-50)).forEach(id=>delete messages[id]);
  return thread;
}
module.exports={append};
