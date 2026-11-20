'use strict';
const crypto=require('node:crypto');
const D=require('./character-domain');
// Keep legacy recovery codes valid; issue a unique, persistent four-digit player alias.
async function playerCode(db,sheetId,sheet){
  const privateRef=db.ref('persistentCharacters/'+sheetId+'/private/playerPin');
  const existing=(await privateRef.get()).val();if(existing)return existing;
  for(let attempt=0;attempt<200;attempt++){
    const pin=String(crypto.randomInt(1000,10000));if(pin==='7777')continue;
    const index=db.ref('persistentCharacterCodes/'+D.hash(pin));
    const link={uid:sheet.meta.playerUid,sheetId,kind:'player'};
    const claim=await index.transaction(old=>old===null?link:undefined);
    if(!claim.committed)continue;
    const result=await privateRef.transaction(old=>old||pin),chosen=result.snapshot.val();
    if(chosen!==pin)await index.transaction(old=>old&&old.uid===link.uid&&old.sheetId===sheetId?null:undefined);
    return chosen;
  }
  D.fail('player-code-capacity');
}
module.exports={playerCode};
