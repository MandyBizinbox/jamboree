import fs from 'node:fs';
const specification = JSON.parse(fs.readFileSync(new URL('./config/approved-v15.json', import.meta.url)));
export const columns = specification.fields.map(f=>f.column);
export const fieldMap = Object.fromEntries(specification.fields.map(f=>[f.column,f]));
export const bySection = specification.review_sections;
const extraRequired = new Set(['A','B','E','F','G','H','M','N','O','P','Q','R','S','T','V','W','X','Y','Z','AA','AF','AG','AH','AI','AJ','AW','AX','AY','AZ','BA','BB','BC','BE','BW','BY','BZ','CA','CB','CC','ED','EG','FP','FT','FU','FW','FY','FZ']);
const initialSkip = new Set(['04. Accompanying carer','10. Group travel']);
const headingColumns = new Set(['CD','DB','DC','DI','DO','EC']);
export const publicSections = bySection.filter(s=>!initialSkip.has(s.section) && !s.section.startsWith('01.'));
const guardianColumns=['BI','BJ','BK','BL','BM','BN','BO','BP','BQ','BR','BS','BT','BU','BV'];
const emergencyColumns=['DP','DQ','DR','DS','DT','DU','DV','DW','DX','DY','DZ','EA','EB'];
const allergyColumns=columns.slice(columns.indexOf('EH'),columns.indexOf('FO')+1);
const yesno = ['Yes','No'];
export const clientOverrides={
 S:'Identification Number',T:'Street Address',U:'Address Line 2',W:'Province',AA:'Mobile Phone Number',
 BE:'Jamboree T-Shirt Size',BD:'Have you attended a previous World Scout Jamboree?',
 BX:'Other Travel Document Type',BZ:'Date of Issue',CA:'Expiry Date',CB:'Issuing Country',
 CE:'City or Town of Birth',CG:'Nationality at birth (if different)',CH:'Additional nationalities',
 CJ:'Marital Status',CK:'Please Specify Your Marital Status',CL:'Are you currently a student?',
 CM:'Is a family member a citizen of the European Union (EU), European Economic Area (EEA), or Switzerland?',
 CU:'Relationship to this family member',CV:'Please Specify Your Relationship',CW:'Do you live in a country different from your nationality?',
 CY:'First Schengen country of entry (CMT assigned)',CZ:'Have you previously provided fingerprints for a Schengen visa application?',
 DA:'Previous fingerprint date and visa sticker number (if known)',
 FQ:'Please describe your chronic medical conditions',FR:'Medication names and dosages',FS:'Does any medication require refrigeration?',
 FT:'Do religious or personal beliefs affect your healthcare decisions?',FY:'Blood Type',GA:'Describe your medical equipment needs',
 GB:'Do you have mobility restrictions?',GC:'Do you use a wheelchair?',GD:'Wheelchair Type',GE:'Do you use a cane, walking stick or walking frame?',
 GF:'Do you have other mobility needs?',GG:'Describe your mobility needs',GH:'Do you need a larger tent for mobility needs?',
 GI:'Do you have a non-visible disability?',GJ:'Are you blind or do you have low vision?',GK:'Other significant visual impairment',
 GL:'Are you deaf or hard of hearing?',GM:'Do loud noises, bright lights or large crowds cause you difficulties?',
 GN:'Other non-visible disability requiring support',GO:'Describe any support or adaptations needed'
};
for(const [i,c] of guardianColumns.entries()) clientOverrides[c]=['First Name','Surname','Relationship','Other Relationship','Nationality','Email Address','Phone Number','Preferred Language','Street Address','Address Line 2','City / Town','Province','Postal Code','Country'][i];
for(const [i,c] of emergencyColumns.entries()) clientOverrides[c]=['First Name','Surname','Relationship','Other Relationship','Nationality','Email Address','Phone Number','Street Address','Address Line 2','City / Town','Province','Postal Code','Country'][i];
export const isMinor = (v,referenceDate=process.env.MINOR_REFERENCE_DATE || new Date().toISOString().slice(0,10)) => { const dob=v?.M; if(!/^\d{4}-\d\d-\d\d$/.test(dob||'')) return null; const date=new Date(`${dob}T12:00:00Z`);if(Number.isNaN(date.valueOf())) return null;const ref=new Date(`${referenceDate}T12:00:00Z`);let age=ref.getUTCFullYear()-date.getUTCFullYear();if(ref.getUTCMonth()<date.getUTCMonth()||(ref.getUTCMonth()===date.getUTCMonth()&&ref.getUTCDate()<date.getUTCDate()))age--;return age<18; };
export function roleIsIST(v){return v.A==='International Service Team';}
export function condition(v,c){ if(!c) return true; for(const [key,expected] of Object.entries(c)){const actual=key.startsWith('form_only.')?v[key]:v[key];if(actual!==expected)return false;}return true;}
export function visible(col,v){
 if(headingColumns.has(col))return false;
 if(col==='B'||col==='C'||col==='D'||col==='AB'||['AC','AD','AE'].includes(col))return false;
 if(columns.indexOf(col)>=columns.indexOf('DB')&&columns.indexOf(col)<=columns.indexOf('DN'))return false;
 if(col==='CY')return false;
 if(col==='E')return true;
 if(guardianColumns.includes(col)) {if(!isMinor(v))return false;if(['BQ','BR','BS','BT','BU','BV'].includes(col)&&v['form_only.guardian_address_reuse']==='Yes')return false;if(col==='BL')return v.BK==='Other';return true;}
 if(emergencyColumns.includes(col)&&isMinor(v)&&v['form_only.emergency_reuse']==='Yes')return false;
 if(['DW','DX','DY','DZ','EA','EB'].includes(col)&&v['form_only.emergency_address_reuse']==='Yes')return false;
 if(col==='DS')return v.DR==='Other';
 if(col==='BD')return v['form_only.previous_jamboree']==='Yes';
 if(col==='CE'||col==='CF')return true;
 if(col==='CG')return v['form_only.nationality_changed']==='Yes';
 if(col==='CH')return v['form_only.additional_nationalities']==='Yes';
 if(col==='CN'||['CO','CP','CQ','CR','CS','CT'].includes(col))return v.CL==='I am a student'||v['form_only.has_employer']==='Yes';

 if(col==='BX')return v.BW?.toLowerCase().includes('other');
 if(col==='CK')return String(v.CJ||'').startsWith('Other');
 if(col==='CV')return v.CU==='Other'&&v.CM==='Yes';
 if(col==='CU')return v.CM==='Yes';
 if(col==='CX')return v.CW==='Yes';
 if(col==='DA')return v.CZ==='Yes';
 if(col==='EF')return v.ED==='Yes'&&v.EE==='Other';
 if(col==='EE')return v.ED==='Yes';
 if(allergyColumns.includes(col)){
  if(v.EG!=='Yes')return false;
  const idx=allergyColumns.indexOf(col);return idx%2===0 || v[allergyColumns[idx-1]]==='Yes';
 }
 if(col==='FQ')return v.FP==='Yes';
 if(col==='FR')return v['form_only.regular_medication']==='Yes';
 if(col==='FS')return v['form_only.regular_medication']==='Yes';
 if(col==='FV')return v.FU==='Yes';
 if(col==='FX')return v.FW==='Yes';
 if(col==='GA')return v.FZ==='Yes';
 if(col==='GD')return v.GC==='Yes'&&v['form_only.mobility_needs_screen']==='Yes';
 if(col==='GG')return v.GF==='Yes'&&v['form_only.mobility_needs_screen']==='Yes';
 if(['GB','GC','GE','GF'].includes(col))return v['form_only.mobility_needs_screen']==='Yes';
 if(col==='GH')return v['form_only.mobility_needs_screen']==='Yes' && ['GB','GC','GE','GF'].some(c=>v[c]==='Yes');
 if(['GI','GJ','GK','GL','GM','GN'].includes(col))return v['form_only.disability_screen']==='Yes';
 if(col==='GO')return (v['form_only.disability_screen']==='Yes' || v['form_only.mobility_needs_screen']==='Yes') && ['GC','GE','GF','GH','GI','GJ','GK','GL','GM','GN'].some(c=>v[c]==='Yes');
 if(['AK','AL','AM','AN'].includes(col))return v['form_only.language_french']==='Yes';
 if(['AO','AP','AQ','AR'].includes(col))return v['form_only.language_spanish']==='Yes';
 if(['AS','AT','AU','AV'].includes(col))return v['form_only.language_arabic']==='Yes';
 if(['BF','BG'].includes(col))return roleIsIST(v);
 if(col==='BH')return false;



 return true;
}
export function options(col){const f=fieldMap[col];
 if(col==='BK')return ['Mother','Father','Stepmother','Stepfather','Grandparent','Legal Guardian','Other'];
 if(col==='AF'||col==='BP')return ['Afrikaans','English','isiNdebele','isiXhosa','isiZulu','Sepedi','Sesotho','Setswana','siSwati','Tshivenda','itsonga','South African Sign Language','Other'];
 if(col==='O'||col==='CB'||col==='CF')return fieldMap.Y.options.map(o=>o.label);
 if(col==='FY')return ['Unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'];
 if(col==='GD')return ['Manual','Electric'];
 if(col==='A')return f.options.map(o=>o.label);
 if(['FP','FS','FT','FU','FW','FZ','GB','GC','GE','GF','GH','GI','GJ','GK','GL','GM','GN','CW','CZ','CM','ED','EG'].includes(col))return ['Yes','No',...(col==='FU'||col==='FW'?['Unknown']:[])];
 if(allergyColumns.includes(col))return allergyColumns.indexOf(col)%2===0 ? yesno : ['Mild','Moderate','Severe','Anaphylaxis'];
 if(col==='DR')return ['Partner','Parent','Family','Member','Friend','Colleague','Other'];
 if(f.options?.length)return f.options.map(o=>o.label);
 return null;
}
export const required=(col,v)=>{
 if(!visible(col,v))return false;
 if(col==='BL'||col==='DS'||col==='BX'||col==='EF'||col==='FQ'||col==='FR'||col==='GA'||col==='GD'||col==='GG'||col==='BD'||col==='GO'||col==='CG'||col==='CH')return true;
 if(['CO','CQ','CR','CS','CT'].includes(col))return true;
 if(allergyColumns.includes(col))return true;
 if(guardianColumns.includes(col))return !['BR'].includes(col);
 if(emergencyColumns.includes(col))return !['DX'].includes(col);
 if(['EE','FU','FW','GB','GC','GE','GF','GH','GI','GJ','GK','GL','GM','GN'].includes(col))return true;
 const f=fieldMap[col];return !!(f.required || f.form_required || extraRequired.has(col));
};
const allFormOnly=['form_only.regular_medication','form_only.mobility_needs_screen','form_only.disability_screen','form_only.language_french','form_only.language_spanish','form_only.language_arabic','form_only.emergency_reuse','form_only.guardian_address_reuse'];
export function normalize(raw){const v={...raw};
 if(!v.CE && v.N)v.CE=v.N;if(!v.CF && v.O)v.CF=v.O;
 if(v['form_only.guardian_address_reuse']==='Yes'&&isMinor(v)){for(const [to,from] of Object.entries({BQ:'T',BR:'U',BS:'V',BT:'W',BU:'X',BV:'Y'}))v[to]=v[from]||'';}
 if(isMinor(v)&&v['form_only.emergency_reuse']==='Yes'){const map={DP:'BI',DQ:'BJ',DT:'BM',DU:'BN',DV:'BO',DW:'BQ',DX:'BR',DY:'BS',DZ:'BT',EA:'BU',EB:'BV'};for(const [to,from] of Object.entries(map))v[to]=v[from]||'';v.DR='Parent';delete v.DS;}
 if(v['form_only.emergency_address_reuse']==='Yes'){for(const [to,from] of Object.entries({DW:'T',DX:'U',DY:'V',DZ:'W',EA:'X',EB:'Y'}))v[to]=v[from]||'';}v.B='Yes';v.C='South Africa';v.D='Scouts South Africa';v.AB='No';v.BH='';
 for(const [c,x] of Object.entries(v)){if(c.startsWith('form_only.'))continue;if(!visible(c,v) && !(c==='B'||c==='C'||c==='D'||c==='AB'||(v['form_only.guardian_address_reuse']==='Yes'&&['BQ','BR','BS','BT','BU','BV'].includes(c))||(v['form_only.emergency_reuse']==='Yes'&&emergencyColumns.includes(c))||(v['form_only.emergency_address_reuse']==='Yes'&&['DW','DX','DY','DZ','EA','EB'].includes(c))))delete v[c];}
 for(const c of ['AF','BP'])if(v[c]==='itsonga')v[c]='itsonga';
 for(let start of [['AK','AL','AM','AN'],['AO','AP','AQ','AR'],['AS','AT','AU','AV']]) if(!visible(start[0],v))for(const c of start)v[c]=options(c)?.find(x=>x.toLowerCase().startsWith('not '))||'';
 if(v.ED==='No'){v.EE='No special diet';delete v.EF;}
 if(v.EG==='No'){for(let i=0;i<allergyColumns.length;i++) {if(i%2===0)v[allergyColumns[i]]='No';else delete v[allergyColumns[i]];}}
 if(v.EG==='Yes'){for(let i=1;i<allergyColumns.length;i+=2)if(v[allergyColumns[i-1]]!=='Yes')delete v[allergyColumns[i]];}
 if(!isMinor(v))for(const c of guardianColumns)delete v[c];
 if(v['form_only.previous_jamboree']==='No')delete v.BD;
 if(v['form_only.nationality_changed']==='No')delete v.CG;
 if(v['form_only.additional_nationalities']==='No')delete v.CH;
 if(v.FT==='No')delete v['form_only.healthcare_beliefs_explanation'];

 for(const c of ['GB','GC','GE','GF','GH'])if(v['form_only.mobility_needs_screen']==='No')v[c]='No';
 for(const c of ['GI','GJ','GL','GM','GN'])if(v['form_only.disability_screen']==='No')v[c]='No';
 return v;
}
export function validateSection(v,index){const section=publicSections[index];if(!section)return ['Invalid section'];let errors=[];

 for(const q of section.questions){const c=q.excel_column;if(!fieldMap[c]||!visible(c,v))continue;if(required(c,v)&&!String(v[c]||'').trim())errors.push(`${clientOverrides[c]||q.display_question||q.question} is required`);if(v[c]&&options(c)&&!options(c).includes(v[c]))errors.push(`${c}: invalid selection`);}
 if(section.section.startsWith('06.') && !yesno.includes(v['form_only.previous_jamboree']))errors.push('Previous Jamboree experience is required');
 if(section.section.startsWith('09.') && v.CL==='I am not a student' && !yesno.includes(v['form_only.has_employer']))errors.push('Employment screening is required');
 if(section.section.startsWith('05.') && v.AF==='Other' && !String(v['form_only.native_language_other']||'').trim())errors.push('Please specify your native language');
 if(section.section.startsWith('07.') && isMinor(v) && v.BP==='Other' && !String(v['form_only.guardian_language_other']||'').trim())errors.push('Please specify guardian language');
 if(section.section.startsWith('09.'))for(const key of ['form_only.nationality_changed','form_only.additional_nationalities'])if(!yesno.includes(v[key]))errors.push('Nationality screening is required');
 if(section.section.startsWith('13.') && v.FT==='Yes' && !String(v['form_only.healthcare_beliefs_explanation']||'').trim())errors.push('Healthcare decision information is required');
 if(section.section.startsWith('13.'))for(const key of ['form_only.regular_medication'])if(!yesno.includes(v[key]))errors.push('Medication screening is required');
 if(section.section.startsWith('14.'))for(const key of ['form_only.mobility_needs_screen','form_only.disability_screen'])if(!yesno.includes(v[key]))errors.push('Accessibility screening is required');
 if(section.section.startsWith('05.'))for(const key of ['form_only.language_french','form_only.language_spanish','form_only.language_arabic'])if(!yesno.includes(v[key]))errors.push('Language selection is required');
 if(section.section.startsWith('12.')&&v.EG==='Yes')for(let i=0;i<allergyColumns.length;i+=2)if(v[allergyColumns[i]]==='Yes'&&!v[allergyColumns[i+1]])errors.push(`Allergy severity required for ${fieldMap[allergyColumns[i]].field}`);
 if(section.section.startsWith('07.') && isMinor(v) && v['form_only.guardian_authority']!==true)errors.push('Guardian authority and consent confirmation is required');
 if(section.section.startsWith('07.') && isMinor(v) && !yesno.includes(v['form_only.guardian_address_reuse']))errors.push('Confirm whether guardian has the same address');
 if(section.section.startsWith('11.') && isMinor(v) && !yesno.includes(v['form_only.emergency_reuse']))errors.push('Select whether to reuse guardian emergency contact');
 if(section.section.startsWith('11.') && (!isMinor(v)||v['form_only.emergency_reuse']==='No') && !yesno.includes(v['form_only.emergency_address_reuse']))errors.push('Confirm whether the emergency contact shares the participant address');
 if(section.section.startsWith('12.') && v.EG==='Yes' && !allergyColumns.filter((c,i)=>i%2===0).some(c=>v[c]==='Yes'))errors.push('Select at least one listed allergy or review the allergy screening answer');
 return [...new Set(errors)];
}
export function validateAll(v){let errors=[];for(let i=0;i<publicSections.length;i++)errors.push(...validateSection(v,i).map(e=>`${publicSections[i].section}: ${e}`)); if(!['Self','Parent / Legal Guardian','Authorised Representative'].includes(v['form_only.completed_by']))errors.push('Person completing registration must be identified');
 for(const col of ['AA','BO','DV'])if(visible(col,v)&&required(col,v)&&String(v[col]||'').replace(/\D/g,'').length<9)errors.push(`${col}: enter a complete phone number including country code`);
 for(const col of ['Z','BN','DU'])if(visible(col,v)&&required(col,v)&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v[col]||'')))errors.push(`${col}: enter a valid email address`);
 if(v['form_only.consent']!==true)errors.push('Registration consent required');return errors;}
export const publicSchema=publicSections.map(s=>({...s,questions:s.questions.filter(q=>!headingColumns.has(q.excel_column)).map(q=>({column:q.excel_column,label:clientOverrides[q.excel_column]||q.display_question||q.question,options:options(q.excel_column),type:fieldMap[q.excel_column]?.type||'',required:!!q.required}))}));
export function assertSchema(){if(columns.length!==197||new Set(columns).size!==197)throw Error('197-column mapping integrity failed');}
