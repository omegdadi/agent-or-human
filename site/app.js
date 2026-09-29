import { detectSession, observeSession } from './lib/index.js';
const $ = id => document.getElementById(id);
const observer = observeSession();
const history = [];
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
  const result = detectSession();
  const [word, basis, explanation] = describe(result);
  const now = new Date();
  checks++;
  if (trigger === 'Scroll checkpoint') checkpoints++;
  $('verdict').textContent = word; $('basis').textContent = basis; $('explanation').textContent = explanation;
  $('verdict-stage').dataset.state = result.verdict;
  $('last-check').textContent = `Checked at ${now.toLocaleTimeString()}`;
  $('check-count').textContent = checks; $('scroll-count').textContent = checkpoints;
  $('raw-result').textContent = JSON.stringify(result, null, 2);
  renderSignals(result); renderCounts();
  history.unshift({ check: checks, trigger, timestamp: now.toISOString(), ...result, interactions: observer.getSnapshot().interactions });
  history.length = Math.min(history.length, 12);
  $('history').replaceChildren(...history.map(entry => {
    const row = document.createElement('tr');
    const values = [`${String(entry.check).padStart(2, '0')}`, entry.trigger, entry.verdict.toUpperCase(), entry.signals.map(s => s.code).join(', ') || 'No exposed signals', new Date(entry.timestamp).toLocaleTimeString()];
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
  const data = { library: '@omegdadi/session-driver', version: '0.1.0', exportedAt: new Date().toISOString(), checks, scrollCheckpoints: checkpoints, interactions: observer.getSnapshot().interactions, history };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'session-driver-results.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('pageshow', event => { if (event.persisted) verify('Page restored'); });
verify('Page loaded');
$('scenario-note').textContent = scenarios.ordinary.note;
renderLab();
