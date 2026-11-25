import test from 'node:test';import assert from 'node:assert/strict';import {polishDateTimeFromSouthAfrica} from '../timezone.mjs';
test('SA to Poland: July daylight saving preserves 24h wall clock',()=>assert.deepEqual(polishDateTimeFromSouthAfrica('2027-07-30','15:30'),{date:'2027-07-30',time:'15:30'}));
test('SA to Poland: January winter shifts one hour earlier',()=>assert.deepEqual(polishDateTimeFromSouthAfrica('2027-01-30','15:30'),{date:'2027-01-30',time:'14:30'}));
test('SA to Poland: winter calendar day may change',()=>assert.deepEqual(polishDateTimeFromSouthAfrica('2027-01-30','00:30'),{date:'2027-01-29',time:'23:30'}));
