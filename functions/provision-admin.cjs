'use strict';
// Operator-only provisioning. This file is not exported as a callable function.
const D=require('./character-domain');
async function provisionAdmin(db,uid,chosenCode){
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(uid))throw Error('invalid-admin-uid');
  const requested=chosenCode==null?null:D.normalizeCode(chosenCode);
  if(requested!==null&&!/^(?:ZG[A-F0-9]{32}|[0-9]{4,12})$/.test(requested))throw Error('invalid-admin-code');
  const pin=requested&&/^\d+$/.test(requested)?requested:null;
  const recoveryCode=requested&&!pin?requested:D.code();
  const account=await db.ref('persistentCharacterAccounts/'+uid).transaction(old=>{
    if(!old)return {code:recoveryCode,createdAt:Date.now(),...(pin?{pinHash:D.hash(pin)}:{})};
    const prior=D.normalizeCode(old.code);
    if(/^\d+$/.test(prior)){
      if(requested!==null&&pin!==prior)return;
      return {...old,code:recoveryCode,pinHash:D.hash(prior)};
    }
    if(pin&&old.pinHash&&old.pinHash!==D.hash(pin)||requested&&!pin&&prior!==requested)return;
    return pin&&!old.pinHash?{...old,pinHash:D.hash(pin)}:old;
  });
  if(!account.committed)throw Error('Administrator already has a different code; it was not changed.');
  const code=account.snapshot.val().code;
  const index=db.ref('persistentCharacterCodes/'+D.hash(D.normalizeCode(code)));
  const reservation=await index.transaction(old=>!old||old.uid===uid&&old.kind==='master'?{uid,kind:'master'}:undefined);
  if(!reservation.committed)throw Error('Administrator code is already assigned to another account.');
  await db.ref('persistentCharacterAdmins/'+uid).set(true);
  return {uid,code};
}
module.exports={provisionAdmin};
if(require.main===module){
  (async()=>{
    const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
    if(!args.includes('--uid')||!args.includes('--project')||!args.includes('--output'))throw Error('Specify --uid, --project and --output. The code is written only to a private file.');
    const project=arg('--project'),uid=arg('--uid'),output=arg('--output'),emulator=!!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    if(emulator&&!project.startsWith('demo-'))throw Error('Emulator provisioning requires a demo project.');
    if(!emulator&&!args.includes('--production'))throw Error('Production provisioning requires explicit --production and operator credentials.');
    if(!emulator&&!args.includes('--database-url'))throw Error('Specify --database-url for production.');
    const fs=require('node:fs');if(fs.existsSync(output))throw Error('Output already exists; choose a new private file.');
    const {initializeApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
    const app=initializeApp({projectId:project,databaseURL:emulator?'https://'+project+'-default-rtdb.firebaseio.com':arg('--database-url')});
    const result=await provisionAdmin(getDatabase(app),uid,args.includes('--code')?arg('--code'):undefined);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
    console.log('Administrator provisioned; code saved to the private output file.');
  })().then(()=>process.exit(0),e=>{console.error(e.message);process.exit(1);});
}
