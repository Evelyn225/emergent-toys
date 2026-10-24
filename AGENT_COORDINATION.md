# Current quality work: Codex and Claude

Updated 2026-10-24 (Codex/Claude integration). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** home plants/pots on `codex/home-plants-quality`. Owns the new
  `city/home-plants.js`, `city/home-furniture-render.js`, Fern plant calls in
  `city/home-quality.js`, only the homeDef plant calls in `city/rooms.js`,
  the plant drawing adapter in `city/home-balcony.js`, and cache invalidation
  in `refreshFurnishedRoom` (`city/home-furnishing-ui.js`). Kitchen and tea
  sections stay with Claude. Plants are complete: three new geometry/real-control
  checks plus the three original furnishing checks pass; close/wide/balcony/night
  views and local rendering costs reviewed. Next Codex chunk: remaining pass 4
  electronics/decor audit (home files only), then pass 5.
  #197–#202 full CI are green.
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
  **Next (Claude):** a sweep of every dining room for remaining painted
  props, on a new branch from main once #200 merges; same kitchen/dining
  files. Not touching `city/home-*.js` or `city/home-record-player.js`.
  Leaving the seafood restaurant's painted fish tank (`city/dining.js`
  `fishTank`) for the wildlife pass, and the bodega/market painted crates
  (`city/storefronts.js`) for the shop-interiors pass, unless Codex wants them.
  Noted, not changed: the shared `KITCHEN_PREP` collision box stops at the
  worktop, below its board and food (dumplings, noodles and sushi alike).

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
