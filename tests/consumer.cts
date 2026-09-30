import driver = require('@omegdadi/session-driver');
const result: driver.Detection = driver.detectSession();

const classifier = driver.createSessionClassifier();
const properties = driver.toAnalyticsProperties(classifier.getSnapshot());
classifier.stop();

const pointerClassifier = driver.createSessionClassifier({ pointerAnalysis: 'classify' });
const pointer: driver.PointerEvidence = pointerClassifier.refresh().pointer;
pointerClassifier.stop();
