'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const {getAuth}=require('firebase-admin/auth');
const crypto=require('node:crypto');
const D=require('./character-domain');
initializeApp(process.env.FIREBASE_DATABASE_EMULATOR_HOST?{projectId:process.env.GCLOUD_PROJECT,databaseURL:'https://'+process.env.GCLOUD_PROJECT+'-default-rtdb.firebaseio.com'}:undefined);
const db=getDatabase();
const options={region:'europe-west1',minInstances:0,maxInstances:3,timeoutSeconds:30,memory:'256MiB',
  serviceAccount:'zargota-character-sync@zargota-vtt.iam.gserviceaccount.com'};
async function isAdmin(uid){return (await db.ref('persistentCharacterAdmins/'+uid).get()).val()===true;}
async function requireAdmin(uid){if(!await isAdmin(uid))D.fail('access-denied');}
function validId(id){if(!/^[a-zA-Z0-9_-]{8,100}$/.test(String(id||'')))throw new HttpsError('invalid-argument','invalid-id');return id;}
async function mutate(ref,change){
  let failure;
  const result=await ref.transaction(current=>{failure=null;try{return change(current);}catch(e){failure=e;return undefined;}});
  if(failure)throw failure;
  if(!result.committed)throw new HttpsError('aborted','retry-save');
  return result;
}
function error(e){if(e instanceof HttpsError)return e;const c=e.code||e.message;return new HttpsError(c==='access-denied'?'permission-denied':c==='revision-conflict'?'failed-precondition':['invalid-character','invalid-operation','identity-change','operation-reused','character-too-large','unsafe-character-content'].includes(c)?'invalid-argument':'internal',['revision-conflict','access-denied','character-too-large','unsafe-character-content'].includes(c)?c:'character-operation-failed');}
async function register(sheetId,sheet){
  const values={};
  values['persistentCharacterUsers/'+sheet.meta.ownerUid+'/'+sheetId]='master';
  values['persistentCharacterUsers/'+sheet.meta.playerUid+'/'+sheetId]='player';
  values['persistentCharacterCodes/'+D.hash(D.normalizeCode(sheet.private.playerCode))]={uid:sheet.meta.playerUid,sheetId,kind:'player'};
  await db.ref().update(values);
}
exports.characterAccess=onCall(options,async request=>{
  const uid=request.auth&&request.auth.uid,input=request.data||{};
  if(!uid)throw new HttpsError('unauthenticated','sign-in-required');
  try{
    if(input.action==='account'){
      const admin=await isAdmin(uid),sheets=(await db.ref('persistentCharacterUsers/'+uid).get()).val()||{};
      return {uid,role:admin?'admin':Object.values(sheets).includes('player')?'player':'visitor'};
    }
    if(input.action==='login'){
      const key=D.hash(String(request.rawRequest.ip||uid));
      const rate=await db.ref('persistentLoginLimits/'+key).transaction(old=>{const now=Date.now(),v=old&&now-old.since<600000?old:{since:now,count:0};if(v.count>=40)return;return {since:v.since,count:v.count+1};});
      if(!rate.committed)throw new HttpsError('resource-exhausted','try-later');
      const normalized=D.normalizeCode(input.code);
      if(!/^(?:ZG[A-F0-9]{32}|[0-9]{4,12})$/.test(normalized))throw new HttpsError('permission-denied','invalid-code');
      if(/^\d+$/.test(normalized)){
        // A convenient PIN can resume the GM account only in a browser already paired to it.
        const account=(await db.ref('persistentCharacterAccounts/'+uid).get()).val();
        if(!account||account.pinHash!==D.hash(normalized)||!await isAdmin(uid))throw new HttpsError('permission-denied','invalid-code');
        return {token:await getAuth().createCustomToken(uid),sheetId:null};
      }
      const link=(await db.ref('persistentCharacterCodes/'+D.hash(normalized)).get()).val();
      if(!link)throw new HttpsError('permission-denied','invalid-code');
      if(link.kind==='player'){
        if(!/^ZG[A-F0-9]{32}$/.test(normalized))throw new HttpsError('permission-denied','invalid-code');
        const sheet=db.ref('persistentCharacters/'+link.sheetId);
        const [player,issuedCode]=await Promise.all([sheet.child('meta/playerUid').get(),sheet.child('private/playerCode').get()]);
        if(player.val()!==link.uid||D.normalizeCode(issuedCode.val())!==normalized)throw new HttpsError('permission-denied','invalid-code');
      }else if(link.kind==='master'){
        await requireAdmin(link.uid);
        const account=(await db.ref('persistentCharacterAccounts/'+link.uid).get()).val();
        if(!account||D.normalizeCode(account.code)!==normalized)throw new HttpsError('permission-denied','invalid-code');
      }else throw new HttpsError('permission-denied','invalid-code');
      return {token:await getAuth().createCustomToken(link.uid),sheetId:link.sheetId||null};
    }
    if(input.action==='master-code'){
      await requireAdmin(uid);
      const result=await db.ref('persistentCharacterAccounts/'+uid).transaction(old=>old||{code:D.code(),createdAt:Date.now()});
      const account=result.snapshot.val();
      await db.ref('persistentCharacterCodes/'+D.hash(D.normalizeCode(account.code))).set({uid,kind:'master'});
      return {code:account.code};
    }
    const id=validId(input.sheetId),ref=db.ref('persistentCharacters/'+id);
    if(input.action!=='create'){
      const membership=(await db.ref('persistentCharacterUsers/'+uid+'/'+id).get()).val();
      if(membership!=='master'&&membership!=='player')throw new HttpsError('permission-denied','access-denied');
      if((input.action==='code'||input.action==='review')&&membership!=='master')throw new HttpsError('permission-denied','access-denied');
    }
    if(input.action==='create'){
      await requireAdmin(uid);
      const playerCode=D.code(),playerUid='pc_'+crypto.randomBytes(16).toString('hex');
      const prepared=D.clean(input.character);
      const result=await mutate(ref,old=>{
        if(old){if(old.meta.ownerUid!==uid)D.fail('access-denied');return old;}
        return D.initial(prepared,uid,playerUid,playerCode,Date.now());
      });
      const sheet=result.snapshot.val();await register(id,sheet);
      return {sheetId:id,state:sheet.state,meta:sheet.meta,code:sheet.private.playerCode};
    }
    if(input.action==='save'){
      const result=await mutate(ref,sheet=>sheet===null?null:D.commit(sheet,uid,input,Date.now()));
      if(!result.snapshot.exists())D.fail('access-denied');
      return {state:result.snapshot.val().state};
    }
    if(input.action==='review'){
      const result=await mutate(ref,sheet=>{
        if(sheet===null)return null;
        if(D.role(sheet,uid)!=='master')D.fail('access-denied');
        const activity=sheet.activity||{},revision=Number(input.revision);
        if(!Number.isSafeInteger(revision)||revision<0||revision>(activity.lastPlayerRevision||0))throw new HttpsError('invalid-argument','invalid-review');
        sheet.activity=Object.assign({},activity,{seenRevision:Math.max(activity.seenRevision||0,revision)});return sheet;
      });
      if(!result.snapshot.exists())D.fail('access-denied');
      return {activity:result.snapshot.val().activity};
    }
    if(input.action==='visibility'){
      if(typeof input.locked!=='boolean')throw new HttpsError('invalid-argument','invalid-visibility');
      const result=await mutate(ref,sheet=>{if(sheet===null)return null;if(!D.role(sheet,uid))D.fail('access-denied');sheet.meta.locked=input.locked;return sheet;});
      if(!result.snapshot.exists())D.fail('access-denied');
      return {meta:result.snapshot.val().meta};
    }
    if(input.action==='code'){
      await requireAdmin(uid);
      if((await ref.child('meta/ownerUid').get()).val()!==uid)D.fail('access-denied');
      return {code:(await ref.child('private/playerCode').get()).val()};
    }
    throw new HttpsError('invalid-argument','unknown-action');
  }catch(e){throw error(e);}
});
