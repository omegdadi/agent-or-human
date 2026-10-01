# Verification

Local verification on macOS arm64, Node 22.22.1, 2026-09-29:

- 13 unit tests passed, including SSR imports/rendering, native/worker fallback, declarations/handoffs, conflicting signals, restricted getters, UI selectors, WebMCP capability, and listener teardown.
- ESM and CommonJS TypeScript consumers passed with **no DOM library**.
- 18 browser cases passed across Playwright Chromium 153, Firefox 155, and WebKit 26.6: WebDriver, trusted automated clicks, synthetic events, hidden automation, declarations, UI signals, React 19.3 rendering.
- Electron 44.4.5 passed in a sandboxed renderer with nodeIntegration disabled and contextIsolation enabled. A real `webContents.debugger` attachment was reported through the host option. Agent-active host state was tested separately as a declaration.
- Expo SDK 57.0.26 exported successfully through Metro; the actual exported application rendered `automated` in Chromium with no page errors.
- An npm tarball installed in an empty consumer directory and loaded through both ESM and CommonJS.
- Root development dependency audit and runtime audit reported zero vulnerabilities. The isolated Expo fixture's dependency tree reported 10 moderate advisories; these are not runtime dependencies of this library.

GitHub Actions independently runs Linux Node 22/24 browser/package checks, a macOS Electron check, and an Expo export/runtime check. Consult the repository's Actions page for current hosted results.

## Repeat Expo verification

```sh
npm ci
npm ci --prefix tests/fixtures/expo
npx playwright install chromium
npm run test:expo
```

## Scope and limitations

These tests establish API/package compatibility and behavior for controlled scenarios. They are **not a benchmark of human-versus-agent detection accuracy**. No representative dataset, precision/recall score, or stealth-agent detection guarantee is claimed.

Native Expo iOS/Android devices were not launched: they have no browser session to classify. Native-like no-document environments are unit-tested to return `unsupported`. Expo Web and Electron were actually built/launched; Vue, Svelte, Angular, and Next.js full applications were not separately built. They can consume the same standard JS exports, with SSR-safe imports tested.

No vendor-specific Atlas/Comet/Gemini active-agent API or toolbar DOM access is claimed. Browser-owned UI is not observable through a normal page's DOM. In-page UI matching is configurable weak evidence. WebMCP detection checks capability only, not native agent invocation. Electron debugger attachment is not a universal remote-debugger enumeration API.

## Public demo verification

The interactive demo adds 21 browser checks (7 scenarios on each of Chromium, Firefox, and WebKit): real-library verdicts and refresh, scroll checkpoint rearming, all lab presets and isolation from live state, unknown fallback, live declarations with visible caveats, bounded JSON history export, and responsive/keyboard controls at 375px and 320px widths. Tests assert no uncaught page errors. The Pages workflow gates deployment on this suite.

## v0.2 analytics verification

Adds 11 deterministic classifier tests for passive traffic, varied input, keyboard-only use, held-key repeats, regular/synthetic input, headless corroboration, signal precedence, declarations, transition notifications, evidence expiry, snapshot isolation, bounded sampling, cleanup, SSR, and serializable analytics properties. The public demo suite adds a real trusted-input journey in each browser engine, demonstrating development of a likely-human segment and stable exposure/conversion variant. This journey deliberately hides automation flags, so it also establishes a known false-negative limitation: a suitably behaving agent can look human. These are functional tests, not a human/agent accuracy benchmark.

## v0.3 WebMCP verification

- 26 unit tests and TypeScript consumers pass, including invocation-only evidence, expiry, stop, failed callbacks, promises, and precedence.
- 27 demo tests pass across Chromium, Firefox, and WebKit. The new regression test mocks registration and invokes the captured callback; it is not a claim of native WebMCP support in all engines.
- Separately tested native WebMCP in Codex's in-app browser: `webdriver` false, normal Chrome/154 user agent, `document.modelContext` present. Initial load remained unclassified. The browser's WebMCP capability discovered `reverify_session`; invoking it changed the actual page to AGENT TOOL USED with `likely_automated`, `heuristic`, and `webmcp-tool-invoked`. No page declaration was injected.
- This confirms instrumented tool-channel measurement. It does not demonstrate passive detection of screenshot/click-only agent control or verified caller identity.

