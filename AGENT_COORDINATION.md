# Current quality work: Codex and Claude

Updated 2026-10-24 (Codex/Claude integration). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** pass 4 home electronics and decoration. Lamps are merged in
  #199, the record console in #201. Fitted photograph frames are complete on
  `codex/home-photo-frames`, in `city/home-frames.js`,
  `city/home-furniture-render.js` and the new frame browser test. Five focused
  geometry/photo/placement/save checks pass. Next: home plants and their pots,
  in a new `city/home-plants.js` module and `city/home-furniture-render.js`.
  Kitchen/dining files remain with Claude. #197, #198, #199 and #201 full CI
  are green. #200 was integrated/reviewed and merged; its original head had
  green full CI and the updated integration head starts a fresh run.
- **Claude:** pass 3 coolers, sacks and crates are done on
  `codex/dining-crates-coolers`, **PR #198** (merged, current with main incl. #197;
  bundle rebuilt, both checklist notes kept). New module
  `city/kitchen-crates-coolers.js` and test
  `test/browser/city-crates-coolers.browser.test.cjs`; edits to
  `city/counters.js`, `city/eateries.js`, `city/dining.js`,
  `city/storefronts.js` (cooler facing only), `tools/city-manifest.json`.
  Covers the shared drinks cooler (kebab, takoyaki, taqueria, bodega, motel),
  bakery and pizzeria flour sacks, roastery coffee sacks and yakitori beer
  crates. Checks: Node 1069/1069, shop/kitchen/dining browser suites, life-polish,
  railway + crate tests on the merged tree.
  Thanks for the crate-bounds fix in #199; the same flaw was in the new
  mahjong table and tea counter boxes and is fixed in #200 with matching
  bounds checks.
  **Merged (Codex integration review):** `claude/dining-audit-mahjong-sushi`, **PR #200**
  into main (merged with main incl. #201, bundle rebuilt, both checklist
  notes kept). Mahjong tables with felt trays and tile walls/hands/discards
  in the mahjong parlour and the tea house, the parlour's tea counter with
  thermos flasks and cups, and the sushi chefs' prep bench with nigiri. New
  `city/teahouse-quality.js` and
  `test/browser/city-teahouse-dining.browser.test.cjs`; edits to
  `city/dining.js`, `city/rooms.js` (tea house tables only),
  `city/eateries.js`, `city/kitchen-displays.js` (sushi kind of the shared
  prep bench).
  **Pass 3 closing audit (Claude):** `claude/dining-sweep`, checklist and
  coordination only, no source changes. All 29 dining rooms rendered and
  scanned; pass 3 checked in `WORLD_QUALITY.md` with the hand-offs listed
  there (bar back-bar via the shared `shelves` wall painter, fish tank,
  bodega/gas/market food props, street-food carts, pier stall, spirit house,
  lanterns).
  **Next (Claude), claimed unless Codex or the user redirects:** start pass 8
  (restaurants, cafés and bars) where pass 3 left off: a built back bar for
  the bar in place of the `shelves` wall painter, then the paper lanterns
  (yakitori, pho, sushi, izakaya) and the Thai spirit house. Files:
  `city/rooms.js` (bar definition only), `city/counters.js`,
  `city/dining.js`, `city/eateries.js`, plus a new module and browser test.
  Pass 5 (apartments, lofts, Belle homes) is left for Codex after pass 4,
  since it shares the `city/home-*.js` files Codex owns.

## Integration

- Keep a branch per chunk; avoid editing the other agent's owned files.
- Both agents may change `ascii-city.bundle.js`, `tools/city-manifest.json`,
  and append completed notes to `WORLD_QUALITY.md`. Preserve both source/module
  lists and notes, then rebuild the bundle to resolve generated-file conflicts.
- Include focused checks, visual review and measured rendering costs in PRs.
  Keep pass 3 open until its remaining audit is complete.
- Record each finished chunk, branch/PR and next owned files here, so the other
  agent can read it after fetching. This file is asynchronous coordination;
  separate Claude and Codex sessions cannot directly message one another.
