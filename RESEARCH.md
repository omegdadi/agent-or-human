# Agent or Human research: behavior, provenance, and browser contracts

Research snapshot: 2026-09-29. This document distinguishes published standards, drafts, our measurements, and proposals. Nothing here implies W3C endorsement or measured production accuracy.

## Findings from standards

| Surface | What the specification gives us | What it cannot establish |
| --- | --- | --- |
| [Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/#coalesced-and-predicted-events) | Timestamped positions, pointer types, and coalesced physical-position samples when exposed. Process the parent event OR its coalesced samples, not both. | A universal maximum human speed, guaranteed sampling frequency, or human identity. Our implementation feature-detects coalescing, avoids predicted samples, and excludes touch/pen from mouse rules. |
| [WebDriver actions](https://www.w3.org/TR/webdriver/#actions) | Automation deliberately produces trusted activation events. Pointer actions support zero or positive durations; zero-duration movement can arrive at its endpoint directly. | `isTrusted === true` does not mean human. Automated movement can also be interpolated or made human-like. |
| [DOM event trust](https://dom.spec.whatwg.org/#dom-event-istrusted) | The trust bit distinguishes browser dispatch from script dispatch, with a documented `click()` exception. | It is not proof of physical hardware input or proof of an AI reasoning loop. |
| [HTML user activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation) | Recent/sticky activation exists to gate browser capabilities. | It should not be repurposed as human attestation. The WebDriver contract explains why automated actions can activate a page. |
| [WebMCP draft](https://webmachinelearning.github.io/webmcp/) | Tool registration/execution, with draft activation events. Our callback wrapper measures actual invocation across the implementation tested. | Capability presence does not mean current agent activity. Page scripts can invoke tools. Draft event support must be tested per implementation; our tested browser exposed `ontoolchange`, not `ontoolactivated`. |
| [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421.html) and [Web Bot Auth WG draft](https://datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol-00) | A server can verify signed request components and associate a request with a signing identity under its trust policy. The bot profile remains a draft. | The presence of a signature-looking header is not verification. A signer does not establish that every DOM action is autonomous or that a human is absent. |
| [ChatGPT Work cloud-browser allowlisting](https://help.openai.com/en/articles/11845367-chatgpt-works-cloud-browser-allowlisting) | OpenAI documents signed cloud-browser requests and a Signature-Agent identifier. | This documentation does not establish that local Codex IAB requests use that contract. A client-only GitHub Pages demo has no request-verification backend. |

These are separate trust layers. We should keep behavioral inference, tool-channel observations, host declarations, and cryptographically verified request identity separately attributable, instead of summing them into an invented confidence percentage.

## Mouse behavior is promising, but not a new discovery

[BeCAPTCHA-Mouse](https://arxiv.org/abs/2005.00890) studies mouse dynamics and synthetic bot trajectories with a benchmark. It supports investigating behavior; it does not validate our thresholds or demonstrate accuracy on modern agent browsers. [DMTG](https://arxiv.org/abs/2410.18233) researches human-like mouse generation, illustrating why a motion-only detector is an arms race. Our useful contribution can be an open, inspectable combination of evidence with reproducible evaluation and explicit browser/agent provenance contracts.

## v0.4 experiment: multiple observable features

Enabled on the demo; opt-in in the package. `pointerAnalysis: 'observe'` reports features without changing classification. `'classify'` enables the experimental rules. Omission adds no pointer-movement listeners.

The collector considers trusted, primary mouse input only. It retains at most 128 trajectory points, 128 movement aggregates, and 16 completed gestures. Gesture/measurement aggregates use a rolling 30-second window. Paths reset across scroll, resize, pointer exit/cancel, window blur, visibility/lock changes, pointer changes, or a gap over 10 seconds since the last click. Element focus changes do not count as leaving the window. Hidden documents, pointer lock, dragging, invalid coordinates, and non-mouse input do not provide qualifying mouse gestures. Timer-rounded zero durations do not count as short presses.

| Candidate feature | Initial threshold | Role |
| --- | --- | --- |
| Sparse transitions | At least 4 transitions of >=120 CSS px, with <=2 intervening movement samples, accounting for >=80% of long transitions | Spatial/path family |
| Uniform straight paths | At least 4 long paths with >=6 movement samples, direct/path length >=0.995, speed coefficient of variation <0.1, and >=80% of long transitions | Alternative spatial/path feature |
| Short presses | At least 4 completed clicks lasting >0 and <=8 ms, >=80% of clicks | Execution family |
| Exact-center targeting | At least 5 clicks within 1 CSS px on each axis of an interactive element's center, >=90% of measurable clicks | Alternative execution feature |
| Observed speed | Consecutive sample deltas >0 and <=100 ms; record max CSS px/ms and count >=10 px/ms | Diagnostic only; null when no valid speed sample exists |

Classification requires at least one spatial/path pattern AND one execution pattern. These are feature families, not statistically independent evidence: sampling artifacts can correlate them. Speed alone, absent movement alone, a single suspicious gesture, center targeting alone, or repeated clicks at one location never satisfy this rule. One candidate pointer pattern blocks the older likely-human heuristic in classify mode, but does not by itself establish automation. Strong browser flags and explicit declarations retain precedence. Recent WebMCP use retains its distinct reason.

Why not use acceleration/jerk immediately? Differentiating sparsely sampled, quantized positions twice or three times amplifies sampling noise. We first need sampling coverage and labeled data. Why not require human tremor? Trackpads, accessibility inputs, and hardware smoothing differ. Why not treat missing wheel/mouse movement as agent proof? Keyboard, touch, screen readers, and DOM accessibility actions have different event sequences.

No DOM text, keys, URLs, target identities, or raw coordinates appear in exports. Coordinates and a target's bounding box are processed transiently for geometry. The package does not transmit or persist anything. Buffers expire on activity/refresh and clear on stop, without a polling timer. Do not describe this opt-in path as collecting no coordinates at all.

## What we actually observed

In a real Codex IAB session, ordinary browser-tool clicks on alternating buttons produced six completed mouse gestures, five sparse long transitions, six short presses, and six center hits. The page changed from unclassified to likely automated without a WebMCP invocation, webdriver override, or declaration. No valid speed estimate was available: each approach arrived as one movement sample after a longer idle interval. That result supports the combined geometry/timing approach, not a claim about universally superhuman speed.

This is a deliberately diagnostic task in one agent/browser environment. It is not a real-world accuracy estimate. A manually operated IAB session, diverse humans, assistive inputs, remote desktops, and other agents have not yet been evaluated as a labeled population.

## Validation before using segments to filter business metrics

1. Collect opt-in, independently labeled human, agent, and mixed/handoff sessions on identical ordinary tasks. Demo labels are self-reported metadata and never inputs to classification. Include mouse, trackpad, keyboard, touch, pen, assistive technology, remote desktop, and fast/experienced users.
2. Include WebDriver/CDP, screenshot/OS control, DOM/accessibility actions, WebMCP, and agent-to-human handoffs. Record controller family outside the detector. Avoid training/test leakage from one browser version or one scripted button layout.
3. Split evaluation by participant/device and by held-out agent/controller, not random events from the same session. Pre-register thresholds on a development set; evaluate the frozen rule on a separate set.
4. Report false positives, false negatives, unclassified coverage, time/actions to detection, and confidence intervals per input mode. Run ablations: flags only; behavior only; each feature family removed; fused detector. A successful fixture test is not an accuracy measurement.
5. For A/B tests, retain randomized assignment, exposure-time segment, current segment, and detector version. Report the overall randomized result and unclassified share. Behavior may change under the treatment; dynamic segmentation is exploratory until validated.

## Browser/agent contract proposal — not an existing API

A standards-oriented successor should expose scoped provenance rather than try to infer intelligence from motor behavior. Proposed concepts for discussion:

- **Event provenance:** browser-owned `physical`, `accessibility`, `automation`, or `unknown` channel metadata. Accessibility must remain a first-class human-compatible path, with coarse privacy-preserving disclosure. Do not expose disability, device identifiers, or raw agent prompt content.
- **Control lifecycle:** origin-scoped, short-lived control leases with start/stop/handoff events. Support mixed human/agent control instead of a permanent session boolean. Browser-owned UI should correspond to the lease, rather than force websites to scrape a banner.
- **Disclosure and trust:** sites cannot set browser-owned provenance. An unknown or undisclosed controller remains unknown; refusal should not imply automation. Consider user control, permissions policy, frame boundaries, and fingerprinting risks before standardization.
- **Tool-call attribution:** WebMCP should allow distinguishing a page-script invocation, browser agent invocation, extension/developer invocation, and unknown origin under an explicit trust model. A trusted dispatch bit alone is not sufficient.
- **Request evidence:** verify signed agent requests on the server using an established verifier/profile, enforce freshness and replay policy, bind the result to the current request, and provide a minimal same-origin response attribute. Never trust a client-provided `verified: true`. This remains separate from current browser-control provenance.

Our existing `host.agentActive` integration remains a declaration, not attestation. This release does not invent a standard browser property or implement a home-grown HTTP-signature verifier. A next implementation should add a verified server adapter only against a concrete deployment and test keys, then preserve evidence provenance in analytics.

## Additional hypotheses worth testing, not yet classification rules

| Candidate | Experiment | Main confounder / constraint |
| --- | --- | --- |
| Input-sequence consistency | Compare move/down/up/click sequences and keyboard activation; measure which channels actually deliver events | Accessibility activation, framework-generated clicks, and touch compatibility events are legitimate |
| Scroll-to-target patterns | Compare wheel/touch/key inputs with scroll changes and subsequent precise target clicks | Smooth scrolling, anchors, layout shifts, and programmatic site behavior; no missing-wheel-only rule |
| Per-target approach dynamics | Measure deceleration/corrections relative to target distance and size, rather than a universal speed limit | Trackpads, high-DPI mice, zoom, motor variation, and sparse samples; CSS px/ms is not physical hand speed |
| Repeated interaction templates | Detect recurring geometric/timing sequences across distinct actions inside one page, without cross-site identity | Highly repetitive human workflows and macros; cap memory and avoid behavioral fingerprints |
| Render-to-action timing | Compare target appearance with interaction under controlled experiments | Long tasks, delayed event delivery, background throttling, and pre-known UI state; cannot infer that a person did not see a target |
| Controller handoff | Examine changes in feature distributions alongside explicitly reported control start/stop | Different tasks naturally change behavior; avoid carrying one agent label through an entire human-owned session |

Avoid hidden links, invisible instructions to agents, or intentionally deceptive traps. They measure tool policy and task interpretation more than control provenance. We need representative interactions with independently labeled operators, not a demo optimized to catch the one agent used to write it.

## Cross-device implementation in v0.6

The library follows the W3C Pointer Events model for mouse, touch, and pen, with a legacy touch/mouse fallback selected by capability. Keyboard and standalone high-level click activation are observed separately, as the [Pointer Events introduction](https://www.w3.org/TR/pointerevents3/#intro) recommends for input not covered by pointer streams. Compatibility events are deduplicated. Mouse movement rules remain limited to primary mouse input; no touch speed or pressure threshold is claimed as automation evidence. User-agent parsing has been removed entirely.

This is a library-owned session evidence API, not a polyfill for a standardized human/agent identity API. A standards-shaped event interface can adopt future browser provenance signals without claiming that browsers currently expose universal agent identity. Scope remains browser session control and analytics; general device/browser parsing is outside the package.
