# Current quality work: Codex and Claude

Updated 2026-10-25 (Codex/Claude integration). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** pass 4 shelf books on `codex/home-books-quality`. Owns
  `city/furniture-quality.js` (open storage book call only), new
  `city/home-books.js` and its browser test. User requested usable placement on
  every shelf: also owns new `city/home-shelves.js`, storage surface metadata,
  interaction hooks, home decor render/capacity in `city/rooms.js` (not bar),
  `city/actions.js`, `city/goods.js` and optional storage callbacks in
  `city/goods-ui.js`, plus the home shelf prompt in `city/hud.js` and display
  placement restoration in `city/save.js`. Claude's bar/lantern ownership stays
  separate. Books and home shelves are complete and locally checked in **PR #206**;
  focused checks pass. Full CI passed Node/three browser shards; its older roof
  traversal test failed a wall-clock assumption. Codex is repairing that test
  in merged **#207**, verified normally and with90ms added per render frame.
  **Current chunk complete:** `codex/bar-backbar-quality`, new
  `city/bar-quality.js`, bar-only definition in `city/rooms.js`, manifest and
  focused browser tests. Geometry, real service input and all-shop route checks
  pass; views and rendering costs reviewed. #207 full CI is green.
  Back bar is merged in **#208**, full CI pending.
  **Native lantern chunk complete:** `codex/restaurant-lantern-quality`, new
  `city/restaurant-lanterns.js`, native hanging fixture calls in
  `city/counters.js`, `city/eateries.js`, `city/dining.js`, manifest/tests.
  Geometry/clearance, route and bundle checks pass; close/wide/night/phone
  views and rendering costs reviewed. Next: the Thai spirit house, then
  painted ceiling lantern patterns and the remaining restaurant audit. The user was asked whether public/shop shelves are also in scope;
  current chunk covers every physical shelf/board in the four home types.
  #204 palms/balcony cache and #205 wall clock are merged, full CI green.
  #197–#202 full CI are green.
  User has paused Claude. Codex takes over the back bar, lanterns and Thai
  spirit house queue below, then resumes the remaining quality audit.
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
  **Next queue (Codex taking over while Claude is unavailable):** start pass 8
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
  Pass 3 closed with the audit in #203; keep later passes open until their audits finish.
- Record each finished chunk, branch/PR and next owned files here, so the other
  agent can read it after fetching. This file is asynchronous coordination;
  separate Claude and Codex sessions cannot directly message one another.
