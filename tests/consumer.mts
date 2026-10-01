import { detectSession, observeSession, declareSessionDriver, type Detection } from 'agent-or-human';
const result: Detection = detectSession();
const observer = observeSession({ host: { agentActive: true } });
observer.subscribe(value => { const count: number = value.interactions.trusted; });
declareSessionDriver('agent');
// @ts-expect-error incorrect declaration
 declareSessionDriver('robot');

import {createSessionClassifier, toAnalyticsProperties} from 'agent-or-human';
const classifier = createSessionClassifier();
const properties = toAnalyticsProperties(classifier.refresh());
classifier.stop();

const pointerClassifier = createSessionClassifier({ pointerAnalysis: 'observe' });
const speed: number | null = pointerClassifier.refresh().pointer.maxSpeedPxPerMs;
pointerClassifier.stop();

import { createSessionMonitor } from 'agent-or-human';
const monitor = createSessionMonitor({ pollIntervalMs: 0 });
monitor.addEventListener('statechange', event => { const state: string = event.state; });
monitor.onassessmentchange = event => { const reason: string[] = event.assessment.reasons; };
monitor.stop();

const receiver = { multiplier: 3, execute: sessionMonitorForReceiver() };
function sessionMonitorForReceiver() {
  const instance = createSessionMonitor({ scope: null });
  const wrapped = instance.wrapWebMCPTool(function(this: { multiplier: number }, n: number) { return this.multiplier * n; });
  instance.stop();
  return wrapped;
}
const receiverResult: number = receiver.execute(2);

import { connectBotD, createSessionHistory } from 'agent-or-human';
const evidenceHistory = createSessionHistory(monitor, { limit: 20 });
const botdConnection = connectBotD(monitor, { async collect() {}, detect: () => ({ bot: false }) });
monitor.setAutomationEvidence('example', { automated: true, ttlMs: 1000 });
const duration: number = evidenceHistory.getSummary().durationsMs.unclassified;
botdConnection.stop(); evidenceHistory.stop();
