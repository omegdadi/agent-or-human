import { detectSession, observeSession, createSessionMonitor, toAnalyticsProperties, DETECTOR_VERSION } from './lib/index.js';
const $ = id => document.getElementById(id);
const observer = observeSession();
const history = [];
const monitor = createSessionMonitor({ pointerAnalysis: 'classify' });
const stateEvents = [];
const transitions = [];
const experimentEvents = [];
let exposure = null;
const describeSegment = assessment => ({
  unclassified: ['UNCLASSIFIED', 'Insufficient evidence', 'Browse naturally: click or tap, scroll, or use your keyboard. Varied activity over several seconds can support a likely-human assessment. Passive visits remain unclassified.'],
  likely_human: ['LIKELY HUMAN', 'Behavioral heuristic · not verified identity', 'Your recent interaction pattern is compatible with human browsing. This is an unvalidated heuristic; an agent imitating that pattern can receive the same segment.'],
  likely_automated: assessment.reasons.includes('webmcp-tool-invoked') ? ['AGENT TOOL USED', 'Observed tool execution · heuristic segment', 'A WebMCP tool ran in this page within the last 30 seconds. This supports the likely-automated analytics segment, but page scripts and developer tools can invoke it too. It does not prove who controls every action.'] : ['LIKELY AUTOMATED', assessment.confidence === 'strong_signal' ? 'Strong browser signal · not agent identity' : 'Behavioral heuristic · not verified identity', 'Automation evidence is present. This may be an AI agent, a test runner, or another automated system. See the supporting reasons below.'],
  declared_agent: ['DECLARED AGENT', 'Explicit declaration · not verified identity', 'The page or host explicitly identifies an agent. This remains cooperative metadata, separate from inferred automation.'],
}[assessment.segment]);
function renderAssessment(assessment) {
  const [word, basis, explanation] = describeSegment(assessment);
  $('verdict').textContent = word; $('basis').textContent = basis; $('explanation').textContent = explanation;
  $('verdict-stage').dataset.state = assessment.segment;
  $('raw-result').textContent = JSON.stringify(assessment, null, 2);
  $('analytics-result').textContent = JSON.stringify(toAnalyticsProperties(assessment), null, 2);
  $('behavior-progress').textContent = `${assessment.behavior.trustedEvents} accepted trusted interactions · ${(assessment.behavior.activeSpanMs / 1000).toFixed(1)}s of activity · ${assessment.behavior.modalities.length} input types · ${assessment.behavior.variedCadence ? 'varied timing' : 'more timing variation needed'}`;
  $('segment-reasons').textContent = `Evidence: ${assessment.reasons.join(', ')} · Confidence: ${assessment.confidence} · Detector: ${assessment.detectorVersion}`;
  renderSignals(assessment.detection);
  $('pointer-result').textContent = JSON.stringify(assessment.pointer, null, 2);
  $('pointer-verdict').textContent = describeSegment(assessment)[0];
}
monitor.addEventListener('assessmentchange', event => {
  const assessment = event.assessment;
  transitions.unshift(toAnalyticsProperties(assessment)); transitions.length = Math.min(transitions.length, 32);
  renderAssessment(assessment);
});
monitor.addEventListener('statechange', event => {
  stateEvents.unshift({ previous: event.previousState, state: event.state, at: new Date().toISOString() });
  stateEvents.length = Math.min(stateEvents.length, 12);
  $('state-events').textContent = JSON.stringify(stateEvents, null, 2);
});
for (const type of ['pointerdown', 'pointerup', 'keydown', 'wheel']) window.addEventListener(type, () => requestAnimationFrame(() => renderAssessment(monitor.refresh())), { passive: true });
let checks = 0;
let checkpoints = 0;
const describe = result => ({
  unknown: ['UNKNOWN', 'Not enough evidence', 'No strong automation signal is exposed. You may be human, or an agent whose control is not visible to this page.'],
  automated: ['AUTOMATED', 'Browser control detected', 'Your browser reports automation. This could be an agent or a test runner; the browser does not reveal which.'],
  agent: ['AGENT', 'Explicit declaration · not verified identity', 'This page or its host declares that an agent is driving. That declaration is cooperative metadata, not independent proof.'],
  human: ['HUMAN', 'Self-declared · not verified identity', 'This page declares a human is driving. No exposed WebDriver signal contradicts it, but human identity is not independently verified.'],
  unsupported: ['UNAVAILABLE', 'No accessible browser document', 'This environment does not expose a browser document for detection.'],
}[result.verdict]);
const signalInfo = [
  ['webdriver', 'WebDriver', 'STRONG', 'A browser-provided flag for automation. It cannot distinguish an AI agent from a test runner.', 'Not exposed'],
  ['headless-user-agent', 'Headless browser', 'WEAK', 'A headless user-agent string is easy to change. It is supporting evidence only.', 'Not observed'],
  ['debugger-attached', 'Browser control bridge', 'WEAK', 'Requires an Electron or extension integration. Websites cannot read browser-owned control banners.', 'Not connected'],
  ['agent-ui-indicator', 'Agent UI indicator', 'WEAK', 'Requires a known in-page selector. No vendor-specific overlay is configured in this demo.', 'Not configured'],
  ['webmcp-tool-invoked', 'Recent tool execution', 'HEURISTIC', 'An instrumented WebMCP callback ran within 30 seconds. Tool use is observable; the caller’s identity is not verified.', 'Not observed'],
  ['webmcp-available', 'WebMCP capability', 'DIAGNOSTIC', 'A tool-capable browser does not mean an agent is currently using it.', 'Not observed'],
  ['declaration', 'Driver declaration', 'COOPERATIVE', 'An explicit page or host declaration. Any page script can set it; it is not identity verification.', 'None'],
];
function renderCounts() {
  const { interactions } = observer.getSnapshot();
  $('trusted-count').textContent = interactions.trusted;
  $('synthetic-count').textContent = interactions.synthetic;
}
observer.subscribe(renderCounts);
function renderSignals(result) {
  $('signals').replaceChildren(...signalInfo.map(([code, title, strength, explanation, inactive]) => {
    const signal = result.signals.find(s => code === 'declaration' ? ['declared-agent', 'declared-human', 'host-agent-active'].includes(s.code) : s.code === code);
    const card = document.createElement('article'); card.className = 'signal';
    const top = document.createElement('div'); top.className = 'signal-top';
    const heading = document.createElement('h3'); heading.textContent = title;
    const badge = document.createElement('span'); badge.className = `tag${signal ? ' active' : ''}`;
    badge.textContent = signal ? (code === 'declaration' ? signal.code.replace('declared-', '').replace('host-agent-active', 'host agent') : 'Observed') : inactive;
    const copy = document.createElement('p'); copy.textContent = explanation;
    const label = document.createElement('small'); label.className = 'strength'; label.textContent = strength;
    top.append(heading, badge); card.append(top, copy, label); return card;
  }));
}
function verify(trigger) {
  const result = monitor.refresh();
  const [word, basis] = describeSegment(result);
  const now = new Date();
  checks++;
  if (trigger === 'Scroll checkpoint') checkpoints++;
  renderAssessment(result);
  $('last-check').textContent = `Checked at ${now.toLocaleTimeString()}`;
  $('check-count').textContent = checks; $('scroll-count').textContent = checkpoints;
  renderCounts();
  history.unshift({ check: checks, trigger, timestamp: now.toISOString(), ...result, interactions: observer.getSnapshot().interactions });
  history.length = Math.min(history.length, 12);
  $('history').replaceChildren(...history.map(entry => {
    const row = document.createElement('tr');
    const values = [`${String(entry.check).padStart(2, '0')}`, entry.trigger, entry.segment.toUpperCase().replaceAll('_', ' '), entry.reasons.join(', '), new Date(entry.timestamp).toLocaleTimeString()];
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    return row;
  }));
  $('verdict-stage').classList.remove('flash');
  requestAnimationFrame(() => $('verdict-stage').classList.add('flash'));
  if (trigger.includes('checkpoint')) $('checkpoint-status').textContent = `Check ${checks}: ${word} · ${basis.toLowerCase()} · ${now.toLocaleTimeString()}`;
}
$('reverify').addEventListener('click', () => verify('Button'));
$('checkpoint-button').addEventListener('click', () => verify('Manual checkpoint'));
// Entering the checkpoint refreshes once. Leaving above rearms it; scrolling below does not.
let checkpointArmed = true;
const checkpointObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && checkpointArmed) { checkpointArmed = false; verify('Scroll checkpoint'); }
    if (!entry.isIntersecting && entry.boundingClientRect.top > 0) checkpointArmed = true;
  }
}, { threshold: 0.5 });
checkpointObserver.observe($('checkpoint'));
const flags = ['webdriver', 'headless', 'debugger', 'overlay', 'webmcp', 'host'];
const scenarios = {
  ordinary: { note: 'An ordinary browser with no exposed signals is unknown, not a verified human.' },
  webdriver: { webdriver: true, note: 'Exposed browser control is detected automatically. It does not prove that an AI is behind it.' },
  agent: { declaration: 'agent', note: 'A cooperative agent identifies itself. This is a declaration, not a fingerprint.' },
  human: { declaration: 'human', note: 'The large Human label requires a declaration. This is not a human verification test.' },
  hidden: { note: 'The intentional blind spot: an agent hiding its signals gets the same result as an ordinary browser.' },
  debugger: { debugger: true, note: 'Human developers use debuggers. Attachment alone must not classify the session as an agent.' },
  overlay: { overlay: true, note: 'Matching an in-page indicator is weak evidence. Browser-owned sidebars cannot be read here.' },
  conflict: { webdriver: true, declaration: 'human', note: 'A human declaration cannot override the browser’s exposed automation flag.' },
};
function renderLab() {
  const enabled = Object.fromEntries(flags.map(flag => [flag, $(`lab-${flag}`).checked]));
  const declaration = $('lab-declaration').value;
  const result = detectSession({
    scope: {
      document: { modelContext: enabled.webmcp ? {} : undefined, querySelector: () => enabled.overlay ? {} : null },
      navigator: { webdriver: enabled.webdriver, userAgent: enabled.headless ? 'HeadlessChrome/153.0' : 'DemoBrowser/1.0' },
      __SESSION_DRIVER__: declaration || undefined,
    },
    host: { debuggerAttached: enabled.debugger, agentActive: enabled.host },
    agentIndicatorSelectors: ['[data-demo-agent-overlay]'],
  });
  const [word, , explanation] = describe(result);
  $('lab-verdict').textContent = word;
  $('lab-explanation').textContent = explanation;
  $('lab-result').textContent = JSON.stringify(result, null, 2);
}
$('scenario').addEventListener('change', () => {
  const scenario = scenarios[$('scenario').value];
  for (const flag of flags) $(`lab-${flag}`).checked = Boolean(scenario[flag]);
  $('lab-declaration').value = scenario.declaration || '';
  $('scenario-note').textContent = scenario.note;
  renderLab();
});
for (const id of [...flags.map(flag => `lab-${flag}`), 'lab-declaration']) $(id).addEventListener('change', () => {
  $('scenario-note').textContent = 'Custom combination. The real detector evaluates these simulated inputs; the live browser verdict is unchanged.';
  renderLab();
});
$('download').addEventListener('click', () => {
  const data = { library: '@omegdadi/session-driver', version: DETECTOR_VERSION, exportedAt: new Date().toISOString(), currentAssessment: monitor.refresh(), checks, scrollCheckpoints: checkpoints, interactions: observer.getSnapshot().interactions, history, segmentTransitions: transitions, experimentEvents, stateEvents, validationContext: { driver: $('validation-driver').value, inputMethod: $('validation-input').value, source: 'self-reported-not-used-by-classifier' } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'session-driver-results.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function renderExperiment() { $('experiment-result').textContent = experimentEvents.length ? JSON.stringify(experimentEvents, null, 2) : 'No example events recorded. Nothing is sent to a server.'; }
$('record-exposure').addEventListener('click', () => {
  if (exposure) return;
  exposure = { variant: $('example-variant').value, properties: toAnalyticsProperties(monitor.refresh()) };
  experimentEvents.push({ event: 'example_exposure', variant: exposure.variant, ...exposure.properties });
  $('example-variant').disabled = true; $('record-exposure').disabled = true; $('record-conversion').disabled = false;
  renderExperiment();
});
$('record-conversion').addEventListener('click', () => {
  if (!exposure) return;
  experimentEvents.push({ event: 'example_conversion', variant: exposure.variant, segment_at_exposure: exposure.properties.session_driver_segment, ...toAnalyticsProperties(monitor.refresh()) });
  if (experimentEvents.length > 12) experimentEvents.splice(1, 1);
  renderExperiment();
});
$('reset-experiment').addEventListener('click', () => { exposure = null; experimentEvents.length = 0; $('example-variant').disabled = false; $('record-exposure').disabled = false; $('record-conversion').disabled = true; renderExperiment(); });
window.addEventListener('pageshow' , event => { if (event.persisted) verify('Page restored'); });
verify('Page loaded');
transitions.push(toAnalyticsProperties(monitor.assessment));
renderExperiment();
$('scenario-note').textContent = scenarios.ordinary.note;
renderLab();

// Register a real page action. Merely registering/discovering it never changes the segment.
async function registerReverifyTool() {
  try {
    const context = document.modelContext ?? navigator.modelContext;
    if (!context?.registerTool) {
      $('tool-status').textContent = 'WebMCP is unavailable here. Ordinary browser checks still work.';
      return;
    }
    await context.registerTool({
      name: 'reverify_session',
      description: 'Reverify this page’s session and return its analytics evidence. Invoking this tool records recent WebMCP tool use in the local classifier; it does not declare or authenticate an agent. No data is sent to a server.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: monitor.wrapWebMCPTool(() => {
        verify('WebMCP tool');
        return { content: [{ type: 'text', text: JSON.stringify(toAnalyticsProperties(monitor.assessment)) }] };
      }),
    });
    $('tool-status').textContent = 'Ready: a browser agent can call reverify_session. Availability alone does not change your segment.';
  } catch {
    $('tool-status').textContent = 'This browser could not register the WebMCP tool. Ordinary browser checks still work.';
  }
}
registerReverifyTool();

for (const button of document.querySelectorAll('.pointer-target')) button.addEventListener('click', () => { $('pointer-action').textContent = `${button.textContent} selected. No task is gated by this measurement.`; renderAssessment(monitor.refresh()); });
