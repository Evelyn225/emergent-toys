# Current quality work: Codex and Claude

Updated 2026-10-24 (Codex/Claude integration). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** pass 4 home electronics and decoration. Fitted lamps are merged
  in #199; the record player/cabinet is complete on `codex/home-record-player`
  (`city/home-record-player.js`, `city/home-furniture-render.js` and the new
  record-player browser test). Six focused home/control checks pass.
  Next: framed photographs and their physical mounts, in a new
  `city/home-frames.js` module and `city/home-furniture-render.js`.
  Kitchen files remain with Claude. Railway #197 and Claude's #198 full CI
  are green; #199 full CI is still running at this update.
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
  **Next (Claude, new branch from main after #198):** the rest of the pass 3
  audit in dining rooms: mahjong parlour tea urns and tile tables
  (`city/dining.js`), the sushi chefs' bench (`city/eateries.js`), then a sweep
  of every dining room for remaining painted props. Leaving the seafood
  restaurant's painted fish tank (`city/dining.js` `fishTank`) for the wildlife
  pass, and the bodega/market painted crates (`city/storefronts.js`) for the
  shop-interiors pass, unless Codex wants them.

Codex review follow-up in #199: include the open beer crate bottle necks in
its model bounds, and strengthen the crate check to test actual drawn parts.

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
