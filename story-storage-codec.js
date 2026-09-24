(function(w){
 'use strict';
 // Lossless dictionary of repeated subtrees; localStorage replacement stays atomic.
 function pack(value){
  const entries=[],known=new Map();
  function visit(v){
   if(v===null||typeof v!=='object'&&(typeof v!=='string'||v.length<100))return v;
   const key=JSON.stringify(v);if(known.has(key))return ['r',known.get(key)];
   const item=typeof v==='string'?['s',v]:Array.isArray(v)?['a',v.map(visit)]:['o',Object.keys(v).map(k=>[k,visit(v[k])])];
   const id=entries.length;entries.push(item);known.set(key,id);return ['r',id];
  }
  const root=visit(value);return JSON.stringify({zgStoryPacked:1,entries,root});
 }
 function unpack(value){
  if(!value||value.zgStoryPacked!==1)return value;
  if(!Array.isArray(value.entries))throw Error('Invalid story dictionary');
  function read(v,limit){
   if(!Array.isArray(v))return v;
   const id=v[1];if(v[0]!=='r'||!Number.isInteger(id)||id<0||id>=limit)throw Error('Invalid story reference');
   const item=value.entries[id];if(item[0]==='s')return item[1];
   if(item[0]==='a')return item[1].map(x=>read(x,id));
   if(item[0]!=='o')throw Error('Invalid story entry');
   const result={};for(const [k,x] of item[1])Object.defineProperty(result,k,{value:read(x,id),enumerable:true,writable:true,configurable:true});return result;
  }
  return read(value.root,value.entries.length);
 }
 w.ZargotaStoryStorageCodec={pack,unpack};
})(window);
