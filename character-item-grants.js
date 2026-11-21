/* A grant and its receipt travel atomically inside the existing persistent sheet. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaItemGrants=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var clone=function(v){return JSON.parse(JSON.stringify(v));};
 function pending(c){var seen=c.gmItemAccepted||{};return (c.gmItemGrants||[]).filter(function(r){return r&&r.id&&!seen[r.id];});}
 function currency(item){return ({shp_currency_copper:'copper',shp_currency_silver:'silver',shp_currency_gold:'gold',shp_currency_platinum:'platinum'})[String(item.definitionId||item.catalogItemId||item.id||'')]||'';}
 function apply(c,definition,qty,id,convert){
  qty=Number(qty);
  if(!definition||!definition.id||typeof convert!=='function')return {changed:false,reason:'unknown-item'};
  if(!Number.isInteger(qty)||qty<1||qty>999)return {changed:false,reason:'invalid-quantity'};
  if(!/^[-a-zA-Z0-9_]+$/.test(id||''))return {changed:false,reason:'invalid-grant'};
  if((c.gmItemGrants||[]).some(function(r){return r.id===id;}))return {changed:false,reason:'already-granted'};
  if(pending(c).length>=200)return {changed:false,reason:'receipt-limit'};
  var money=currency(definition),items=c.inventoryItems||[],single=definition.stackable===false,count=single?qty:1;
  if(!money&&items.length+count>1000)return {changed:false,reason:'inventory-full'};
  if(money&&!Number.isSafeInteger((Number(c.coins?.[money])||0)+qty))return {changed:false,reason:'invalid-quantity'};
  var additions=[];
  for(var i=0;i<count;i++){
   var item=convert(definition,'gm-item-'+id+'-'+i,single?1:qty);
   item.image=definition.image||definition.imageThumb||'';
   if(definition.nameUk)item.nameUk=definition.nameUk;
   if(definition.descriptionUk||definition.descUk)item.descriptionUk=definition.descriptionUk||definition.descUk;
   item.description=definition.description||definition.desc||item.description||'';
   item.equipped=false;additions.push(item);
  }
  var display=additions[0];
  var receipt={id:id,at:Date.now(),itemId:display.itemId,definitionId:String(definition.id),name:display.name,nameUk:display.nameUk,description:display.description,descriptionUk:display.descriptionUk,image:display.image||'',icon:display.icon||'',qty:qty};
  // Never overwrite customized/equipped copies. Each grant is its own stack.
  if(money){c.coins=Object.assign({},c.coins);c.coins[money]=(Number(c.coins[money])||0)+qty;receipt.currency=money;}
  else c.inventoryItems=items.concat(additions);
  c.gmItemGrants=pending(c).concat(receipt);
  c.gmItemAccepted={};
  return {changed:true,reason:'added',receipt:clone(receipt)};
 }
 function accept(c,ids){
  var known=new Set((c.gmItemGrants||[]).map(function(r){return r.id;})),next=Object.assign({},c.gmItemAccepted),changed=false;
  ids.forEach(function(id){if(known.has(id)&&!next[id]){next[id]=true;changed=true;}});
  if(changed)c.gmItemAccepted=next;
  return changed;
 }
 return {apply:apply,pending:pending,accept:accept,currency:currency};
});
