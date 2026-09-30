import { detectSession, observeSession, declareSessionDriver, type Detection } from '@omegdadi/session-driver';
const result: Detection = detectSession();
const observer = observeSession({ host: { agentActive: true } });
observer.subscribe(value => { const count: number = value.interactions.trusted; });
declareSessionDriver('agent');
// @ts-expect-error incorrect declaration
 declareSessionDriver('robot');

import {createSessionClassifier, toAnalyticsProperties} from '@omegdadi/session-driver';
const classifier = createSessionClassifier();
const properties = toAnalyticsProperties(classifier.refresh());
classifier.stop();

const pointerClassifier = createSessionClassifier({ pointerAnalysis: 'observe' });
const speed: number | null = pointerClassifier.refresh().pointer.maxSpeedPxPerMs;
pointerClassifier.stop();

import { createSessionMonitor } from '@omegdadi/session-driver';
const monitor = createSessionMonitor({ pollIntervalMs: 0 });
monitor.addEventListener('statechange', event => { const state: string = event.state; });
monitor.onassessmentchange = event => { const reason: string[] = event.assessment.reasons; };
monitor.stop();
