import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
const port=39882;const dir=mkdtempSync(path.join(os.tmpdir(),'wsj-api-test-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(port),APP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),SESSION_SECRET:crypto.randomBytes(32).toString('hex'),ADMIN_PASSWORD:'VeryStrongTestAdminPassword-2027',DATA_DIR:dir},stdio:'ignore'});
async function req(url,body){const r=await fetch(`http://127.0.0.1:${port}${url}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return [r.status,await r.json()];}
async function wait(){for(let i=0;i<40;i++){try{await req('/api/schema');return;}catch{await new Promise(r=>setTimeout(r,100));}}throw Error('server did not start');}
try{await wait();await test('public draft lifecycle and private CMT access',async()=>{
 let [status,created]=await req('/api/drafts',{role:'Youth Participants',dob:'2014-12-03',firstName:'Synthetic',surname:'Tester'});assert.equal(status,201);assert.ok(created.code.length>40);
 let [r1,draft]=await req('/api/drafts/resume',{reference:created.reference,code:created.code});assert.equal(r1,200);assert.equal(draft.values.F,'Synthetic');
 let [bad]=await req('/api/drafts/resume',{reference:created.reference,code:'incorrect'});assert.equal(bad,401);
 let [save,reply]=await req('/api/drafts/save',{reference:created.reference,code:created.code,values:{Z:'synthetic@example.test'},advance:false,section:0});assert.equal(save,200);assert.equal(reply.values.Z,'synthetic@example.test');
 let [submit,result]=await req('/api/drafts/submit',{reference:created.reference,code:created.code,values:{}});assert.equal(submit,422);assert.ok(result.errors.length>5);
 let [admin]=await req('/api/admin/list');assert.equal(admin,401);
 let [second]=await req('/api/drafts',{role:'Youth Participants',dob:'2016-09-13',firstName:'Second',surname:'Synthetic'});assert.equal(second,201);
 });}finally{child.kill();rmSync(dir,{recursive:true,force:true});}
