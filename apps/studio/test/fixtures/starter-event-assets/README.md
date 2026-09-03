# Synthetic starter-event asset fixtures

Tiny (68-byte, 1×1, real/valid) placeholder PNGs at the exact relative paths
`scripts/build-halloween.ts`/`scripts/build-christmas.ts` expect under an
`ASSET_DIR`. Used only by `test/starterEvents/simulationCoverage.test.tsx`'s
automated CI run, via those scripts' optional 4th CLI argument — never by a
person building the real official starter projects, which still default to
(and should keep using) the real, approved artwork in the sibling `../FDraft`
checkout's `public/events/<slug>/`.

Not decorative content in their own right — this test's own concern is the
project *structure* those scripts build (Candy Bowl Behaviour rules, copy
slots, popups, simulator scenarios, publish outcome), not the pixels.
