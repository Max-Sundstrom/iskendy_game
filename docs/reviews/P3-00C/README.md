# P3-00C crash presentation evidence

This card adds a presentation phase after an actual simulated crash. It does not change simulation outcomes.
Images come from the production Vite build in Chromium with `q=low`; desktop is 1440×900 and mobile is a
390×844 touch viewport with device scale factor 3. These are software-rendered, emulated browser captures,
not physical-phone performance evidence. Playwright controls browser time while real input adapters,
fixed simulation ticks and rendering run normally.

The initial compression-only effect was reviewed and found too subtle. A bounded 6° body pitch was added
inside the same .25 s envelope; reduced motion has no pitch, compression, camera pullback or particle cloud.
A landing impact keeps the previous actual simulation tick's orientation because the landing grader resets
the terminal flip angle. This is at most 1/60 s old (about 10.91° at the current flip duration).

Final image set, exact verification results and perf evidence will be recorded after the frozen-build run.
