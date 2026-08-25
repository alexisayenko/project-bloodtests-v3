# Performance guide

What "smooth and pleasant" turns into when measured at the user.
Sets the thresholds we hold the product to so regressions are
visible and fixes are objectively verifiable.

## Why it's a UX concern

We don't care that the backend is fast or the frontend renders
quickly — we care that the chain (frontend ↔ backend ↔ db) *feels*
fast to the user. Per-layer benchmarks are diagnostic inputs when
an end-to-end metric regresses, not goals in themselves.

## Metrics & thresholds (end-to-end)

End-to-end means measured at the user. Layer-internal numbers
(DB query time, API response time) are addressed separately
under [Diagnostic](#diagnostic-per-layer-when-end-to-end-fails).

### Web — Core Web Vitals

- **LCP** (Largest Contentful Paint) ≤ 2.5s — the page feels
  "loaded."
- **CLS** (Cumulative Layout Shift) ≤ 0.1 — content stays still
  after load; no jumping headlines.
- **INP** (Interaction to Next Paint) ≤ 200ms — taps and clicks
  feel responsive.

### Mobile

- Scroll FPS ≥ 58 — no visible jank during scroll on a
  mid-tier device.
- Cold-start time ≤ 2s — app launch from icon-tap to first
  interactive frame.
- Jank-frame % ≤ 1% — under 1% of frames miss the 16.6 ms
  budget.

### Bundle / asset budgets

- [TODO: web initial JS payload ≤ X kB.]
- [TODO: image budget per page ≤ Y kB.]

## Tools

### Web

- [Lighthouse](https://developer.chrome.com/docs/lighthouse) —
  run before each release; record the score.
- Chrome DevTools Performance panel — flame charts when
  investigating a regression.
- [WebPageTest](https://www.webpagetest.org/) — cross-region
  / cross-device runs when local numbers don't reproduce.

### Mobile — iOS

- Xcode Instruments — CPU, memory, animation timeline.
- React Native Perf Monitor (if RN) — FPS overlay during dev.

### Mobile — Android

- Android Studio Profiler — CPU, memory.
- [Perfetto](https://perfetto.dev/) — system-level traces.

## Diagnostic (per-layer, when end-to-end fails)

When an end-to-end metric regresses, drill into per-layer
numbers to localize the cause. These numbers are *inputs*, not
goals.

- **DB** — slow-query log; query latency at the 95th
  percentile.
- **Backend** — API latency at the 95th percentile; cache hit
  rate.
- **Frontend** — hydration cost; render thrash; image decode
  time.

A fast backend with a slow page paints the user a slow
product. Always close the loop back to the user-felt metric.

## Cadence

- Run web Lighthouse + mobile build profiling **before each
  release**.
- Record numbers in a release note or milestone entry; flag
  regressions vs the prior baseline in the same place.
- Investigate any metric over threshold before shipping. If a
  fix isn't possible, document the trade-off as a decision in
  [`../tech/`](../tech/).

## Open questions

- [TODO: project-specific thresholds — fill in numeric targets
  for any `X kB` or `Y kB` placeholder above.]
- [TODO: which tools fit the actual stack — drop the rows that
  don't apply.]
