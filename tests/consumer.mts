import { detectSession, observeSession, declareSessionDriver, type Detection } from '@omegdadi/session-driver';
const result: Detection = detectSession();
const observer = observeSession({ host: { agentActive: true } });
observer.subscribe(value => { const count: number = value.interactions.trusted; });
declareSessionDriver('agent');
// @ts-expect-error incorrect declaration
 declareSessionDriver('robot');
