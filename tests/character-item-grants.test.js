'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../character-item-grants'),E=require('../item-economy'),D=require('../functions/character-domain');
const convert=E.definitionToInventorySnapshot;
const def={id:'potion',name:'Зелье',nameUk:'Зілля',desc:'Описание',descUk:'Опис',image:'images/potion.png',stackable:true};
test('grant and receipt share one valid sheet; retry is idempotent; customized copies untouched',()=>{
 const c={id:1,name:'Test',inventoryItems:[{itemId:'custom',name:'Custom',qty:3,equipped:true}]};
 assert.equal(G.apply(c,def,2,'grant-a',convert).changed,true);
 assert.equal(c.inventoryItems[0].qty,3);assert.equal(c.inventoryItems[1].qty,2);assert.equal(c.inventoryItems[1].equipped,false);
 assert.equal(c.inventoryItems[1].nameUk,'Зілля');assert.equal(G.pending(c)[0].qty,2);
 assert.equal(G.apply(c,def,2,'grant-a',convert).changed,false);assert.equal(c.inventoryItems.length,2);D.clean(c);
});
test('acknowledgement only clears chosen receipt, new grants retain unread deliveries',()=>{
 const c={id:1,name:'Test'};
 G.apply(c,def,1,'a',convert);G.apply(c,def,3,'b',convert);
 G.accept(c,['a','unknown']);assert.deepEqual(G.pending(c).map(x=>x.id),['b']);
 G.apply(c,def,1,'c',convert);assert.deepEqual(G.pending(c).map(x=>x.id),['b','c']);
 assert.equal(c.inventoryItems.length,3);D.clean(c);
});
test('nonstackable copies are separate; invalid quantity and capacity are nonmutating',()=>{
 const c={id:1,name:'Test'};G.apply(c,{...def,stackable:false},3,'a',convert);
 assert.equal(new Set(c.inventoryItems.map(i=>i.itemId)).size,3);assert.ok(c.inventoryItems.every(i=>i.qty===1));
 const before=JSON.stringify(c);assert.equal(G.apply(c,def,0,'b',convert).changed,false);assert.equal(JSON.stringify(c),before);
 c.inventoryItems=Array(1000).fill({name:'x'});assert.equal(G.apply(c,def,1,'b',convert).reason,'inventory-full');
});

test('minted coins credit their denomination, keep receipt and never become inventory',()=>{
 for(const [suffix,key] of Object.entries({copper:'copper',silver:'silver',gold:'gold',platinum:'platinum'})){
  const c={id:1,name:'Test',coins:{[key]:100},inventoryItems:[]};
  const r=G.apply(c,{...def,id:'shp_currency_'+suffix,category:'currency'},350,'coin-'+suffix,convert);
  assert.equal(c.coins[key],450);assert.equal(c.inventoryItems.length,0);assert.equal(r.receipt.currency,key);assert.equal(r.receipt.qty,350);D.clean(c);
  G.apply(c,{...def,id:'shp_currency_'+suffix},350,'coin-'+suffix,convert);assert.equal(c.coins[key],450);
 }
 const c={id:1,name:'Test'};G.apply(c,{...def,id:'magic-coin'},1,'magic',convert);assert.equal(c.inventoryItems.length,1);assert.equal(c.coins,undefined);
});
