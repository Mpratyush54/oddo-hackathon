import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/event-utils.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {eventStart,eventEnd,eventPhase} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('event boundaries use campus time and close booking at end',()=>{
 const event={date:'2026-10-10',time:'18:00',endTime:'20:00'};
 assert.equal(eventStart(event).toISOString(),'2026-10-10T12:30:00.000Z');
 assert.equal(eventPhase(event,new Date('2026-10-10T12:29:59Z')),'upcoming');
 assert.equal(eventPhase(event,new Date('2026-10-10T12:30:00Z')),'ongoing');
 assert.equal(eventPhase(event,new Date('2026-10-10T14:30:00Z')),'past');
});
test('overnight and multi-day events continue until declared end',()=>{
 const overnight={date:'2026-10-10',time:'22:00',endTime:'02:00'};
 assert.equal(eventEnd(overnight).toISOString(),'2026-10-10T20:30:00.000Z');
 assert.equal(eventPhase(overnight,new Date('2026-10-10T19:30:00Z')),'ongoing');
 const longEvent={...overnight,endDate:'2026-10-12'};
 assert.equal(eventPhase(longEvent,new Date('2026-10-11T19:30:00Z')),'ongoing');
});
