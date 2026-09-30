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
