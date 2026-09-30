# Analytics segmentation (experimental, v0.2.0)

`createSessionClassifier()` is an opt-in heuristic for understanding website traffic. It adds behavior-based segments to the existing evidence-only `detectSession()` API. It is not an identity check, fraud gate, CAPTCHA, or validated human/agent classifier.

## Integration

```js
import { createSessionClassifier, toAnalyticsProperties } from '@omegdadi/session-driver';

// Start after consent where your analytics policy requires it.
const classifier = createSessionClassifier();

// "analytics" below is YOUR existing analytics client, not part of this package.
analytics.track('session_driver_initial', toAnalyticsProperties(classifier.getSnapshot()));
const unsubscribe = classifier.subscribe(assessment => {
  analytics.track('session_driver_changed', toAnalyticsProperties(assessment));
});

// Attach a fresh assessment to the events you already measure.
analytics.track('page_engaged', toAnalyticsProperties(classifier.refresh()));

// Component/application teardown:
unsubscribe();
classifier.stop();
```

The package never transmits anything. No analytics provider is installed or auto-detected. `getSnapshot()` returns the last assessment; `refresh()` rereads browser/host flags, declarations, and recent behavior. Accepted input automatically refreshes. External host/declaration changes require refresh or new accepted input. There is no polling timer. `stop()` freezes the last assessment and removes listeners; start a new classifier for a new observation session. Create it after client mount in React/Expo web; clean it up on unmount. Native/SSR environments return unclassified with `environment: 'unsupported'`.

## Segments and confidence

| Segment | Confidence | Evidence |
| --- | --- | --- |
| `declared_agent` | `declared` | Page or host explicitly declares an agent. Self-reported, not authenticated. |
| `likely_automated` | `strong_signal` | `navigator.webdriver === true`. Could be testing/RPA rather than an AI agent. |
| `likely_automated` | `heuristic` | Headless user agent plus sustained regular synthetic input. |
| `likely_human` | `heuristic` | Sufficient varied trusted interaction, without conflicting automation signals. |
| `unclassified` | `insufficient` | Passive, insufficient, contradictory, unsupported, or inconclusive observations. |

Confidence describes the kind of evidence, **not a calibrated probability**. A human declaration alone is not sufficient for `likely_human`. An agent declaration takes priority, followed by exposed automation. Exposed WebDriver cannot be outvoted by human-like activity. Debugger attachment alone does not establish automation. Headless or configured agent-UI evidence prevents the likely-human rule from firing.

For a two-way dashboard, retain `likely_human` as one group and combine `likely_automated` + `declared_agent` as an automated group, **while keeping unclassified visible as a third bucket**. Do not silently impute unclassified traffic as human, or label all automation as AI agents. Break down automated traffic by confidence/basis when useful.

## Current rules (not empirically calibrated)

Only `pointerdown`, `keydown`, and `wheel` events are observed. Pointer input includes touch on Pointer Events browsers. Held-key repeats are ignored. Events less than 150 ms after the last accepted event are coalesced. Click and pointerdown are not both counted for the same gesture. At most 32 samples from the last 30 seconds remain in memory.

- **Likely human:** at least 90% accepted samples are trusted; their inter-event gaps have coefficient of variation >= 0.25 and a range >= 150 ms. Require 6 trusted events spanning at least 3 seconds across 2 input types, OR 10 trusted events spanning at least 6 seconds in one input type. This permits keyboard-only/touch-only input without requiring a mouse. Time spent idle cannot satisfy the activity span.
- **Behavioral likely automated:** a HeadlessChrome user agent plus at least 12 synthetic events over 3 seconds, >=90% synthetic input, with gap coefficient of variation <0.1. Synthetic events alone do not suffice: legitimate applications generate them.
- **Unclassified:** everything else, including passive readers and unsupported environments. A previously inferred segment may expire on the next input/refresh once evidence leaves the rolling window.

These thresholds are transparent initial rules, not a trained model or accuracy claim. Input restrictions, assistive tools, repetitive tasks, and different hardware can affect coverage. An automated browser with hidden flags and human-like timing can be assigned `likely_human`; tests deliberately demonstrate this limitation. A false positive/negative rate has not been measured on real labeled traffic.

## A/B testing: preserve allocation and measurement time

Use your existing assignment service. This package does not choose, store, or change variants.

```js
// Capture once when YOUR experiment's exposure actually occurs.
const exposure = {
  variant: existingAssignedVariant,
  properties: toAnalyticsProperties(classifier.refresh()),
};
analytics.track('experiment_exposure', {
  experiment: 'checkout-v3', variant: exposure.variant, ...exposure.properties,
});

// Later, keep the same assigned variant and preserve the baseline segment.
analytics.track('conversion', {
  experiment: 'checkout-v3',
  variant: exposure.variant,
  segment_at_exposure: exposure.properties.session_driver_segment,
  ...toAnalyticsProperties(classifier.refresh()),
});
```

Store exposure state using your existing experiment system if it must survive navigation. The classifier neither persists nor carries identity across pages. Do not overwrite historic event segments with the final session segment. Report segment coverage and transitions per variant. Keep detector versions comparable between variants and freeze the rule version during an experiment.

Behavior may itself change because of the tested treatment. Slicing results by a post-exposure behavior-derived segment can introduce selection bias even when variant assignment is stable. Keep overall randomized results primary; use dynamic segments as exploratory traffic-quality slices. When possible, define confirmatory segments before treatment exposure. See [Microsoft's experimentation guidance on dynamic segments](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/).

## Event properties and subscriptions

`toAnalyticsProperties()` returns segment, confidence, basis, reason codes, signal codes, detector version, assessment timestamp, change timestamp, revision, and browser/unsupported environment. It copies arrays so consumers cannot mutate the classifier. It includes no user ID, session ID, URL, typed content, pointer coordinates, or variant.

Subscribe callbacks fire only when segment, confidence, or basis changes. They do not fire initially or on every event. Read/send the initial snapshot explicitly. Assessment timestamps update on refresh; `changedAt`/`revision` advance only on those transitions. Listener exceptions are isolated so one failing analytics callback cannot break others; your client should handle its own reporting errors.

Behavior samples retain only event family, trust flag, and timing in bounded memory. Exported behavior summaries contain aggregate counts, modality names, activity span, and timing-variety status. The package sets no cookies, reads no storage, creates no IDs, sends no network requests, and stores no raw keys, positions, targets, or text. Timestamps in exported analytics properties are Unix milliseconds.

## Validate before trusting the segments

1. Gather independently labeled consented human sessions and known agent/test sessions across touch, keyboard, mouse, assistive tools, and passive browsing.
2. Keep ground-truth labels separate from the detected segment; do not use a declaration as its own validation label.
3. Report a confusion matrix and the unclassified/unsupported share, split by browser, input type, rule version, and experiment variant.
4. Include concealed automation and human-like agent behavior; do not report test-runner detection as agent-identification accuracy.
5. Start in observation mode. Validate and freeze any rule changes before using segments to exclude traffic or make experiment decisions.