## v0.4 experimental pointer fusion

- 36 unit tests plus ESM/CJS TypeScript consumers: multiple-signal rule, observation-only mode, counterexamples, touch/pen/secondary/untrusted exclusion, coalesced samples, timer rounding, bounded memory, expiry, lifecycle and focus handling.
- 33 site tests across Chromium, Firefox, and WebKit, including ordinary mouse clicks with webdriver hidden and no WebMCP invocation. Optional validation labels are not detector input.
- Native Codex IAB verification: ordinary alternating target clicks produced 6 gestures, 5 sparse transitions, 6 short presses, and 6 exact-center hits; classification changed to likely_automated with behavioral reasons. WebDriver was not exposed and no declaration/tool-use signal was supplied. Speed was not measurable in that example.
- This is implementation verification and a single-controller demonstration, not a labeled human/agent accuracy benchmark. See RESEARCH.md for validation design and unimplemented contract proposals.

## v0.5 live monitor

- 45 unit tests and ESM/CJS TypeScript consumers cover state/evidence event distinction, previous/current snapshots, initial reads, deduplication, removal, once, AbortSignal, object listeners, reentrant transitions, consumer isolation, timer expiry, external declarations, lifecycle wake, and stop cleanup.
- 39 browser demo tests across Chromium, Firefox, and WebKit include native AbortSignal listeners and a real browser interval with an injected clock for evidence expiry. The UI records actual monitor statechange events.
- Existing classifier.subscribe remains timer-free and compatible. The new monitor is a scoped emitter with browser-style listener ergonomics, not a native DOM EventTarget or a browser-vendor identity API.

## v0.6: Agent or Human and cross-device input

52 unit tests pass, including mouse/touch/pen-only cadence, legacy touch compatibility-event suppression, standalone activation, multi-touch exclusion, and a UA getter that must never be read. TypeScript consumers compile without DOM types. 18 desktop integration checks pass across Chromium, Firefox, and WebKit. 12 input checks pass across those engines plus Pixel 7, iPhone 13, and iPad Pro emulation, using real browser-generated tap/click/keyboard events. These verify counts, modality, cleanup, and no accidental mouse inference on touch. 39 demo tests pass. Packed ESM/CommonJS consumers install and import the new `agent-or-human` name.

Input emulation is not validation on physical Android/iOS hardware, Safari releases, pen hardware, or assistive technologies. The touch/pen/legacy cadence cases use deterministic unit fixtures; no human-versus-agent accuracy rate is claimed. Monitor tests with polling disabled explicitly refresh before reading raw counts, because count-only changes do not emit assessment changes.

## v0.6.1: independent review fixes

60 unit tests cover reentrant classifier/observer delivery, callback isolation, unsubscribe/stop, receiver-preserving wrappers, immediate monitor snapshots, and nested host/tool updates without replay. The 42-test demo suite additionally verifies stable unchanged live regions/evidence cards and count-only evidence expiry. The existing 18 desktop and 12 cross-device input checks and packed consumers pass. See [REVIEW.md](./REVIEW.md) for findings and their disposition.

## v0.7.0: BotD integration and comparison

Local validation: 67 unit tests, no-DOM ESM/CommonJS TypeScript consumers, 18 browser contract tests, 12 emulated input-profile tests, 51 site tests across Chromium/Firefox/WebKit, and fresh packed ESM/CommonJS consumers. The comparison uses actual BotD 2.0.0, tests lazy loading, result attachment/removal, failed loading, no external requests, and a 320px layout. Provider tests cover expiry without input, negative results, failure cleanup, coalescing, late-result cancellation, bounds, and immutable snapshots. History tests cover bounded retention and elapsed segment totals. These counts establish API/integration behavior, not detection accuracy.
