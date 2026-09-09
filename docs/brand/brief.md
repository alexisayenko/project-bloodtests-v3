# Brand brief

The prompt below was written on 2026-09-08 to get domain-name candidates
from an external model, and then reused unchanged to generate the visual
concepts. It is kept verbatim because it is the only place the product's
positioning has been written down in full — `CLAUDE.md`'s Product section
is still a placeholder — and because reusing the same brief is what kept
the name and the artwork pointing the same way.

What came out of it: the working name **Paneloom**, the four lockups in
this folder, and [`landing-concept.png`](landing-concept.png).

Two things to know before reusing it. The candidate list it cites is a
snapshot — see "Names considered" in [`README.md`](README.md) for the
current one, including registration status. And it deliberately tells the
model *not* to check availability, because a model cannot; that stayed the
right call, since the `whois` CLI got it wrong twice here and only RDAP
with per-TLD controls held up.

---

```
I need domain-name candidates for a personal health web app. Here's the full context.

WHAT IT IS
A blood-test tracking app. You upload your lab reports (as JSON), and it keeps a
longitudinal history across years and across different laboratories. It is not a
lab, not a diagnostic device, and gives no medical advice.

WHAT MAKES IT DIFFERENT from a laboratory's own patient portal:
- The data never leaves the browser. No backend, no accounts, no server — results
  live in localStorage. Sharing happens only through a read-only link the user
  generates deliberately.
- It normalizes across labs. Results are keyed to LOINC codes, so the same analyte
  reported by different labs, in different units (mg/dL vs mmol/L), in different
  languages (English and Russian printed names), collapses into one comparable
  series. That is the core engineering work.
- It is organized by condition, not by report: "Monitoring Panels" like Hypogonadism,
  Insulin Resistance, Cardiovascular Risk group the relevant markers together.
- It computes derived indices (HOMA-IR, AIP, calculated free testosterone, LDL-C by
  Friedewald and Sampson) with cited primary sources.

AUDIENCE
Right now: the author and his family. Potentially: anyone who gets bloodwork done
regularly across multiple labs and wants to own the history. Data in use comes from
Cypriot and RU/CIS laboratories, so reports arrive in both English and Russian.

CONSTRAINTS
- Currently at a personal subdomain; looking for a real name.
- Public open-source repo. Monetization undecided.
- Must not imply it is a laboratory, a diagnostic service, or medical advice.

CANDIDATES SO FAR (all verified unregistered on 2026-09-08 except where noted)
heman.cc, hematologyanalyzer.cc, serum.im, in-vitro.cc, invitro.im,
bioanalysis.cc, markerly.net, markerly.cc, biomarks.net, biomarks.cc,
bloodtests.cc — and assay.guru, which is taken.

WHAT I'VE ALREADY CONCLUDED — don't repeat these mistakes
- Every candidate above is a synonym for "lab test". None expresses the local/private
  or longitudinal angle, which is the actual differentiator.
- "invitro" clashes with Invitro, a large RU/CIS laboratory chain — the same market
  these reports come from. Hyphenating it doesn't dodge the trademark.
- "heman" reads as He-Man before hematology; "hematology analyzer" is also a specific
  medical device category, which this is not.
- "serum" names one specimen type, but the app also handles whole-blood work (CBC).

WHAT I WANT FROM YOU
1. 20-25 candidates, grouped by the angle they take — at minimum: ownership/privacy,
   longitudinal/trend, cross-lab normalization, and coined/brandable. Explicitly
   cover the differentiators my current list misses.
2. For each: one line on why it works, and any trademark, pronunciation, or
   unfortunate-reading risk you can see. Flag anything likely to collide with an
   existing health or lab brand.
3. Your view on TLD. Is .cc / .im acceptable for a health-adjacent product, or does
   trust argue for .com / .health / .app? Does open-source and personal scale change that?
4. Say which 3 you'd actually pick and why.

Don't check availability — you can't, and I'll verify with whois myself. Prefer names
that are pronounceable aloud and spellable after hearing them once. Avoid anything
that sounds like it diagnoses or treats.
```

---

The one correction the brief itself now carries: it asserts `assay.guru`
is taken. That came from the broken `whois` check and is false — it was
unregistered on 2026-09-08. Kept as written, since this is a record of
what the model was actually told.
