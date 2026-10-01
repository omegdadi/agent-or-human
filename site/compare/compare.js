import { createSessionMonitor, connectBotD, createSessionHistory, DETECTOR_VERSION } from '../lib/index.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { const next = String(value); if ($(id).textContent !== next) $(id).textContent = next; };
const monitor = createSessionMonitor({ pointerAnalysis: 'classify' });
const history = createSessionHistory(monitor, { limit: 30 });
let connection; let loading; let result = null; let checkedAt = null;
function render() {
  const assessment = monitor.assessment;
  text('session-label', assessment.segment.replaceAll('_', ' ').toUpperCase());
  text('session-result', JSON.stringify({ segment: assessment.segment, confidence: assessment.confidence, reasons: assessment.reasons, providers: assessment.providers, detectorVersion: DETECTOR_VERSION }, null, 2));
  text('session-summary', JSON.stringify(history.getSummary(), null, 2));
  text('session-history', JSON.stringify(history.getEntries(), null, 2));
}
monitor.addEventListener('assessmentchange', render);
setInterval(render, 1000); render();
$('run-botd').addEventListener('click', async () => {
  $('run-botd').disabled = true; $('clear-botd').disabled = true;
  text('comparison-status', 'Running a real BotD check…');
  try {
    loading ??= import('../lib/botd.js').then(module => module.load({ monitoring: false })).catch(error => { loading = undefined; throw error; });
    const detector = await loading;
    connection ??= connectBotD(monitor, detector);
    result = await connection.refresh(); checkedAt = new Date().toISOString();
    text('botd-label', result?.bot ? 'AUTOMATION DETECTED' : 'NOT DETECTED');
    text('botd-result', JSON.stringify({ result, checkedAt }, null, 2));
    text('comparison-status', 'Check complete. BotD evidence is attached for 60 seconds; not detected does not prove human.');
    $('clear-botd').disabled = false;
  } catch {
    text('comparison-status', 'BotD could not complete this check. No positive result is being assumed. Reload this page to retry a failed library download.');
    text('botd-label', 'CHECK FAILED'); result = null; checkedAt = null;
    text('botd-result', 'No current result.');
  } finally { $('run-botd').disabled = false; render(); }
});
$('clear-botd').addEventListener('click', () => {
  connection?.stop(); connection = undefined; $('clear-botd').disabled = true;
  text('comparison-status', 'BotD evidence removed from the live monitor. The left card retains its last historical check.'); render();
});
$('export-comparison').addEventListener('click', () => {
  const data = { version: DETECTOR_VERSION, botdVersion: '2.0.0', botd: { result, checkedAt }, assessment: monitor.refresh(), transitions: history.getEntries(), summary: history.getSummary(), note: 'One session; not an accuracy benchmark. No raw BotD components included.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'agent-or-human-comparison.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
