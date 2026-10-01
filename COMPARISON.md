# Agent or Human and BotD

[Try the live comparison](https://omegdadi.github.io/agent-or-human/compare/).

Use BotD alone when you need its browser automation signature check. Choose Agent or Human when analytics needs a live, qualified session segment, notifications when evidence changes, and time spent in each segment. You can use both: BotD provides additional signatures; our monitor manages provenance, expiry and session history.

This is a difference in API and workflow, not a demonstrated accuracy advantage. Both are free MIT client-side libraries. Neither can establish human identity or reliably detect every agent. BotD's paid Fingerprint offering is a separate product and is not evaluated here.

## Integrating both

```js
import { load } from '@fingerprintjs/botd';
import { createSessionMonitor, connectBotD, createSessionHistory } from 'agent-or-human';
const monitor = createSessionMonitor();
const history = createSessionHistory(monitor, { limit: 50 });
const detector = await load({ monitoring: false });
const botd = connectBotD(monitor, detector, { ttlMs: 60000 });
monitor.addEventListener('statechange', event => {
  console.log(event.state, event.assessment.reasons);
});
await botd.refresh();
console.log(history.getSummary());
// On teardown:
history.stop(); botd.stop(); monitor.stop();
```

Install BotD separately if you want this integration. The core has no runtime dependencies and does not load BotD. Disable BotD's optional installation monitoring explicitly as above. The comparison bundles BotD 2.0.0 on the same origin, loads it only on request, disables monitoring, and exports only its result rather than raw collected components.

`refresh()` recollects BotD inputs, coalesces concurrent requests, and records a result for 60 seconds by default (1 ms to 1 hour configurable). A positive result is heuristic automation evidence, not an AI-agent declaration. A negative result never establishes human identity. A failure clears the provider's evidence and rejects; stopping discards pending results. Use one BotD connection per monitor because it owns the `botd` provider key.

Other detectors can use `monitor.setAutomationEvidence(source, { automated, kind, ttlMs })`. Pass `null` to remove evidence. Provider names are lowercase identifiers, with at most eight active providers. Direct declarations and WebDriver signals take precedence over provider heuristics. Default polling observes expiry; with polling disabled, call `refresh()` to update state.

History retains at most 50 transitions by default (configurable 1–1000) while totals cover the history object's entire lifetime, including idle/background time. It does not persist across navigation. `mixedEvidence` means human-like and automation evidence both occurred; it does not prove a handoff. Stop history explicitly when ending measurement, even if you already stopped the monitor. These are classifications, not probabilities or verified identity; do not silently count unclassified sessions as human or use changing segments to reassign an experiment treatment.

## What has been validated

Automated tests exercise provider expiry, cleanup, negative results, failed checks, concurrent refreshes, history retention and timing. The live page runs the actual pinned BotD library in Chromium, Firefox and WebKit tests. This is integration validation, not a representative accuracy benchmark, physical-device certification or proof that hidden automation will be detected.

BotD API and detector sources: [API](https://github.com/fingerprintjs/BotD/blob/main/docs/api.md), [detectors](https://github.com/fingerprintjs/BotD/tree/main/src/detectors). Compare against version 2.0.0; upstream APIs may change.
