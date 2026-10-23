import { mkdirSync, writeFileSync } from 'node:fs';
import { BOTS, runBot, type BotReport } from './run';

// `pnpm bots [runs]` — writes bots-report/report.json and report.md (the nightly dashboard, TEST_STRATEGY §3).
// Alert thresholds from TEST_STRATEGY §3: Novice median ≥ 600 m; no anomalies (NaN, exceptions) for any bot.

const runs = Number(process.argv[2] ?? 200);
const reports: BotReport[] = Object.values(BOTS).map((make) => runBot(make, runs, 1));
const alerts: string[] = [];
for (const r of reports) {
  if (r.anomalies.length > 0) alerts.push(`${r.bot}: ${r.anomalies.length} anomalies (first: ${r.anomalies[0]})`);
}
const nov = reports.find((r) => r.bot === 'novice');
if (nov && nov.medianM < 600)
  alerts.push(`novice median ${nov.medianM.toFixed(0)} m < 600 m (TEST_STRATEGY §3 target)`);

const bar = (n: number, max: number) => '█'.repeat(Math.max(1, Math.round((n / max) * 30)));
const md = [
  `# Synthetic players — ${new Date().toISOString().slice(0, 10)} · ${runs} runs per bot`,
  '',
  alerts.length ? `**Alerts:**\n${alerts.map((a) => `- ${a}`).join('\n')}` : '**Alerts:** none',
  '',
  ...reports.flatMap((r) => {
    const max = Math.max(...r.histogram.map(([, c]) => c));
    return [
      `## ${r.bot}`,
      `median ${r.medianM.toFixed(0)} m · p10 ${r.p10M.toFixed(0)} m · p90 ${r.p90M.toFixed(0)} m · max ${r.maxM.toFixed(0)} m · crashes: rear ${r.causes.rear}, second scrape ${r.causes.secondScrape}, timeouts ${r.causes.timeout}`,
      '',
      '```',
      ...r.histogram.map(([b, c]) => `${String(b).padStart(6)} m  ${bar(c, max)} ${c}`),
      '```',
      '',
    ];
  }),
].join('\n');
mkdirSync('bots-report', { recursive: true });
writeFileSync('bots-report/report.json', `${JSON.stringify({ runs, reports, alerts }, null, 2)}\n`);
writeFileSync('bots-report/report.md', md);
console.log(md);
// Balance alerts are reported, not fatal, until P2 tunes the game; anomalies (NaN, exceptions) fail the run.
process.exit(reports.some((r) => r.anomalies.length > 0) ? 1 : 0);
