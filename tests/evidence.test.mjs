import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionMonitor, connectBotD, createSessionHistory } from '../dist/index.js';
function fixture() { let time = 1000; const monitor = createSessionMonitor({ scope: { document: {}, navigator: {} }, pollIntervalMs: 0, now: () => time }); return { monitor, now: () => time, tick: ms => time += ms }; }
test('provider provenance, negative result, expiry, precedence and isolated snapshots', () => {
 const {monitor:m,tick}=fixture(); let changes=0;m.onassessmentchange=()=>changes++;
 m.setAutomationEvidence('botd',{automated:false});assert.equal(m.state,'unclassified');
 m.setAutomationEvidence('botd',{automated:true,kind:'test',ttlMs:100});assert.equal(m.state,'likely_automated');assert.equal(m.assessment.basis,'provider');
 m.assessment.providers[0].automated=false;assert.equal(m.assessment.providers[0].automated,true);
 m.setHostState({agentActive:true});assert.equal(m.state,'declared_agent');m.setHostState({});
 tick(100);m.refresh();assert.equal(m.state,'unclassified');assert.equal(m.assessment.providers.length,0);assert.ok(changes>=5);m.stop();
});
test('provider bounds reclaim expired entries and reject malformed inputs',()=>{
 const {monitor:m,tick}=fixture();for(let i=0;i<8;i++)m.setAutomationEvidence('p'+i,{automated:true,ttlMs:1});
 assert.throws(()=>m.setAutomationEvidence('ninth',{automated:true}),RangeError);tick(2);m.setAutomationEvidence('ninth',{automated:false});assert.equal(m.assessment.providers.length,1);
 assert.throws(()=>m.setAutomationEvidence('Bad source',{automated:true}),TypeError);
 assert.throws(()=>m.setAutomationEvidence('valid',{automated:true,ttlMs:NaN}),TypeError);m.stop();
});
test('BotD refresh recollects, coalesces, clears failed evidence and stops',async()=>{
 const {monitor:m}=fixture();let collects=0;let fail=false;const c=connectBotD(m,{async collect(){collects++;if(fail)throw Error('offline');},detect(){return {bot:true,botKind:'headless_chrome'};}});
 const first=c.refresh();assert.equal(first,c.refresh());await first;assert.equal(collects,1);assert.equal(m.state,'likely_automated');
 fail=true;await assert.rejects(c.refresh(),/offline/);assert.equal(m.state,'unclassified');c.stop();assert.equal(await c.refresh(),null);m.stop();
});
test('stopping during collection discards late BotD result and SSR never collects',async()=>{
 const {monitor:m}=fixture();let resolve;let detected=false;const c=connectBotD(m,{collect:()=>new Promise(r=>resolve=r),detect(){detected=true;return {bot:false};}});
 const pending=c.refresh();await Promise.resolve();c.stop();resolve();assert.equal(await pending,null);assert.equal(detected,false);m.stop();
 const ssr=createSessionMonitor({scope:null,pollIntervalMs:0});assert.equal(await connectBotD(ssr,{collect(){throw Error('must not run');},detect(){throw Error('must not run');}}).refresh(),null);ssr.stop();
});
test('history retains bounded transitions, totals elapsed segments, clones snapshots and freezes',()=>{
 const {monitor:m,tick,now}=fixture();const h=createSessionHistory(m,{limit:1,now});tick(10);m.setHostState({agentActive:true});tick(20);m.setHostState({});tick(30);
 const summary=h.getSummary();assert.equal(summary.durationMs,60);assert.equal(summary.durationsMs.declared_agent,20);assert.equal(summary.durationsMs.unclassified,40);assert.equal(summary.transitionCount,2);assert.equal(h.getEntries().length,1);
 h.getEntries()[0].reasons.push('bad');assert.equal(h.getEntries()[0].reasons.includes('bad'),false);h.stop();tick(100);assert.equal(h.getSummary().durationMs,60);m.stop();
});
test('negative BotD results remain unclassified and renewals do not duplicate events',async()=>{
 const {monitor:m,tick}=fixture();let events=0;m.onassessmentchange=()=>events++;
 const c=connectBotD(m,{async collect(){},detect:()=>({bot:false})},{ttlMs:100});await c.refresh();assert.equal(m.state,'unclassified');assert.equal(events,1);
 tick(10);await c.refresh();assert.equal(events,1);tick(100);m.refresh();assert.equal(m.assessment.providers.length,0);assert.equal(events,2);c.stop();m.stop();
});
test('polling expires providers without user activity',t=>{
 t.mock.timers.enable({apis:['setInterval','Date'],now:1000});const m=createSessionMonitor({scope:{document:{},navigator:{}},pollIntervalMs:100});
 m.setAutomationEvidence('botd',{automated:true,ttlMs:200});t.mock.timers.tick(200);assert.equal(m.state,'unclassified');m.stop();
});
