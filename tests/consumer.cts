import driver = require('agent-or-human');
const result: driver.Detection = driver.detectSession();

const classifier = driver.createSessionClassifier();
const properties = driver.toAnalyticsProperties(classifier.getSnapshot());
classifier.stop();

const pointerClassifier = driver.createSessionClassifier({ pointerAnalysis: 'classify' });
const pointer: driver.PointerEvidence = pointerClassifier.refresh().pointer;
pointerClassifier.stop();

const monitor = driver.createSessionMonitor({ pollIntervalMs: 0 });
monitor.addEventListener('statechange', event => { const state: string = event.state; });
monitor.onassessmentchange = event => { const reason: string[] = event.assessment.reasons; };
monitor.stop();
