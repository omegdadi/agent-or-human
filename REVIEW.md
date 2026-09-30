# Independent review — v0.6.1

A sub-agent reviewed v0.6.0 with only the repository path, live demo URL, npm name, and product purpose. It inspected implementation and API contracts, opened the live demo, reproduced defects, and then reviewed the fixes without editing files.

| Finding | Resolution | Regression coverage |
| --- | --- | --- |
| Reentrant classifier callbacks could hide a transition from later subscribers. | Queue isolated transition snapshots; skip removed listeners; stop cancels pending callbacks. | Ordered agent/unclassified transitions, snapshot mutation, unsubscribe and stop. |
| WebMCP wrappers discarded the callback receiver. | Preserve dynamic `this` through the classifier and monitor wrappers. | Receiver changes, TypeScript receiver typing, execution after stop. |
| Observer exceptions prevented later subscribers from running. This was documented behavior, improved as hardening. | Isolate each subscriber and queue snapshots for reentrant input. | Throwing/mutating callbacks and nested input delivery. |
| Monitor raw assessments could remain stale without polling. | An internal assessment channel synchronizes the monitor on every accepted input; count-only updates stay silent. | Polling-disabled input counts and same-state updates. |
| Demo repeatedly rewrote live regions and reconstructed evidence cards. | Coalesce render requests, change text only when necessary, retain unchanged cards, and display count-only expiry. Remove redundant progress/status announcements. | DOM identity, no unchanged-verdict mutations, idle count expiry across Chromium, Firefox, WebKit. |
| Follow-up review found duplicated transitions in the initial monitor fix. | Deliver internal assessments immediately through one path; queue only public classifier callbacks. | Multiple nested host updates and nested tool callbacks see current state without replay. |

Release verification: 60 unit tests plus TypeScript consumers; 18 desktop browser integration checks; 12 input checks across desktop, Android phone, iPhone and iPad emulation; 42 demo checks; packed ESM/CommonJS imports. CI also runs Electron and Expo web.

These checks validate behavior and API contracts. They do not establish real-world human/agent classification accuracy, physical-device coverage, or screen-reader usability. No new accuracy claim is introduced.
