import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {polishDateTimeFromSouthAfrica} from './timezone.mjs';
import {columns,fieldMap,publicSchema,normalize,validateSection,validateAll,assertSchema} from './rules.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
assertSchema();
const PORT=Number(process.env.PORT||3000);const HOST=process.env.HOST||'127.0.0.1';
const DATA_DIR=process.env.DATA_DIR||path.join(root,'data');fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(DATA_DIR,'wsj.sqlite'));
const roles=fieldMap.A.options.map(o=>o.label);
function patrols(){return JSON.parse(fs.readFileSync(path.join(root,'config','patrols.json'),'utf8'));}
function savePatrols(p){fs.writeFileSync(path.join(DATA_DIR,'patrols.json'),JSON.stringify(p,null,2));}
function activePatrols(){const f=path.join(DATA_DIR,'patrols.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):patrols();}
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS registrations(id INTEGER PRIMARY KEY,reference TEXT UNIQUE NOT NULL, resume_hash TEXT NOT NULL, resume_expires TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft', encrypted_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT);CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, registration_id INTEGER, action TEXT NOT NULL, timestamp TEXT NOT NULL, note TEXT);CREATE TABLE IF NOT EXISTS export_runs(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,record_count INTEGER NOT NULL,mode TEXT NOT NULL,note TEXT NOT NULL);CREATE TABLE IF NOT EXISTS cmt_users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS cmt_sessions(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,token_hash TEXT UNIQUE NOT NULL,expires_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS field_overrides(column_id TEXT PRIMARY KEY, label TEXT NOT NULL); `);
const secret=process.env.APP_ENCRYPTION_KEY||'';if(!/^[0-9a-fA-F]{64}$/.test(secret))throw Error('APP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
const key=Buffer.from(secret,'hex');
const adminPassword=process.env.CMT_ADMIN_PASSWORD||process.env.ADMIN_PASSWORD||'';if(adminPassword.length<14)throw Error('CMT_ADMIN_PASSWORD must contain at least 14 characters');
const bootstrapEmail=(process.env.CMT_ADMIN_EMAIL||'cmt-staging@example.invalid').toLowerCase();if(process.env.NODE_ENV==='production' && bootstrapEmail.endsWith('@example.invalid'))throw Error('CMT_ADMIN_EMAIL must be explicitly set for production');
function passwordHash(pw,salt=crypto.randomBytes(16).toString('hex')){return `${salt}:${crypto.scryptSync(pw,salt,64).toString('hex')}`;}
function passwordCheck(pw,encoded){try{const [salt,hex]=encoded.split(':');return safe(crypto.scryptSync(pw,salt,64).toString('hex'),hex);}catch{return false;}}
if(!db.prepare('SELECT id FROM cmt_users LIMIT 1').get())db.prepare('INSERT INTO cmt_users(email,password_hash,role,created_at) VALUES (?,?,?,?)').run(bootstrapEmail,passwordHash(adminPassword),'owner',new Date().toISOString());
const sessionSecret=process.env.SESSION_SECRET||'';if(sessionSecret.length<32)throw Error('SESSION_SECRET must contain at least 32 characters');
const log=(id,action,note='')=>db.prepare('INSERT INTO audit(registration_id,action,timestamp,note) VALUES (?,?,?,?)').run(id,action,new Date().toISOString(),note);
function seal(data){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),enc]).toString('base64');}
function unseal(data){const b=Buffer.from(data,'base64');const cipher=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString());}
function hash(t){return crypto.createHash('sha256').update(t).digest('hex');}
function safe(a,b){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function send(res,code,payload,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(payload));}
function deny(res,code=403,message='Access denied'){send(res,code,{error:message});}
async function body(req){let raw='';for await(const c of req){raw+=c;if(raw.length>500000)throw Error('Payload too large');}return JSON.parse(raw||'{}');}
function getRow(ref){return db.prepare('SELECT * FROM registrations WHERE reference=?').get(ref);}
function authorized(row,code){if(!row||!['Draft','Needs correction'].includes(row.status)||new Date(row.resume_expires)<new Date()||!code)return false;return safe(row.resume_hash,hash(code));}
function stamp(){return new Date().toISOString();}
function adminCookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wsj_admin='))?.slice(10)||'';}
function adminSession(req){const token=adminCookie(req);if(!token||token.length!==64)return null;const row=db.prepare('SELECT u.id,u.email,u.role,s.expires_at FROM cmt_sessions s JOIN cmt_users u ON s.user_id=u.id WHERE s.token_hash=? AND u.active=1').get(hash(token));return row&&row.expires_at>stamp()?row:null;}
function adminValid(req){return Boolean(adminSession(req));}
function adminRole(req,allowed){const user=adminSession(req);return user&&allowed.includes(user.role);}
const medicalColumns=new Set(columns.slice(columns.indexOf('EC'),columns.indexOf('GO')+1));
function redactRecord(data,privileged){if(privileged)return data;const copy={...data};for(const col of medicalColumns)delete copy[col];for(const k of Object.keys(copy))if(k.startsWith('form_only.')&&/healthcare|mobility|disability|medication/i.test(k))delete copy[k];return copy;}
const attempts=new Map();function throttle(req){const proxyLoopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);const forwarded=String(req.headers['x-real-ip']||'');const ip=proxyLoopback&&/^[0-9a-fA-F:.]+$/.test(forwarded)?forwarded:(req.socket.remoteAddress||'unknown');const now=Date.now();const old=attempts.get(ip)||{count:0,ts:now};if(now-old.ts>60000){old.count=0;old.ts=now;}old.count++;attempts.set(ip,old);if(attempts.size>10000){for(const [k,v] of attempts)if(now-v.ts>60000)attempts.delete(k);}return old.count>90;}
const isProd=process.env.NODE_ENV==='production';
function checkOrigin(req){const origin=req.headers.origin;if(!origin)return true;const host=req.headers.host;try{return new URL(origin).host===host;}catch{return false;}}
function credential(req,dat){return dat?.code || req.headers['x-resume-code'];}
function cacheFile(res,name){const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};const ext=path.extname(name);const p=path.join(root,'public',name);if(!fs.existsSync(p)){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});fs.createReadStream(p).pipe(res);}
async function exportXlsx(records){
 const rows=records.map(r=>{const raw=unseal(r.encrypted_data);const v={...normalize(raw)};if(raw.CY!==undefined)v.CY=raw.CY;
 if(v.AF==='Other'&&raw['form_only.native_language_other'])v.AF=raw['form_only.native_language_other'];
 if(v.BP==='Other'&&raw['form_only.guardian_language_other'])v.BP=raw['form_only.guardian_language_other'];
 for(const c of columns.slice(columns.indexOf('DB'),columns.indexOf('DN')+1))if(raw[c]!==undefined)v[c]=raw[c];
 for(const [datecol,timecol] of [['DE','DF'],['DK','DL']]){const converted=polishDateTimeFromSouthAfrica(v[datecol],v[timecol]);if(converted){v[datecol]=converted.date;v[timecol]=converted.time;}}
 const out={};for(const col of columns){let value=v[col]??'';const f=fieldMap[col];if(f.options?.length){const selected=f.options.find(o=>o.label===value);if(selected)value=process.env.EXPORT_DROPDOWN_MODE==='uuid'?selected.export_key:selected.label;}
 out[col]=String(value);}
 return out;});
 const request=JSON.stringify({rows,columns});
 return await new Promise((resolve,reject)=>{const proc=spawn('python3',[path.join(root,'export_template.py')],{cwd:root,stdio:['pipe','pipe','pipe']});
 let output=[],stderr='',total=0;proc.stdout.on('data',c=>{total+=c.length;if(total>100*1024*1024){proc.kill();reject(Error('Export exceeds size limit'));}else output.push(c);});
 proc.stderr.on('data',c=>stderr+=String(c).slice(0,2000));proc.on('error',reject);proc.on('close',code=>code===0?resolve(Buffer.concat(output)):reject(Error('Export generation failed: '+stderr.slice(0,1000))));proc.stdin.end(request);
 });
}
async function main(req,res){try{
 if(['GET','HEAD'].includes(req.method) && ['/', '/register','/cmt','/cmt/form-builder'].includes(req.url||''))return cacheFile(res,'index.html');
 if(['GET','HEAD'].includes(req.method) && ['/app.js','/app.css'].includes(req.url||''))return cacheFile(res,req.url.slice(1));
 if(!req.url.startsWith('/api/'))return deny(res,404,'Not found');
 if(throttle(req))return deny(res,429,'Too many requests; retry shortly');
 if(req.method!=='GET'&&!checkOrigin(req))return deny(res,403,'Request origin mismatch');
 if(req.method==='GET'&&req.url==='/api/countries')return send(res,200,{countries:fieldMap.Y.options.map(x=>x.label)});
 if(req.method==='GET'&&req.url==='/api/schema'){const override=Object.fromEntries(db.prepare('SELECT column_id,label FROM field_overrides').all().map(x=>[x.column_id,x.label]));const sections=publicSchema.map(sec=>({...sec,questions:sec.questions.map(q=>({...q,label:override[q.column]||q.label,adminLabel:override[q.column]||null}))}));return send(res,200,{sections,roles,patrols:activePatrols(),minorReferenceDate:process.env.MINOR_REFERENCE_DATE||null});}
 if(req.method==='POST'&&req.url==='/api/drafts'){
  const dat=await body(req);const values={A:dat.role||'',M:dat.dob||'',F:dat.firstName||'',G:dat.surname||'',Y:'South Africa',CB:'South Africa',BV:'South Africa',EB:'South Africa',BM:'South African',DT:'South African',AA:'+27','form_only.completed_by':dat.completedBy||''};if(!fieldMap.A.options.some(o=>o.label===values.A))return deny(res,422,'Choose a valid registration role');const names=activePatrols();if((names[values.A]||[]).length && !names[values.A].includes(dat.patrol))return deny(res,422,'Choose a valid patrol/team');values.E=dat.patrol||'';
  const reference=`WSJ-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;const code=crypto.randomBytes(32).toString('base64url');const now=stamp();const expiry=new Date(Date.now()+30*86400000).toISOString();
  const r=db.prepare('INSERT INTO registrations(reference,resume_hash,resume_expires,status,encrypted_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(reference,hash(code),expiry,'Draft',seal(values),now,now);log(r.lastInsertRowid,'created');
  return send(res,201,{reference,code,expires:expiry,values});
 }
 if(req.method==='POST'&&req.url==='/api/drafts/resume'){
  const dat=await body(req);const r=getRow(dat.reference);if(!authorized(r,credential(req,dat)))return deny(res,401,'Invalid, expired, revoked, or submitted resume credential');
  return send(res,200,{reference:r.reference,status:r.status,values:unseal(r.encrypted_data),expires:r.resume_expires});
 }
 if(req.method==='POST'&&req.url==='/api/drafts/save'){
  const dat=await body(req);const r=getRow(dat.reference);if(!authorized(r,credential(req,dat)))return deny(res,401,'Invalid or expired draft credential');
  const v=normalize({...unseal(r.encrypted_data),...dat.values});if(!fieldMap.A.options.some(o=>o.label===v.A))return deny(res,422,'Missing role');
  if(dat.advance){const errors=validateSection(v,dat.section);if(errors.length)return send(res,422,{errors});}
  db.prepare('UPDATE registrations SET encrypted_data=?,updated_at=? WHERE id=?').run(seal(v),stamp(),r.id);log(r.id,'saved',String(dat.section??''));
  return send(res,200,{saved:true,values:v});
 }
 if(req.method==='POST'&&req.url==='/api/drafts/check'){const dat=await body(req);const r=getRow(dat.reference);if(!authorized(r,credential(req,dat)))return deny(res,401,'Invalid draft credentials');const v=normalize({...unseal(r.encrypted_data),...dat.values});return send(res,200,{issues:validateAll(v),sectionCount:publicSchema.length});}
 if(req.method==='POST'&&req.url==='/api/drafts/submit'){
  const dat=await body(req);const r=getRow(dat.reference);if(!authorized(r,credential(req,dat)))return deny(res,401,'Invalid or expired credential');
  const v=normalize({...unseal(r.encrypted_data),...dat.values});const errors=validateAll(v);if(errors.length)return send(res,422,{errors});
  db.prepare("UPDATE registrations SET encrypted_data=?,status='Submitted',resume_hash=?,resume_expires=?,submitted_at=?,updated_at=? WHERE id=?").run(seal(v),hash(crypto.randomBytes(32).toString('hex')),stamp(),stamp(),stamp(),r.id);log(r.id,'submitted');
  return send(res,200,{submitted:true,reference:r.reference});
 }
 if(req.method==='POST'&&req.url==='/api/admin/login'){
  const dat=await body(req);const email=String(dat.email||bootstrapEmail).trim().toLowerCase();const user=db.prepare('SELECT * FROM cmt_users WHERE email=? AND active=1').get(email);if(!user||!passwordCheck(String(dat.password||''),user.password_hash))return deny(res,401,'Invalid credentials');
  const token=crypto.randomBytes(32).toString('hex'),expire=new Date(Date.now()+8*3600000).toISOString();db.prepare('INSERT INTO cmt_sessions(user_id,token_hash,expires_at) VALUES (?,?,?)').run(user.id,hash(token),expire);log(null,'cmt_login',email);return send(res,200,{ok:true,role:user.role,email:user.email},{'Set-Cookie':`wsj_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${isProd?'; Secure':''}`});
 }
 if(req.method==='POST'&&req.url==='/api/admin/logout'){const token=adminCookie(req);if(token)db.prepare('DELETE FROM cmt_sessions WHERE token_hash=?').run(hash(token));return send(res,200,{ok:true},{'Set-Cookie':`wsj_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isProd?'; Secure':''}`});}
 if(req.url.startsWith('/api/admin/')&&!adminValid(req))return deny(res,401,'CMT administrator login required');
 if(req.method==='GET'&&req.url==='/api/admin/form-fields')return send(res,200,{fields:publicSchema.flatMap(s=>s.questions.map(q=>({section:s.section,column:q.column,label:q.label,original:fieldMap[q.column]?.field,kind:fieldMap[q.column]?.type})))});
 if(req.method==='POST'&&req.url==='/api/admin/form-fields'){if(!adminRole(req,['owner']))return deny(res);const dat=await body(req);if(!fieldMap[dat.column]||typeof dat.label!=='string'||!dat.label.trim()||dat.label.length>150)return deny(res,422,'Invalid field or label');db.prepare('INSERT INTO field_overrides(column_id,label) VALUES(?,?) ON CONFLICT(column_id) DO UPDATE SET label=excluded.label').run(dat.column,dat.label.trim());log(null,'label_updated',dat.column);return send(res,200,{saved:true});}
 if(req.method==='GET'&&req.url==='/api/admin/me')return send(res,200,{user:adminSession(req)});
 if(req.method==='GET'&&req.url==='/api/admin/users'){if(!adminRole(req,['owner']))return deny(res);return send(res,200,{users:db.prepare('SELECT id,email,role,active,created_at FROM cmt_users ORDER BY id').all()});}
 if(req.method==='POST'&&req.url==='/api/admin/users'){if(!adminRole(req,['owner']))return deny(res);const d=await body(req);const email=String(d.email||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!['owner','reviewer','medical','exporter'].includes(d.role)||String(d.password||'').length<14)return deny(res,422,'Valid email, role and password of 14+ characters required');try{db.prepare('INSERT INTO cmt_users(email,password_hash,role,created_at) VALUES (?,?,?,?)').run(email,passwordHash(d.password),d.role,stamp());log(null,'cmt_user_created',email);return send(res,201,{created:true});}catch{return deny(res,409,'Email already exists');}}
 if(req.method==='GET'&&req.url==='/api/admin/patrols')return send(res,200,{patrols:activePatrols()});
 if(req.method==='POST'&&req.url==='/api/admin/patrols'){if(!adminRole(req,['owner','reviewer']))return deny(res);const dat=await body(req);if(!roles.includes(dat.role)||!Array.isArray(dat.names)||dat.names.length>100||!dat.names.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<100))return deny(res,422,'Invalid role or patrol list');const p=activePatrols();p[dat.role]=[...new Set(dat.names.map(x=>x.trim()))];savePatrols(p);log(null,'patrols_updated',dat.role);return send(res,200,{patrols:p});}
 if(req.method==='GET'&&req.url==='/api/admin/list'){
  const rows=db.prepare('SELECT id,reference,status,encrypted_data,created_at,updated_at,submitted_at FROM registrations ORDER BY id DESC').all();
  return send(res,200,{records:rows.map(r=>{const v=unseal(r.encrypted_data);return {reference:r.reference,status:r.status,name:[v.F,v.G].filter(Boolean).join(' '),role:v.A,created:r.created_at,updated:r.updated_at,missing:validateAll(normalize(v)).length};})});
 }
 if(req.method==='POST'&&req.url==='/api/admin/record'){
  const dat=await body(req);const row=getRow(dat.reference);if(!row)return deny(res,404,'Record not found');return send(res,200,{reference:row.reference,status:row.status,values:redactRecord(unseal(row.encrypted_data),adminRole(req,['owner','medical']))});
 }
 if(req.method==='POST'&&req.url==='/api/admin/update') {if(!adminRole(req,['owner','reviewer']))return deny(res);const dat=await body(req);const r=getRow(dat.reference);if(!r)return deny(res,404,'Record not found');const travel=columns.slice(columns.indexOf('DD'),columns.indexOf('DN')+1);const allowed=['E','CY',...travel];const patch=Object.fromEntries(Object.entries(dat.values||{}).filter(([k,v])=>allowed.includes(k)&&typeof v==='string'&&v.length<200));const v={...unseal(r.encrypted_data),...patch};db.prepare('UPDATE registrations SET encrypted_data=?,updated_at=? WHERE id=?').run(seal(v),stamp(),r.id);log(r.id,'admin_updated',Object.keys(patch).join(','));return send(res,200,{updated:true});}
 if(req.method==='POST'&&req.url==='/api/admin/correction-code'){if(!adminRole(req,['owner','reviewer']))return deny(res);const dat=await body(req);const r=getRow(dat.reference);if(!r||r.status!=='Needs correction')return deny(res,422,'Record must have Needs correction status');const code=crypto.randomBytes(32).toString('base64url');const expiry=new Date(Date.now()+14*86400000).toISOString();db.prepare('UPDATE registrations SET resume_hash=?,resume_expires=?,updated_at=? WHERE id=?').run(hash(code),expiry,stamp(),r.id);log(r.id,'correction_code_issued');return send(res,200,{reference:r.reference,code,expires:expiry,warning:'Share code securely with participant. Shown once only.'});}
 if(req.method==='POST'&&req.url==='/api/admin/status'){if(!adminRole(req,['owner','reviewer']))return deny(res);const dat=await body(req);const r=getRow(dat.reference);if(!r)return deny(res,404,'Record not found');const allowed={Draft:['Needs correction'],Submitted:['Needs correction','Approved'], 'Needs correction':['Approved','Submitted'],Approved:['Exported','Needs correction'],Exported:[]};if(!(allowed[r.status]||[]).includes(dat.status))return deny(res,422,'Invalid status transition');if(dat.status==='Approved'){const v=unseal(r.encrypted_data);if(!String(v.E||'').trim())return deny(res,422,'Assign a patrol/team before approving.');}db.prepare('UPDATE registrations SET status=?,updated_at=? WHERE id=?').run(dat.status,stamp(),r.id);log(r.id,'status_'+dat.status);return send(res,200,{status:dat.status});}
 if(req.method==='GET'&&req.url==='/api/admin/audit'){const rows=db.prepare('SELECT registration_id,action,timestamp,note FROM audit ORDER BY id DESC LIMIT 100').all();return send(res,200,{events:rows});}
 if(req.method==='GET'&&req.url==='/api/admin/export/check')return send(res,200,{columns:197,template:'Template 26th WSJ Data.xlsx',mappingMode:process.env.EXPORT_DROPDOWN_MODE||'unconfirmed',productionReady:process.env.EXPORT_VERIFIED==='yes',warning:'Poland importer UUID-vs-label semantics and health/accessibility column values require authority verification.'});
 if(req.method==='POST'&&req.url==='/api/admin/export/preview'){if(!adminRole(req,['owner','exporter']))return deny(res);const rows=db.prepare("SELECT encrypted_data FROM registrations WHERE status IN ('Submitted','Approved','Exported') ORDER BY id").all();if(!rows.length)return deny(res,422,'No submitted registrations to preview');const buffer=await exportXlsx(rows);db.prepare('INSERT INTO export_runs(created_at,record_count,mode,note) VALUES (?,?,?,?)').run(stamp(),rows.length,process.env.EXPORT_DROPDOWN_MODE||'label','TEST PREVIEW ONLY: importer format unverified');res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=WSJ-UNVERIFIED-PREVIEW.xlsx','Cache-Control':'no-store','X-Export-Status':'UNVERIFIED'});return res.end(buffer);}
 if(req.method==='POST'&&req.url==='/api/admin/export'){if(!adminRole(req,['owner','exporter']))return deny(res);
  const dat=await body(req);if(process.env.EXPORT_VERIFIED!=='yes')return deny(res,409,'Production XLSX export is blocked pending importer mapping verification. Set EXPORT_VERIFIED=yes only after a template round-trip test.');
  const rows=db.prepare("SELECT id,encrypted_data FROM registrations WHERE status='Approved' ORDER BY id").all();if(!rows.length)return deny(res,422,'No approved registrations');if(rows.some(r=>!String(unseal(r.encrypted_data).E||'').trim()))return deny(res,422,'At least one approved record is missing Patrol/Team ID');
  const buffer=await exportXlsx(rows);db.prepare('INSERT INTO export_runs(created_at,record_count,mode,note) VALUES (?,?,?,?)').run(stamp(),rows.length,process.env.EXPORT_DROPDOWN_MODE||'label','verified production export');for(const row of rows){db.prepare("UPDATE registrations SET status='Exported',updated_at=? WHERE id=?").run(stamp(),row.id);log(row.id,'exported');}res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="WSJ-Poland-Import.xlsx"','Cache-Control':'no-store'});return res.end(buffer);
 }
 return deny(res,404,'Unknown API endpoint');
 }catch(e){console.error(e);return send(res,500,{error:'Unexpected server error'});}}
http.createServer(main).listen(PORT,HOST,()=>console.log(`WSJ self-hosted listening on ${HOST}:${PORT}`));
