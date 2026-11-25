import test from 'node:test';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {normalize,validateAll,visible,required,options,publicSections} from '../rules.mjs';
const root=path.dirname(fileURLToPath(new URL('../server.mjs',import.meta.url)));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wsj-e2e-'));const port=39894;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),APP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),SESSION_SECRET:crypto.randomBytes(32).toString('hex'),CMT_ADMIN_EMAIL:'owner@example.test',CMT_ADMIN_PASSWORD:'StrongAdminPassword123!',DATA_DIR:dir,EXPORT_DROPDOWN_MODE:'label',EXPORT_VERIFIED:'no'},stdio:'ignore'});
let cookie='';
async function request(url,dat){let res=await fetch(`http://127.0.0.1:${port}${url}`,{method:dat===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:dat===undefined?undefined:JSON.stringify(dat)});if(res.headers.get('set-cookie')?.startsWith('wsj_admin='))cookie=res.headers.get('set-cookie').split(';')[0];return [res.status,res.headers.get('content-type')?.includes('json')?await res.json():Buffer.from(await res.arrayBuffer())]}
async function ready(){for(let i=0;i<50;i++){try{if((await request('/api/schema'))[0]===200)return;}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server startup');}
function sample(){const v={A:'International Service Team',F:'Synthetic',G:'Adult',M:'1988-04-12','form_only.consent':true,'form_only.completed_by':'Self','form_only.guardian_authority':true,AA:'+27721234567',DV:'+27721234567',BO:'+27721234567','form_only.previous_jamboree':'No','form_only.language_french':'No','form_only.language_spanish':'No','form_only.language_arabic':'No','form_only.regular_medication':'No','form_only.mobility_needs_screen':'No','form_only.disability_screen':'No','form_only.nationality_changed':'No','form_only.additional_nationalities':'No','form_only.has_employer':'No','form_only.emergency_address_reuse':'No',ED:'No',EG:'No',FP:'No',FT:'No',FU:'Unknown',FW:'Unknown',FZ:'No',CM:'No',CW:'No',CZ:'No',CL:'I am not a student'};
 for(let pass=0;pass<3;pass++)for(const s of publicSections)for(const q of s.questions){const c=q.excel_column;if(!c||!visible(c,v)||!required(c,v)||String(v[c]??'').trim())continue;const choices=options(c);v[c]=choices?.length?(choices.includes('No')?'No':choices.includes('Unknown')?'Unknown':choices[0]):(['M','BZ','CA','FV','FX'].includes(c)?'2027-01-01':c==='Z'||c==='DU'?'test@example.invalid':'Synthetic Value');}
 return v;}
try{await ready();await test('complete public registration, locking and template-based private preview',async()=>{
 const v=sample();assert.deepEqual(validateAll(normalize(v)),[]);
 let [c,create]=await request('/api/drafts',{role:v.A,firstName:v.F,surname:v.G,dob:v.M});assert.equal(c,201);
 let [save]=await request('/api/drafts/save',{reference:create.reference,code:create.code,values:v,advance:false,section:0});assert.equal(save,200);
 let [check,r]=await request('/api/drafts/check',{reference:create.reference,code:create.code,values:v});assert.equal(check,200);assert.deepEqual(r.issues,[]);
 let [done,d]=await request('/api/drafts/submit',{reference:create.reference,code:create.code,values:v});assert.equal(done,200);assert.equal(d.submitted,true);
 assert.equal((await request('/api/drafts/resume',{reference:create.reference,code:create.code}))[0],401);
 let [admin]=await request('/api/admin/login',{email:'owner@example.test',password:'StrongAdminPassword123!'});assert.equal(admin,200);
 let [exportCode,blob]=await request('/api/admin/export/preview',{});assert.equal(exportCode,200);assert.equal(blob.subarray(0,2).toString(),'PK');assert.ok(blob.length>200000);
 let [prod]=await request('/api/admin/export',{});assert.equal(prod,409);
 });}finally{child.kill();fs.rmSync(dir,{force:true,recursive:true});}
