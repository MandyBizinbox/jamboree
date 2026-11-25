import test from 'node:test';import assert from 'node:assert/strict';
import {normalize,validateAll,visible,required,options,publicSections} from '../rules.mjs';
const base={A:'International Service Team',E:'',F:'Synthetic',G:'Adult',M:'1988-04-12',
 'form_only.consent':true,'form_only.completed_by':'Self','form_only.guardian_authority':true,AA:'+27721234567',DV:'+27721234567',BO:'+27721234567','form_only.previous_jamboree':'No',
 'form_only.language_french':'No','form_only.language_spanish':'No','form_only.language_arabic':'No',
 'form_only.regular_medication':'No','form_only.mobility_needs_screen':'No','form_only.disability_screen':'No',
 'form_only.nationality_changed':'No','form_only.additional_nationalities':'No','form_only.has_employer':'No','form_only.emergency_address_reuse':'No',
 ED:'No',EG:'No',FP:'No',FT:'No',FU:'Unknown',FW:'Unknown',FZ:'No',CM:'No',CW:'No',CZ:'No',CL:'I am not a student',
};
const dates=new Set(['M','BZ','CA','FV','FX']);
function populate(seed){const v={...seed};for(let pass=0;pass<3;pass++)for(const s of publicSections)for(const q of s.questions){const c=q.excel_column;if(!c||!visible(c,v)||!required(c,v)||String(v[c]??'').trim())continue;const choices=options(c);if(choices?.length){v[c]=choices.includes('No')?'No':choices.includes('Unknown')?'Unknown':choices[0];}else v[c]=dates.has(c)?'2027-01-01':c==='Z'||c==='DU'?'synthetic@example.test':'Synthetic test';}return v;}
test('full adult synthetic route can satisfy required schema with safe conditional No answers',()=>{const v=populate(base);const issues=validateAll(normalize(v));assert.deepEqual(issues,[]);assert.equal(visible('BL',v),false);assert.equal(visible('EI',v),false);});
test('skipped allergy followups are unrequired and defaults map to No',()=>{const v=normalize(populate(base));assert.equal(v.EH,'No');assert.equal(v.EI,undefined);});
test('guardian address can reuse participant without requesting every field twice',()=>{const v=normalize(populate({...base,M:'2014-12-03','form_only.guardian_address_reuse':'Yes','form_only.emergency_reuse':'Yes',BK:'Mother',BQ:'stale',T:'Synthetic Address',V:'Cape Town',W:'Western Cape',X:'7550',Y:'South Africa'}));assert.equal(v.BQ,'Synthetic Address');assert.equal(v.DW,'Synthetic Address');assert.equal(visible('BL',v),false);assert.equal(visible('BQ',v),false);});
