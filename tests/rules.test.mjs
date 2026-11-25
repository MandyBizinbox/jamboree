import test from 'node:test';import assert from 'node:assert/strict';
import {columns,assertSchema,normalize,visible,validateSection,publicSections} from '../rules.mjs';
test('197 unique export columns',()=>{assertSchema();assert.equal(columns.length,197);assert.equal(new Set(columns).size,197)});
test('guardian Other is conditional',()=>{assert.equal(visible('BL',{M:'2014-01-01',BK:'Parent'}),false);assert.equal(visible('BL',{M:'2014-01-01',BK:'Other'}),true)});
test('allergy details hidden if screening No',()=>{assert.equal(visible('EH',{EG:'No'}),false);assert.equal(visible('EI',{EG:'No'}),false);const x=normalize({EG:'No',EH:'Yes',EI:'Severe'});assert.equal(x.EH,'No');assert.equal(x.EI,undefined)});
test('allergy severity only visible if selected',()=>{assert.equal(visible('EI',{EG:'Yes',EH:'No'}),false);assert.equal(visible('EI',{EG:'Yes',EH:'Yes'}),true)});
test('mobility wheelchair type conditional',()=>{assert.equal(visible('GD',{'form_only.mobility_needs_screen':'No',GC:'Yes'}),false);assert.equal(visible('GD',{'form_only.mobility_needs_screen':'Yes',GC:'Yes'}),true)});
test('no unneeded guardian for adult',()=>assert.equal(visible('BK',{M:'1986-01-01'}),false));
test('public sections exclude carer and travel admin',()=>{assert.equal(publicSections.some(x=>x.section.startsWith('04.')),false);assert.equal(publicSections.some(x=>x.section.startsWith('10.')),false)});
