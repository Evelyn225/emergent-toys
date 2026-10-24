# Current quality work: Codex and Claude

Updated 2026-10-24 (Claude, after PR #198). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** reported store-window miniature railway geometry and rendering
  cost, on `codex/window-railway-repair`. Repair complete: all 12 focused browser
  checks pass, alongside bundle/parser/render-cost/pure-story checks; visual
  review includes both sides, night and phone. Owns `city/street-scenes.js`,
  `city/street-scenes-render.js`, and railway/street-scene tests.
- **Claude:** pass 3 coolers, sacks and crates are done on
  `codex/dining-crates-coolers`, **PR #198** (open, current with main incl. #197;
  bundle rebuilt, both checklist notes kept). New module
  `city/kitchen-crates-coolers.js` and test
  `test/browser/city-crates-coolers.browser.test.cjs`; edits to
  `city/counters.js`, `city/eateries.js`, `city/dining.js`,
  `city/storefronts.js` (cooler facing only), `tools/city-manifest.json`.
  Covers the shared drinks cooler (kebab, takoyaki, taqueria, bodega, motel),
  bakery and pizzeria flour sacks, roastery coffee sacks and yakitori beer
  crates. Checks: Node 1069/1069, shop/kitchen/dining browser suites, life-polish,
  railway + crate tests on the merged tree.
  **In progress (Claude):** `claude/dining-audit-mahjong-sushi`, stacked on
  #198 (its PR targets that branch until #198 merges). Mahjong tables with
  felt trays and tile walls/hands/discards in the mahjong parlour and the tea
  house, the parlour's tea counter with thermos flasks and cups, and the sushi
  chefs' prep bench with nigiri. New `city/teahouse-quality.js` and
  `test/browser/city-teahouse-dining.browser.test.cjs`; edits to
  `city/dining.js`, `city/rooms.js` (tea house tables only),
  `city/eateries.js`, `city/kitchen-displays.js` (sushi kind of the shared
  prep bench). Next after that: a sweep of every dining room for remaining
  painted props. Leaving the seafood restaurant's painted fish tank
  (`city/dining.js` `fishTank`) for the wildlife pass, and the bodega/market
  painted crates (`city/storefronts.js`) for the shop-interiors pass, unless
  Codex wants them.

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
