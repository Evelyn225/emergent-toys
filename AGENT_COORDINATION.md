# Current quality work: Codex and Claude

Updated 2026-10-25 (Codex/Claude integration). Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## Active split (Claude available again)

- **Codex:** pass4 home electronics/decoration, then pass5 home layouts.
  Active branch `codex/home-television-quality`: `city/home-quality.js`
  (television only), new `city/home-television.js`, `city/hotel-polish.js`
  (cached TV construction only), TV browser coverage and shared bundle/notes.
  Keep `city/home-*.js` with Codex. Next is the remaining home electronics audit.
- **Claude:** continue pass8 restaurant/café/bar audit and the following
  restaurant-specific chunks, including remaining fish tanks and fixtures.
  Start from main including #213. #208–#213 already cover both bar variants,
  paper lanterns/ceiling layouts, Thai shrine and izakaya sake shelves;
  do not repeat them. Own `city/dining.js`, `city/counters.js`,
  `city/eateries.js` and restaurant-only modules/tests. Agree before changing
  shared home/hotel helpers or overlapping areas in `city/rooms.js`.
- **Claude pass 7 (shop interiors):** shelf islands on
  `claude/shop-shelf-islands` (new `city/shop-gondolas.js`; one line in
  `makeRoom` in `city/rooms.js` turns 'S' cells into floor plus gondolas; the
  shop painters' dead 'S' branches in `city/shops.js`, `city/storefronts.js`
  and `roomWall` are removed, #223). Back-wall shelves on
  `claude/shop-wall-shelves`, stacked on #223: `def.shelves` is now a spec
  (`{kind, x0, x1, timber}` or a function of the room) and `makeRoom` adds a
  built wall unit from `city/shop-gondolas.js`; the painter in `roomWall` is
  gone (#224). Books bookcases on `claude/books-bookcases`, stacked on #224:
  the wall unit takes `wall: 'left'|'right'`, taller levels, and a list of
  runs; `booksWall` is gone. Earlier pass 7 PRs: #221 display cases, #222
  fridge walls. Next: the shops' painted boxes group by group.
  `city/home-*.js` stays with Codex.
- **Claude pass 7 (shop interiors):** shop fridge walls on
  `claude/shop-fridges` (new `city/shop-fridges.js`; runs and wall painters in
  `city/shops.js`; label/stock options and plain-box long parts in my
  `city/kitchen-crates-coolers.js`). Next: the shelf islands, then the shops'
  painted boxes group by group. `city/home-*.js` stays with Codex.
- Shared manifest, generated bundle and append-only completed notes remain
  shared: preserve both module lists and rebuild on integration.

## Previous completed work and handoffs

- **Codex (previous solo queue while Claude was unavailable):** Completed and merged:
  **#206** home books/shelf placement; **#207** roof-browser state waits,
  repairing #206's only CI failure; **#208** built bar cabinet/bottles/glasses;
  **#209** eight fitted hanging restaurant lanterns. #207–#209 and #211 full CI are green.
  **Thai shrine merged in #211:** `codex/thai-spirit-house-quality`, new
  `city/thai-spirit-house.js`, spiritHouse dispatch in `city/dining.js`,
  manifest and geometry tests. Roof/support/garland probes and all-shop routes
  pass; front/side/roof/garland/wide/night/phone views reviewed. Final local
  rendering measurements are recorded in WORLD_QUALITY.md.
  **Overlap integration, #210:** Claude's `claude/bar-back-bar` now includes
  current main through #211. CYAN-lit bars use its mirrored cabinet; other
  bars retain #208's open shelves. All #209/#211 modules and notes are kept.
  Codex corrected pull bounds, hollow upturned glasses and cached profiles;
  both variants, staff service and all-shop routes pass, and four default
  views match main exactly. The optimized lathe reject matches reference
  rays. Visual/performance review is recorded in WORLD_QUALITY.md. Do not restart this completed chunk.
  **Ceiling lantern patterns complete** (`codex/ceiling-lantern-layout`):
  removed flat ceiling marks in all eight lantern rooms; retain eight
  authored fixtures and fit32 smaller physical lanterns in the other five
  rooms. Geometry/native placement checks and all-shop routes pass; visuals
  and measured costs recorded in WORLD_QUALITY.md. Files:
  `city/restaurant-lanterns.js`, makeRoom/ceiling dispatch in `city/rooms.js`,
  and the existing lantern browser test. #210 is merged and its full CI is green; ceiling fixtures merged #212, CI running.
  **Izakaya sake shelves complete** (`codex/izakaya-sake-shelves`):
  `city/izakaya-sake.js`, izakaya wall/props in `city/dining.js`, manifest
  and `city-izakaya-sake` browser test. Two boards, mounted brackets/guards
  and42 real bottles; geometry and real E service checks, all-shop routes
  and bundle checks pass. Close/end/underside/night/phone views reviewed;
  cost measurements in WORLD_QUALITY.md. **Next:** the remaining restaurant
  audit, then the remaining
  home electronics/decor audit and pass 5. Keep pass 8 open until audited.
  #206 covers every physical home shelf board; the question about extending
  placement to shop/public shelves remains unanswered.
  #197–#202 and #204–#205 full CI are green. Keep the home files with Codex
  if Claude resumes; agree on a fresh ownership split before overlapping.
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
  **Previous queue (now completed through #213):** pass 8
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

## Resumed Codex work (2026-10-25)

Codex resumes `codex/home-television-fit` from main #214 and its saved TV
work. Files: `city/home-quality.js` (move television builder only), new
`city/home-television.js`, `city/hotel-polish.js` (construct each TV once),
`test/browser/city-home-television.browser.test.cjs` and the existing
coast/home TV material check, plus shared manifest/bundle/notes. No changes
to Claude's shared home clock, worktop, ellipsoid or KITCHEN_* helpers.
Claude's #215–#223 and shop-wall-shelves/books work remain with Claude;
Codex will not edit shop/restaurant files or their portions of rooms.js.
Current verification: complete the native cabinet-support checks, mutation
check, close/wide/oblique/night review and ABAB render measurements. Next:
remaining pass4 home electronics/decor audit, then pass5 homes and pass6
hotels; civic interiors (pass9) remain available to Codex. Preserve all
Claude module lists and append-only notes when integrating either branch.

Television chunk verified on `codex/home-television-fit`: three focused
browser checks plus five existing TV/layout/hotel regressions pass; raised
pad and broken-jamb mutations are rejected. Close/wide/oblique/rear/low/night/
phone views and all seven native room variants reviewed. ABAB costs are in
WORLD_QUALITY.md. Static geometry caches and hotel construction are fixed;
no shared home clock/worktop/ellipsoid/KITCHEN helper changed. Next remains
the rest of the home electronics/decor audit. Claude's shop/restaurant work
is untouched and its pending PRs remain independent.
