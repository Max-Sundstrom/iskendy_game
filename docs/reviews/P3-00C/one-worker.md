# P3-00C: controlled single-worker crash experiment

The one authorized local production run **passed all six crash cases** on clean candidate
`6c9646f122ec2cde1b11294daf26b9a1b2c29791`, using the CLI override `--workers=1`.
The repository configuration still specified two workers during measurement. After independent review, the
orchestrator changed that configuration to one worker; the new published-head full CI result is still pending.
This result does not replace the full smoke, container, headers/embed or cross-engine CI gates.

## Controlled inputs and actual outcomes

Compared with the [failed two-worker candidate](ci-horizon.md), the three E2E source blobs are identical.
Both runs used the same existing production bundle `index-DhBb9taH.js`, Node 24.19.0, pnpm 12.11.2,
Playwright 1.64.0, Chromium 154.0.8037.57, deployment CSP, viewports, quality and trace options. No build,
fixture, runtime or dependency change occurred between the compared runs. The only test-execution option
changed was the worker count. Background resource conditions were not captured for the earlier run.

| Case | Two workers, previous run | One worker, this run |
| --- | --- | --- |
| Desktop: three crashes / two Retry / hidden / live reduced motion | 120 s timeout; 120.767 s reported | **64.995 s, passed** |
| Desktop: initial reduced motion | 45.987 s, passed | **23.631 s, passed** |
| Desktop: real bad landing | 45.190 s, passed | **22.773 s, passed** |
| Mobile: three crashes / two Retry / hidden / live reduced motion | 51.725 s, passed | **24.147 s, passed** |
| Mobile: initial reduced motion | 18.268 s, passed | **9.830 s, passed** |
| Mobile: real bad landing | 10.368 s, passed | **9.042 s, passed** |

The successful suite took **157.705 s**, or **158.563 s** including the resource wrapper/startup. The previous
two-worker suite took 152.705 s but failed one case and did not finish its third replay/results assertions;
those totals are not equivalent completed-work throughput measurements.

Both viewports completed all 68/65/63 driving frames and all three first-impact guards: exactly one transition
into `crashing` and equal first/current mocked timestamps. Their exact replays remained seed 96/tick 339/hash
`97c6d523`, seed 97/tick 324/hash `27d0477e`, seed 98/tick 313/hash `3c1697fe`. Both real Retry actions, the final
third results assertions, one-shot recording, hidden and reduced-motion PNG equality, focus/frozen distance,
initial reduced motion and real bad landing passed. No trajectories, assertions, 120 s deadline or zero-retry
setting were shortened or loosened. The repeated fixture still contains 976 sim ticks.

The desktop's 196 driving clock calls took 16.785/14.547/14.307 s across its three runs in this test trace.
The earlier two-worker test trace recorded 32.287/32.892/26.079 s, with its last calls completing only during
timeout teardown. This is a measured local reduction in wall time, not proof of one specific underlying cause.

## Resource measurements

A separate Python sampler observed the actual process tree and cgroup once per second without modifying
Playwright or the game. It recorded 158 samples:

| Measurement | Observed value |
| --- | --- |
| CPU quota (`cpu.max`) | `400000 100000`: **4 CPU equivalents** |
| Effective CPU set | `0-4` |
| Cgroup CPU usage during 158.563 s | **574.304 CPU-seconds**, average **3.622 CPU equivalents** |
| Peak sampled process-tree CPU | **4.122 CPU equivalents** over a sampling interval |
| Cgroup throttling counter increase | **88.254 s**, 1,262 throttled periods of 1,585 periods |
| Memory limit | **16 GiB** |
| Peak sampled process-tree aggregate RSS | **1.328 GiB** |
| Peak sampled cgroup memory | **1.990 GiB** |
| Reported 1/5/15-minute load at start | **0.000 / 0.027 / 0.342** |
| Reported 1/5/15-minute load at end | **3.584 / 1.546 / 0.870** |

Cgroup/load counters include their wider container/kernel scope, not exclusively the E2E process tree.
Aggregate RSS double-counts shared mappings and is not unique physical memory. One-second sampling can miss
short-lived processes or peaks; cgroup counters retain CPU usage that process sampling can miss. The throttling
counter is cumulative scheduler accounting, not a fraction of the test's wall time. Slightly more than four CPU
equivalents in one sample is compatible with period boundaries; the quota is unchanged.

The current workload can use most of its CPU quota even with one worker. Together with the faster individual
cases, this supports the contention hypothesis and the narrowly reviewed scheduling change. However, there is
**no paired two-worker resource recording**, so these data cannot isolate CPU scheduling, renderer, protocol,
trace-capture or background-load contributions. GPU memory, GC and physical-device performance were not measured.

## Evidence and limits

[Machine-readable evidence](one-worker.json) includes the exact measured commit, test/bundle hashes, six trace
SHA256 checksums, endpoint results, replay identities, per-case/clock timings and resource summary. Raw traces,
the JSON Playwright report, sampler source and per-second resource log remain under
`/workspace/scratch/kometa-crash/ci-oct26/one-worker/`. Independent QA matched all three test blobs and the
embedded sources in all six archives; it independently confirmed all guards/replays and completed third results.

Two preparation failures occurred before any browser suite started: the new preview encountered an old owned
orphan on port 5183, and direct Python execution of pnpm's intentional shebang-less shim raised `Exec format
error`. The owned orphan was verified by its exact argv and terminated; the pinned shim was invoked through
`/bin/sh`. Neither preparation failure launched a test. Exactly one complete browser suite ran. Afterward,
the new owned preview PID 9064 was terminated explicitly and port 5183 closure was verified, avoiding the
earlier shell-only SIGINT cleanup mistake. No unrelated server or stable preview was changed.

The orchestrator's later configuration change only selects one worker and explains the software-rendering
constraint. Timeout, retries, viewports and all cases remain intact. The full browser/container jobs have
**25-minute total deadlines**, including dependency installation and container setup. Serial execution needs
full-job timing evidence on the exact published head; this six-case local run does not establish that budget.
No CI rerun, push, merge, deployment or additional browser experiment is claimed by this report. Performance
smoke was not repeated because production source is unchanged.
