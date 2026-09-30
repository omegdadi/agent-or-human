# session-driver

**[Try the live demo →](https://omegdadi.github.io/session-driver/)** · [Demo deployment](https://github.com/omegdadi/session-driver/actions/workflows/pages.yml)

Small, zero-runtime-dependency browser automation detector with explainable evidence. TypeScript, ESM, CommonJS, and a standalone browser script. MIT licensed.

**A web page cannot reliably prove “human versus AI.”** This package detects exposed automation, reads cooperative declarations, and reports uncertainty. It cannot infer an LLM reasoning loop from clicks. Use it for diagnostics and adapting experiences, never authentication, fraud decisions, or blocking accessibility tools.

## Install

Install the published GitHub release with npm (no build tools required):

```sh
npm install https://github.com/omegdadi/session-driver/releases/download/v0.5.0/omegdadi-session-driver-0.5.0.tgz
```

The installed package name is `@omegdadi/session-driver`. Source is tagged `v0.5.0`. npm registry publication is pending: the initial publish was rejected by the registry, so a bare-name registry install is not yet available.

```js
import { detectSession } from '@omegdadi/session-driver';

const session = detectSession();
console.log(session.verdict, session.signals);
// { verdict: 'automated', basis: 'signal', automated: true,
//   agentic: null, signals: [{ code: 'webdriver', strength: 'strong' }] }
```

## Analytics and A/B segments (v0.2)

```js
import { createSessionClassifier, toAnalyticsProperties } from '@omegdadi/session-driver';
const classifier = createSessionClassifier();
const initial = toAnalyticsProperties(classifier.getSnapshot());
classifier.subscribe(assessment => {
  // Attach these properties using your existing analytics client.
  console.log(toAnalyticsProperties(assessment));
});
// At an exposure/conversion: classifier.refresh()
// At teardown: classifier.stop()
```

Segments are `likely_human`, `likely_automated`, `declared_agent`, and `unclassified`. Ordinary browsing can become likely human as varied interactions accumulate. Passive visitors remain unclassified. Confidence labels describe evidence quality, not measured probabilities. Rules are **experimental and not calibrated against a labeled traffic dataset**; agents can imitate human input.

Keep A/B assignment stable, retain the segment at exposure, and attach the current segment to later events. Post-treatment behavioral segments can bias causal comparisons; use them as exploratory slices alongside overall randomized results. Read [ANALYTICS.md](https://github.com/omegdadi/session-driver/blob/main/ANALYTICS.md) for integration, exact rules, privacy, and validation guidance. The package transmits nothing and never assigns variants.

`detectSession()` and `observeSession()` below retain their original evidence-only behavior for backward compatibility.

## Results

| Verdict | Meaning |
| --- | --- |
| `agent` | The page or host explicitly declared an active agent. Cooperative metadata, not verified identity. |
| `automated` | `navigator.webdriver === true`. May be a test runner, RPA, or an agent. |
| `human` | Explicit human declaration, with no contradicting WebDriver or active-agent evidence. **Not independently verified.** |
| `unknown` | No strong evidence. Includes ordinary browsing AND concealed/undetectable automation. |
| `unsupported` | No accessible browser document: SSR, Node, workers, native React Native. |

`automated` and `agentic` are `true | null`, never `false`: null means not established. `signals` explains the outcome; no invented probability or accuracy percentage. A human declaration cannot override positive WebDriver evidence. Host `agentActive: true` takes precedence over a human declaration. `agentActive: false` is not evidence of a human.

## Browser control, extra UI, and vendor APIs

Checked against vendor documentation on 2026-09-29. There is no universal page API in the reviewed documentation for “an AI loop currently controls this tab.”

| Signal | Treatment |
| --- | --- |
| Standard `navigator.webdriver` | Strong automation evidence; not agent identity. |
| HeadlessChrome user agent | Weak, spoofable signal; does not determine verdict. |
| Known in-page agent overlay | Optional CSS selector match; weak and spoofable, even when present. Hidden elements also match. |
| Chrome extension debugger state | Host bridge required; attachment is weak evidence because human developers attach debuggers too. |
| Electron `webContents.debugger.isAttached()` | Host bridge required; describes this debugger API's attachment, not all remote automation. |
| `document.modelContext` / older `navigator.modelContext` | Diagnostic WebMCP capability only. Availability does not mean an agent is active. |
| Browser toolbar, sidebar, “controlled by automated software” infobar | Outside the page DOM; not read by this dependency. |
| Trusted clicks / keystrokes | Browser event provenance, not proof of a human. |

We intentionally do not use viewport-size differences to guess sidebars, inspect passwords/typed text, detect DevTools with timing traps, or enumerate extensions. Those approaches do not establish agent control and can create false positives. No hard-coded Atlas, Comet, or Gemini UI selectors are claimed to be validated.

```js
const session = detectSession({
  // Only selectors you know correspond to in-page automation UI.
  agentIndicatorSelectors: ['[data-your-agent-overlay="active"]'],
  // Provided by an integration YOU control, not auto-discovered on websites.
  host: { debuggerAttached: false, agentActive: false },
});
```

For Electron, read `win.webContents.debugger.isAttached()` in the main process and expose a narrow boolean via your existing preload/contextBridge IPC. Keep `nodeIntegration` disabled and `contextIsolation` enabled. Pass `agentActive` only when your host actually knows its agent is driving. A Chrome extension can use `chrome.debugger.getTargets()` with the `debugger` permission and map its own tab's `attached` value into the same option. The npm dependency itself requests no permissions and does not install an extension.

WebMCP tool execution can be initiated through JavaScript as well as a browser agent; capability or a tool event alone is not universal proof of agent control. Add a declaration at your own agent integration boundary if you know its provenance.

Sources: [W3C WebDriver](https://www.w3.org/TR/webdriver/#interface), [MDN webdriver](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver), [MDN isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted), [Chrome debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger), [Electron Debugger](https://www.electronjs.org/docs/latest/api/debugger), [Chrome WebMCP](https://developer.chrome.com/docs/ai/agents), [WebMCP draft](https://webmachinelearning.github.io/webmcp/).

## Cooperative handoffs

```js
import { declareSessionDriver, detectSession } from '@omegdadi/session-driver';
declareSessionDriver('agent'); // true on success, false outside a writable browser
console.log(detectSession().verdict); // agent

declareSessionDriver('human'); // explicit handoff; not a verification step
declareSessionDriver(null);    // clear when the session ends
```

This writes `window.__SESSION_DRIVER__`. An agent controller may set the same property before the page runs. It is per-window, resets on navigation, and can be changed by any script on the page. Invalid driver values throw a TypeError. Clear/update it on every handoff; no stale declaration detection is possible without host cooperation.

## Observe input (optional)

```js
import { observeSession } from '@omegdadi/session-driver';
const observer = observeSession();
const unsubscribe = observer.subscribe(snapshot => console.log(snapshot));
console.log(observer.getSnapshot());
// Later:
unsubscribe();
observer.stop();
```

Counts `pointerdown`, `keydown`, and `click` events (a click gesture can increment more than one count). Saves only aggregate trusted/synthetic counts; no keys, targets, positions, text, timestamps, cookies, or identifiers. Input never upgrades `unknown` to `human`. Subscriptions fire on observed input; call `getSnapshot()` after declarations/host changes to refresh. There is no polling or MutationObserver. `stop()` is idempotent, removes listeners, and clears subscriptions. Snapshot detection remains callable after stop; counts stop changing. Subscriber exceptions propagate to the browser's event error reporting; keep subscribers non-throwing.

## React, Next.js, Expo

Use the same core from any framework. No React dependency or hook adapter is required:

```jsx
import { useEffect, useState } from 'react';
import { observeSession } from '@omegdadi/session-driver';

export function SessionStatus() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    const observer = observeSession();
    setSession(observer.getSnapshot());
    observer.subscribe(setSession);
    return () => observer.stop();
  }, []);
  return <span>{session?.verdict ?? 'Checking…'}</span>;
}
```

In Next.js, put this component in a `'use client'` module. Initialize after mount to keep server/client markup consistent. Vue/Svelte/Angular can use the same lifecycle pattern. Expo **web** uses the browser implementation; Expo iOS/Android and React Native return `unsupported` because there is no browser session. A React Native WebView must run this package **inside the web page**, then use the application's existing message bridge if native code needs the result.

CommonJS:

```js
const { detectSession } = require('@omegdadi/session-driver');
```

Plain HTML (copy the distributed file to your site's assets):

```html
<script src="/assets/session-driver.global.js"></script>
<script>console.log(SessionDriver.detectSession());</script>
```

`examples/index.html` is a runnable demo. Open it after cloning; no server is required.

## Development and verification

Use Node 22+ for tooling. The runtime is ES2020 JavaScript with no Node built-ins; consumer declarations do not require DOM types.

```sh
npm ci
npm test                       # build, unit tests, ESM/CJS TypeScript checks
npx playwright install --with-deps chromium firefox webkit
npm run test:browser            # real browser automation and React rendering
npm run test:electron           # sandboxed Electron renderer and debugger bridge
npm run test:package            # install actual tarball in fresh ESM/CJS consumer
npm ci --prefix tests/fixtures/expo
npm run test:expo               # actual Expo/Metro export and browser rendering
```

See [TESTING.md](https://github.com/omegdadi/session-driver/blob/main/TESTING.md) for measured results and scope. Automated tests verify behavior and known limitations; they do not measure real-world human/agent classification accuracy. OS-level control, stealth automation, remote debugging without an exposed flag, and vendor agent modes without a bridge may remain `unknown`. WebKit under Playwright is not a substitute for every Safari release.

Built distributions are committed so GitHub installs require no build toolchain. Run `npm run build` after source edits. CI checks for distribution drift. For an npm registry release, a maintainer with access to the `@omegdadi` npm scope can run `npm publish --access public` after all checks pass. GitHub ownership does not grant npm scope ownership.

## Interactive demo

[Open the public GitHub Pages demo](https://omegdadi.github.io/session-driver/) to inspect your browser, scroll to reverify, see the evidence, and export recent checks. The technique lab runs this exact library on clearly labeled simulated inputs without changing your live verdict. The live view now shows analytics segments and evidence progress; the technique lab still illustrates the original evidence-only detector. Ordinary browsing can become likely human; passive or inconclusive visits remain unclassified.

The demo source lives in `site/`. The Pages workflow tests all three browser engines before deploying changes from `main`. No third-party scripts, analytics, cookies, or persistent browser storage are used by the demo. All detection and measurements run locally; GitHub Pages serves the static assets.

```sh
npm ci
npm run build:site
npm run test:site
# Or preview manually:
node scripts/serve-site.mjs
# http://127.0.0.1:4178/session-driver/
```

To test a deployed copy: `DEMO_URL=https://omegdadi.github.io/session-driver/ npm run test:site`. The tests use fresh isolated browsers, including explicit declaration and hidden-flag cases.

### Browser agents that hide WebDriver

v0.3 adds `classifier.wrapWebMCPTool(execute)` to measure actual execution of your site's WebMCP tools. The [live demo](https://omegdadi.github.io/session-driver/) exposes `reverify_session`; ask a WebMCP-capable browser agent to invoke it and the page reports **AGENT TOOL USED**. Registration alone does not classify anyone. See [integration and limits](./ANALYTICS.md#measuring-actual-webmcp-tool-use-v03). Agents using only normal clicks can remain unclassified; this is not universal passive detection.

### Experimental mouse/input fusion (v0.4)

`createSessionClassifier({ pointerAnalysis: 'observe' })` adds local pointer diagnostics; use `'classify'` to opt into experimental multi-feature inference. The demo enables this mode and includes a pointer sandbox plus optional labeled-result export. It combines repeated sparse/straight paths with click timing or exact-center targeting; speed alone does not classify a visitor. The real Codex in-app browser was detected from ordinary clicks with no WebMCP invocation or agent declaration. This is a measured example, not validated accuracy on human traffic.

Read [standards research, proposed browser contracts, thresholds, and evaluation plan](./RESEARCH.md) before using this mode for metrics. Raw coordinates are processed transiently and never exported. Default library behavior remains unchanged unless you opt in.

### Live state-change listeners (v0.5)

```js
import { createSessionMonitor, toAnalyticsProperties } from '@omegdadi/session-driver';

const session = createSessionMonitor({ pointerAnalysis: 'classify' });
console.log(session.state); // Read the initial state; no synthetic initial event.

const controller = new AbortController();
session.addEventListener('statechange', event => {
  console.log(event.previousState, event.state, event.assessment.reasons);
}, { signal: controller.signal });

session.onassessmentchange = event => {
  // Includes evidence/confidence changes even if the state stays the same.
  analytics.track('driver_assessment', toAnalyticsProperties(event.assessment));
};

// A cooperating Electron/extension host can report start and release immediately:
// session.setHostState({ agentActive: true });
// session.setHostState({}); // Clear host evidence; does not assert human identity.

// Teardown:
// controller.abort(); // Removes just this listener.
// session.stop();     // Removes all input/listeners/timers and freezes the snapshot.
```

This follows visibility/connectivity-style ergonomics: a read-only state plus events on changes. It is our library API, not a new property on `navigator` or `document`. States retain `likely_human`, `likely_automated`, `declared_agent`, and `unclassified` rather than implying verified identity. Pointer inference remains optional/experimental; omit `pointerAnalysis` for the default detector.

Read [the event and lifecycle contract](./ANALYTICS.md#live-monitor-contract-v05) for automatic expiry, polling, listener options, and framework cleanup.
