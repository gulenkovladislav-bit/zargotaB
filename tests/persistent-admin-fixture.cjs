'use strict';
// Operator provisioning is exercised only against the isolated demo emulator.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
function provisionTestAdmin(options={}){
  const uid=options.uid||'test_admin_'+crypto.randomBytes(12).toString('hex');
  const output=path.join(os.tmpdir(),'zargota-admin-fixture-'+uid+'.json');
  try{
    execFileSync(process.execPath,[path.join(__dirname,'../functions/provision-admin.cjs'),'--project','demo-zargota-persistent','--uid',uid,'--output',output,...(options.code==null?[]:['--code',options.code])],{env:{...process.env,FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9190'},stdio:'pipe',timeout:15000});
    return JSON.parse(fs.readFileSync(output,'utf8'));
  }finally{if(fs.existsSync(output))fs.unlinkSync(output);}
}
module.exports={provisionTestAdmin};
