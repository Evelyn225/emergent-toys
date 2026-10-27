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
- **Claude pass 11 (street objects):** vending machines on `claude/street-vending`
  from main (new `city/street-vending.js`; `drawVending` moved out of
  `city/city-sprites.js`). Next: kerb fixtures (bins, hydrants, mailboxes,
  bollards) in new modules, with placement in `city/props.js`/`city/streetscape.js`.

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
  fridge walls. Grocer floor on `claude/grocer-produce` (new
  `city/grocer-produce.js`; the grocer def in `city/shops.js`), stacked on
  #221, #222 and #226 because they all edit `city/shops.js` (#228). Gas
  station and bodega on `claude/shop-boxes-2` (new `city/corner-shops.js`;
  the gas def in `city/shops.js`, the bodega def in `city/storefronts.js`),
  stacked on #228 (#229). Record shop, tattoo parlour, hardware and pharmacy
  on `claude/shop-boxes-3` (new `city/record-shop.js`, `city/shop-fittings.js`;
  their defs and painters in `city/shops.js`), stacked on #229 (#230). Toys,
  sports, video, liquor, phones, pawn, the thrift room's three trades and the
  herbalist on `claude/shop-boxes-4`, stacked on #230 (#231). The market
  hall, fruit shop, motel office, welder's, tyre shop, gacha arcade, both
  delis, tailor, antiques, store roller, showroom and estate agent's desks and
  the shared `armchair` on `claude/shop-boxes-5` (new `city/market-hall.js`;
  defs in `city/storefronts.js`, `city/shops.js` and the showroom, realty and
  books defs in `city/rooms.js`), stacked on #231. With that stack merged no
  shop def paints a box; pass 7 can be ticked. Claude's next: pass 10
  (leisure interiors). `city/home-*.js` stays with Codex. `city/home-*.js` stays with Codex.
  herbalist on `claude/shop-boxes-4`, stacked on #230. Next: the market hall,
  motel office, welder's, tyre shop, delis, fruit shop and gacha machines. `city/home-*.js` stays with Codex.

  their defs and painters in `city/shops.js`), stacked on #229. Next: the
  other shops' painted boxes group by group (markethall, motel, welding, toys,
  phones, thrift, herbs, deli, tireshop, tailor, liquor and the rest). `city/home-*.js` stays with Codex.

  stacked on #228. Next: the other shops' painted boxes group by group. `city/home-*.js` stays with Codex.

  #221, #222 and #226 because they all edit `city/shops.js`. Next: the other
  shops' painted boxes group by group. `city/home-*.js` stays with Codex.

  fridge walls. Next: the shops' painted boxes group by group.
  `city/home-*.js` stays with Codex.

  gone. Earlier pass 7 PRs: #221 display cases, #222 fridge walls. Next: the
  books walls, then the shops' painted boxes group by group. `city/home-*.js`
  stays with Codex.

  and `roomWall` are removed). Earlier pass 7 PRs: #221 display cases, #222
  fridge walls. Next: the `shelves: true` back-wall painter, then the shops'
  painted boxes group by group. `city/home-*.js` stays with Codex.

- **Claude pass 7 (shop interiors):** shop fridge walls on
  `claude/shop-fridges` (new `city/shop-fridges.js`; runs and wall painters in
  `city/shops.js`; label/stock options and plain-box long parts in my
  `city/kitchen-crates-coolers.js`). Next: the shelf islands, then the shops'
  painted boxes group by group. `city/home-*.js` stays with Codex.

- **Claude pass 7 (shop interiors) started:** display cases on
  `claude/shop-display-cases` (new `city/shop-display-cases.js` replacing
  `glassCase`/`caseGoods` in `city/shops.js`; callers in `city/shops.js`,
  `city/storefronts.js` and the airport café in `city/terminal.js`; the delis
  use `KITCHEN_FOOD_CASE`). Pass 8 PRs #215–#220 are open. Next in pass 7:
  the `fridgeWall` painter, the shelf islands, then the shops' painted boxes
  group by group. `city/home-*.js` stays with Codex.

- **Claude pass 8 progress:** seafood tank #215, sushi island #216, karaoke
  #217, pho fans/kissaten clock/roastery plants #218, cone rack/burger pass
  #219; round lanterns, Tiffany lamps, heat lamps and wire chairs on
  `claude/restaurant-lamps` (new `city/restaurant-lamps.js`, test
  `city-restaurant-lamps`; `roundLantern`/`tiffany` in `city/dining.js`,
  pizzeria lamps and `wireChair` in `city/eateries.js`, `heatLamp` in
  `city/counters.js`). Next: the pass 8 closing sweep, then pass 7 shop
  interiors, avoiding `city/home-*.js`.

- **Claude pass 8 progress:** dim sum seafood tank #215, sushi island #216,
  karaoke stage #217, pho fans/kissaten clock/roastery plants #218; ice-cream
  cone rack and burger pass on `claude/icecream-burger-fixtures` (new
  `city/eatery-wall-fixtures.js`, test `city-eatery-wall-fixtures`, props and
  wall painters in `city/eateries.js`). Next: the pass 8 closing sweep, then
  pass 7 shop interiors, avoiding `city/home-*.js`.

- **Claude pass 8 progress:** dim sum live seafood tank, PR #215; sushi
  island counter, PR #216; karaoke stage, speakers and screen, PR #217; pho
  fans, kissaten clock and roastery plants on `claude/restaurant-wall-fixtures`
  (new `city/dining-wall-fixtures.js`, test `city-dining-wall-fixtures`, props
  and wall painters in `city/dining.js`; calls `HOME_WALL_CLOCK` unchanged).
  Remaining audit queue: ice-cream cone rack and burger pass
  (`city/eateries.js`), then the pass 8 closing sweep. After pass 8 Claude
  moves to pass 7 shop interiors, avoiding `city/home-*.js`.

  island counter, PR #216; karaoke stage, speakers and screen on
  `claude/karaoke-stage` (new `city/karaoke-stage.js`, test
  `city-karaoke-stage`; in `city/rooms.js` only the karaoke props and wall
  painter, plus removing the karaoke-only `SPEAKER` helper). Remaining audit
  queue, one PR each: painted wall fixtures (pho fan, kissaten clock,
  ice-cream cone rack, burger pass, roastery trailing plants), then the pass 8
  closing sweep. After pass 8 Claude moves to pass 7 shop interiors, avoiding
  `city/home-*.js`.
- **Claude pass 8 progress:** dim sum live seafood tank, PR #215
  (`claude/dimsum-seafood-tank`, new `city/seafood-tank.js`); sushi island
  counter on `claude/sushi-island` (new `city/sushi-island.js`, test
  `city-sushi-island`, sushibar props in `city/eateries.js`). Remaining audit
  queue, one PR each: karaoke stage, speakers and lyrics screen
  (`city/rooms.js` karaoke definition only), painted wall fixtures (pho fan,
  kissaten clock, ice-cream cone rack, burger pass, roastery trailing plants),
  then the pass 8 closing sweep. After pass 8 Claude moves to pass 7 shop
  interiors, avoiding `city/home-*.js`.

- **Claude pass 8 progress:** dim sum live seafood tank on
  `claude/dimsum-seafood-tank` (new `city/seafood-tank.js`, test
  `city-seafood-tank`, dimsum props in `city/dining.js`). Remaining audit
  queue, one PR each: sushi island counter (still `BX` boxes), karaoke stage,
  speakers and lyrics screen (`city/rooms.js` karaoke definition only), then
  painted wall fixtures (pho fan, kissaten clock, ice-cream cone rack, burger
  pass, roastery trailing plants), then the pass 8 closing sweep. After pass 8
  Claude moves to pass 7 shop interiors, avoiding `city/home-*.js`.

- **Claude pass 10 (leisure interiors):** cinema rows, arcade cabinets and the
  casino floor on `claude/leisure-cinema-casino`, from main (new
  `city/leisure-fittings.js`; the cinema and arcade defs and `cabinet` in
  `city/rooms.js`, `city/casino.js`). Independent of the pass 7 shop stack
  (#233). The club, aquarium touch pool and plush stand, and the cathedral on
  `claude/leisure-club-aquarium` (new `city/cathedral-fittings.js`;
  `city/stripclub.js`, `city/aquarium.js`, `city/cathedral.js`), stacked on
  #233. The conservatory and aviary planting is sprites and goes with pass 18
  (parks and vegetation). Next: pass 11 (street objects).
- **Claude pass 12 (street lights and utilities):** the turned street lamp on
  `claude/street-lamps` from main (new `city/street-lamps.js`; `drawLamp3D`
  removed from `city/city-sprites.js`). Next: signal heads and pedestrian
  signals, then wall pipes and meters, then pavement service hatches.

- **Claude pass 12, facade utilities:** `claude/facade-utilities` from main (new
  `city/facade-utilities.js` after `world-bootstrap.js`, reading `ARCH_BUILDINGS`
  faces and street geometry; one draw hook in `city/city-sprites.js`). Next:
  pavement service hatches and overhead cables.
- **Claude pass 11, drains and grates:** `claude/street-drains` from main (new
  `city/street-drains.js`; one hook in the road branch of `city/city-render.js`).
  Next: utility cabinets, then bus shelters.


- **Claude pass 11, kerb fixtures:** `claude/kerb-fixtures` from main (new
  `city/kerb-fixtures.js` after `world-bootstrap.js`, new
  `city/kerb-fixtures-render.js`; one-line hooks in `city/city-sprites.js`,
  `city/main.js` `free` and `city/goods.js` `ballBlocked`). Next: drains and
  grates, utility cabinets, then bus shelters.
- **Claude pass 11, utility cabinets:** `claude/utility-cabinets`, stacked on
  `claude/kerb-fixtures` (#238): a `cabinet` kind in `city/kerb-fixtures.js` and
  its model in `city/kerb-fixtures-render.js`. Next: bus shelters.
- **Claude pass 11, shelters:** `claude/street-shelters`, stacked on #240: a
  `shelter` kind in `city/kerb-fixtures.js` (wall-only collision, roof query, its
  bench in `benches`), its model in `city/kerb-fixtures-render.js`, and one
  `roofed` clause in `rainFx` (`city/city-render.js`). That completes the pass 11
  list (benches were done in pass 1). Next: pass 12 (street lights and utilities).
- **Claude pass 12, overhead lines:** `claude/overhead-cables`, stacked on #241:
  `pole` and `guy` kinds plus spans in `city/kerb-fixtures.js`, their models and
  the wires in `city/kerb-fixtures-render.js` (`drawPoleSpans`, called from
  `drawKerbFixtures`). That completes the pass 12 list with #242–#245. Next:
  pass 13 (signs and shopfronts).
- **Claude pass 11, drains and grates:** `claude/street-drains` from main (new
  `city/street-drains.js`; one hook in the road branch of `city/city-render.js`).
  Next: utility cabinets, then bus shelters.
- **Claude pass 12 (street lights and utilities):** the turned street lamp on
  `claude/street-lamps` from main (new `city/street-lamps.js`; `drawLamp3D`
  removed from `city/city-sprites.js`). Next: signal heads and pedestrian
  signals, then wall pipes and meters, then pavement service hatches.
- **Claude pass 12, signals:** `claude/street-signals` from main (new
  `city/street-signals.js`; `drawSignal` and its constants removed from
  `city/city-sprites.js`). Next: wall pipes and meters, then service hatches.
- **Claude pass 12 follow-up, posts through awnings:** `claude/lamp-awning-seams` from
  main: after the layout is assembled, `world-bootstrap.js` cuts merchant awnings back
  clear of lamp posts and the (rebuilt) junction signals.
- **Claude, washroom doors:** `claude/washroom-doors` from main: public washroom pocket
  doors start shut and close behind you (`city/bathroom-quality.js`, `pub` doors), now
  including hotel and motel rooms and the hotel lobby as the user asked (Codex: this is
  done here, no need to duplicate it in pass 6). Homes keep theirs as left. The diner's
  washroom door now faces the tables (`city/rooms.js`).
- **Claude pass 12, service hatches:** `claude/service-hatches`, stacked on
  `claude/street-drains` (`city/street-drains.js` only). Next: overhead cables
  from main.
- **Claude pass 13, fascia boards and awnings:** `claude/shop-fascias` from main:
  `fascia` and `awning` details in `city/architecture.js` (`architectureSignSpec`,
  `architectureShopfront`), their shading in `city/architecture-render.js`, and the
  shared sign spec in the three painted-sign calls (`architecture-render.js`,
  `residential-render.js`). Not touching `city/home-*.js`: the IDEA rename there is
  handled by refitting the board at draw time. Next: the old-path facades (warehouses,
  sty 2/15 shops) and Chinatown's painted vertical signs.
- **Claude pass 13, generic shopfronts:** `claude/oldpath-shopfronts`, stacked on
  #248: new pure `city/shopfronts.js` (after `pavilions.js` in the manifest), the
  generic sign band and awning in `city/city-render.js`, and `SHOPFRONT_FACES` in
  `world-bootstrap.js`'s face remap. Next: Chinatown's painted vertical signs and the
  remaining shopfront details (shutters, windows, displays).
- **Claude pass 13, shop window displays:** `claude/shop-windows`, stacked on #249:
  new `city/shop-windows.js` (after `city-render.js` in the manifest) and one call in
  each family's shop window (`architecture-render.js` brownstone and downtown,
  `residential-render.js` housing, `city-render.js` generic). Next: the pass 13
  closing audit (shutters, doors, district-specific typography).
- **Claude pass 13, roller shutters:** `claude/shop-shutters`, stacked on #252: new
  `city/shop-shutters.js` (after `shop-windows.js` in the manifest); `architectureShutter` and
  `shopDoor` in `architecture-render.js` now take the opening (and `d`), and their callers in
  `architecture-render.js`, `residential-render.js`, `pavilion-render.js` and `city-render.js`
  (Belle doorways, generic fronts, warehouse doors) pass it. Next: doors, typography and mounts.
- **Claude pass 13, generic shop doors:** `claude/generic-doors`, stacked on #253:
  `city/city-render.js` generic ground floor only (a `shopDoor` under each board, the painted awning
  band now a transom), new `city-generic-doors` browser test.
- **Claude pass 11, kerb fixtures:** `claude/kerb-fixtures` from main (new
  `city/kerb-fixtures.js` after `world-bootstrap.js`, new
  `city/kerb-fixtures-render.js`; one-line hooks in `city/city-sprites.js`,
  `city/main.js` `free` and `city/goods.js` `ballBlocked`). Next: drains and
  grates, utility cabinets, then bus shelters.
- **Claude pass 11, utility cabinets:** `claude/utility-cabinets`, stacked on
  `claude/kerb-fixtures` (#238): a `cabinet` kind in `city/kerb-fixtures.js` and
  its model in `city/kerb-fixtures-render.js`. Next: bus shelters.
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

Codex home TV chunk merged as #225. Next active chunk:
`codex/home-keepsake-models`, new `city/home-keepsakes.js`, only the home
shelf draw loop in `city/rooms.js`, new focused browser coverage and shared
manifest/bundle/notes. Scope: real supported rubber ducks and snow globes on
home shelves, retaining existing placement/save/take controls and footprints.
No shared home helper or Claude-owned shop/restaurant code changes. Other
inventory artwork stays with the common inventory rendering pass.

`codex/home-keepsake-models` verified: two new keepsake browser checks plus
both existing shelf placement/save/drop/take checks pass; the floating-base
mutation is rejected. Duck/globe close/wide/oblique/reverse/above/night/phone
views reviewed, with final ABAB costs in WORLD_QUALITY.md. Model/profile
cache reuse and clear central glass are tested. TV #225 full CI is green.
Remaining pass4 decoration audit stays with Codex, then passes5/6; other
displayed item families share the inventory pass27 renderer. No Claude-owned
source changed; rooms.js edit is only the home display loop in roomSprites.

Codex active `codex/home-plush-shark-quality` (pass4 decoration audit):
new `city/home-plush-shark.js`, only the plush builder/dispatch in
`city/home-furniture-render.js`, new browser test and shared manifest/bundle/
append-only notes. Fixing fins outside the saved placement envelope and the
unsupported belly; preserving the existing footprint and bed-placement data.
Shared homeRayEllipsoid/worktop/clock/KITCHEN helpers remain untouched.
Claude continues cathedral/pass10 plus shop/restaurant work. Next is the
remaining pass4 audit, then apartment/loft/Belle layouts in pass5.

Plush chunk also fixes bed support selection in `city/home-furnishing-ui.js`:
the old candidate path skipped all drawn bed models, while their conservative
boxes include pillows. Probe cached rendered bed pieces for a clear flat
support plane; retain overlap rejection against pillows and other furniture.
No bed builder or shared geometry helper changes.

`codex/home-plush-shark-quality` complete: placed shark fits the saved
envelope, has a flat supported underside and joined details, and real bed
placement works without accepting pillows/folds/edges. Three focused plus
three existing furnishing browser checks pass; fin and bed-branch mutations
are rejected. Day/night/phone and bed views reviewed, ABAB costs recorded
in WORLD_QUALITY.md. The old homePlushShark helper remains unchanged for
other callers; no shared ellipsoid/clock/worktop/KITCHEN helper edits.
#227 keepsake full CI is green. Next: close the pass4 decoration audit,
then pass5 home layouts and pass6 hotels; cathedral remains Claude's work.

Pass4 decoration closing audit complete on the plush branch:14 existing
component checks plus the three new plush/bed and three furnishing controls
checks pass (20 total). Native four-home views and furnished Fern day/night/
reverse views reviewed with no page errors. Completion/handoffs appended to
WORLD_QUALITY.md. Next Codex queue: pass5 home openings/trim/layouts, then
pass6 hotels. Own homeWall/homePlan/homeDef portions of rooms.js and new
home-only modules/tests; Claude's store/florist/books/bar/karaoke definitions,
shop makeRoom additions and shelf wall code remain with Claude. Shared
clock/ellipsoid/worktop/KITCHEN helpers continue to require coordination.

Codex integration review (2026-10-25): reran only the failed CI jobs for
#223 (indoor conversation assertion) and #232 (transit-speech timeout).
Reviewed #233 on `codex/review-leisure-integration`, merging current main
and preserving both agents' appended notes/module lists before rebuilding.
Fixed a real 4cm air gap under casino table tops and added the missing slot
lever pivot. A rendered-ray regression fails on both original defects and
passes after repair; existing cabinet/row bounds and arcade/cinema/casino/
break-in controls pass. Next review is #234, then Codex returns to pass5
home openings/layouts and pass6 hotels. Claude can continue pass11 street
objects; this review changes no street files or shared geometry helpers.

Codex #234 integration review on `codex/review-cathedral-integration`
(separate checkout `/workspace/leisure-234-review`): preserved #233's review
fixes, main's home modules and both agents' notes, rebuilding the bundle.
Repaired actual sanctuary support for the altar/candlesticks/priest, moved
font water above its stone floor, supported the votive tiers and pew
kneelers, and normalized/seated the pulpit book rest. New actual-surface
regression fails on the old defects and passes after repair. All six
leisure geometry checks, seven club/aquarium/cathedral gameplay/route checks
and seven bundle/parse/render checks pass; day/night/close/oblique/wide
views reviewed. #223's requested CI rerun is fully green. #232's original
head rerun is also fully green; Claude's subsequent main integration has
its own new CI run. #233 is merged. Next Codex work remains pass5 home
openings/trim/layouts, then hotels; Claude can proceed with pass11 streets.
No street modules or shared home/kitchen geometry helpers were edited.

Codex active `codex/home-window-casings` (pass5): new home-only
`city/home-windows.js` and focused browser test, plus homeDef/homeWall
sections of rooms.js. Replaces the three native apartment families' painted
window frames with fitted casings/sills/mullions; keeps their current real
exterior-view windows and leaves Fern/Cabin Cove, shops and shared helpers
alone. Claude retains pass11 street objects. Bundle/manifest and appended
notes are the only other shared files.

`codex/home-window-casings` complete: the three native apartment families
have fitted closed frames, recessed bars and deep sills with their real
exterior views. A17cm studio window shift clears the native bookcase;
bookcase geometry and saved shelf placements are unchanged. New contact/
join/clear-pane/cache/furniture checks and both defect mutations pass,
with11 existing home/Fern/TV/native-purchase-balcony regressions and seven
bundle/parse/render checks. All three styles inspected close/wide/oblique/
low/night/phone; ABAB costs appended to WORLD_QUALITY.md. Next Codex queue:
pass5 doors/trim/layout character, then pass6 hotels; Claude owns pass11
streets and the pending shop/restaurant stack. No shared helper edits.
The full1069-test Node run on #233's final reviewed tree passed.

2026-10-25 solo takeover: the user reports Claude is out of credits and asks
Codex to keep going. Codex now reviews/integrates Claude's pending restaurant
#215–#220, shop #221–#232 and street-vending #236 work before continuing
passes5/6 and the broader checklist. Claude's ownership reservations are
paused during this authorized takeover; preserve his implementations and
notes, repair review defects, keep each original chunk/PR separate, and
rebuild generated output. Active review: `codex/review-seafood-integration`;
next is sushi island #216. On resuming, read the latest appended progress
before choosing overlapping files.

#215 solo review complete on `codex/review-seafood-integration`: fixed pull
bounds, bubble peaks and distant gravel aliasing; cached static profiles and
materials. Four tank checks plus home-window controls, all five shop/seating/
route checks and four bundle/parse checks pass. Original-defect regression
fails before correction; close/wide/oblique/above/night views reviewed and
costs appended. Next #216: belt rails currently intersect the plate rims.

#216 solo review complete (`codex/review-sushi-integration`): expanded the
belt to clear the actual plate rims, with no collision-footprint changes.
New rendered plate/slab probes catch the original990 intersections; all10
sushi/prep/tableware checks and four bundle/parse checks pass. Close/wide/
corner/end/night views and ABAB costs reviewed. Next #217 karaoke: review
speaker/screen bounds and startup-time lyrics. #233/#234/#237 full CI green.

Renewed split (user asked where Claude should resume): Claude should pull
latest main, read these appended notes, take over his #236 street-vending
PR (integration/CI/review fixes) and continue pass11 with bins, hydrants and
mailboxes, then its remaining street objects. Codex keeps the restaurant/
shop backlog #217–#232 and home/hotel passes5–6. Codex is completing #217
karaoke, then #218 wall fixtures. Keep street-only render hooks/modules
with Claude; coordinate shared helpers before edits. Preserve both agents'
manifest entries/notes, rebuild the bundle on integration, and use separate
branches/PRs per chunk. This supersedes the solo-takeover reservation for
#236/pass11; Codex will not modify them while Claude resumes.

Latest user correction: Claude has already completed his pass11 chunks and
is on pass12 (street lights/utilities). He should stay there, maintaining
his #236/#238–#241 street-object branches as needed; do not restart pass11.
Codex keeps the restaurant/shop review stack #217–#232 and home/hotel
passes5–6. During an active Codex review, please leave those PR branches
unchanged, including main-sync commits, so fixes and pushes do not race.
Codex found Claude's parallel #217 speaker/cache/lyric repairs and merged
them, retaining Claude's tighter original footprint plus the actual-shape
regression, foot-material cache, screen bounds and stage-normal fixes.
This correction supersedes the earlier pass11 restart suggestion.

#218 Codex review complete (`codex/review-wall-fixtures-integration`):
retained Claude's70c7f5a connected fan and rooted-vine geometry; corrected
leaf/stem height sampling and stem-tip alignment, cached mounting profiles
and leaf materials. Five fixture checks plus four bundle/parse checks pass;
separate grille, shaft, root and leaf mutations are rejected. Fan/clock/
plant close/wide/oblique/above/night views and ABAB costs reviewed. Next
Codex #219 cone rack/burger pass, then #220 restaurant lamps and shop stack.
Claude remains on pass12 streets/utilities; no street-only files touched.

#219 Codex review complete (`codex/review-eatery-fixtures-integration`):
retained Claude's cone seating and pass mounting fixes, expanded the pass
bounds to its hood/rail plates/braces, and cached fixed profiles. Three
fixture checks and four bundle/parse checks pass; actual-part containment
fails before correction. Close/above/wide/front/oblique/under/night views
and ABAB costs reviewed. Next #220 restaurant lamps, closing pass8 review,
then the shop stack. Claude owns pass12; no street-only files changed.

#220 Codex review (`codex/review-restaurant-lamps`): `city/restaurant-lamps.js`,
its browser test and shared generated bundle/notes. Hollow Tiffany/heat shades,
real supported bulbs/sockets and cached static lamp/cord profiles; Claude's
wire-chair support bars retained. Three lamp checks and the restaurant closing
route/seating/service/audio/hot-line/native-dining sweep pass; original and
three targeted defects rejected. Close/below/wide/oblique/night reviewed,
ABAB costs appended. Pass8 stays open for sagged paper-flag/cord contacts and
older noodle-pulling lines found in the closing audit. Next Codex #221 shop
display-case review, then remaining shop stack and home/hotel passes5–6.
Claude owns pass12 lights/utilities; no street-only or shared helper edits.
#218's final full CI is green; #219's updated run continues.

Codex active review now `codex/review-shop-display-cases` (#221):
`city/shop-display-cases.js`, its browser test and shared bundle/notes only.
Current main through #220 integrated; checking actual goods support and fixed
geometry allocation before visual/cost review. Next #222 fridge walls.
Claude keeps pass12 and should leave this shop PR branch unchanged.

#221 Codex review complete on `codex/review-shop-display-cases`: actual
ring-stone support repaired; case goods/frame/cabinet profiles and materials
prepared once, preserving thin-tube LOD, footprint and Claude's goods layouts.
New actual-ray/cache check and separate stone/cache mutations verified;
case/display/aircraft-terminal and shop route/seating checks pass. Close/wide/
oblique/night views and ABAB costs reviewed. No shared helper edits.
Next Codex #222 shop fridge walls, then #223 gondolas and remaining shops.
#219 final full CI green; Claude remains on pass12 lights/utilities.

Codex active review now `codex/review-shop-fridges` (#222): integrated #221
cases and main through its merge. The only source conflict removed both old
case and fridge painters, keeping the built replacement modules. Reviewing
`city/shop-fridges.js` and its test plus Claude's dairy-stock/shared-cooler
changes already in this PR; no new shared-helper edits planned. Next #223.
Claude keeps pass12 lights/utilities and his street branches.

#222 Codex review complete (`codex/review-shop-fridges`): Claude's fridge
geometry and dairy/prepared-stock implementation retained. Added native
actual-stock support/glass/packing/cache coverage over all seven runs;
lowered-shelf, rebuilt-profile and detached-wall mutations fail correctly.
Six fridge/shared-cooler checks, five shop routes/seating and four bundle/
parse checks pass; all rooms, close/wide/oblique/night and grocer corner
reviewed, with ABAB costs appended. No new shared-helper edits. Next Codex
#223 gondolas: review stock support and avoid repeated depth-order sorting
when only the camera position changes. Claude remains on pass12.

Codex active review `codex/review-shop-gondolas` (#223): current main
through #222 integrated, additive notes/manifest preserved and bundle rebuilt.
`city/shop-gondolas.js` and its browser test: stock/support/route review and
camera-direction depth-order caching. Shared room/shop hooks from Claude's
PR retained; no shared home/hotel/kitchen helper edits planned. Next #224
back-wall shelves; Claude retains pass12 lights/utilities.

#223 Codex review complete (`codex/review-shop-gondolas`): hardware bins have
real cavities and supported washer stacks, with shallow boxes at the shelf
front; exact camera-direction order cached through translation and refreshed
on turns. Only the gondola module/test and shared notes/bundle changed; tray
and home profile builders called unchanged. Four gondola checks,17 route/
placement/case/fridge and seven bundle/parse/render checks pass; four targeted
mutations rejected. Non-hardware grocery/books/wine images match the built
prototype exactly; close/above/wide/oblique/night and ABAB costs reviewed.
Next #224 refactors the goods builder in the SAME module: preserve the new
bin geometry and order invalidation there, retaining both agents' work.
Before #224, Codex will fix a CI café-test fixture separately: its randomly
chosen front-row seat puts the test player inside the front wall. Reproduced
free=false/no prompt versus clear-floor E: talk, rather than a game regression.
#220 full CI green; #221 failed shard retried after diagnosis. Claude stays
on pass12 lights/utilities; no street-only files touched.

Codex test-only CI repair complete on `codex/indoor-talk-fixture`:
`test/browser/ascii-city.browser.test.cjs` and shared notes. Deterministic
native café crowd/front-row patron, clear-floor/unobstructed approach and
head-height aim; retain café/station dialogue and clerk assertions. Focused
check passes twice and old wall-placement mutation fails; both aimed-focus
checks and four bundle/parse checks pass. No game/bundle/helper changes.
#222 final full CI green. Next Codex #224 wall shelves, carefully integrating
its factored goods builder with #223 bins and camera-direction cache.
Claude keeps pass12; no street-only edits.

Codex active review `codex/review-shop-wall-shelves` (#224): integrated main
through #247 and moved #223's supported bins, original wine material and exact
direction-order cache into Claude's factored `gondolaGoods` builder. Reviewing
`city/shop-gondolas.js` and the wall-shelf browser test; shared room/shop hooks
retained, no shared home/hotel/kitchen helper edits. Next #226 bookcases.

#224 Codex review complete (`codex/review-shop-wall-shelves`): retained both
agents' goods builder/bins and exact-direction cache; restored unchanged wine
material. Hollow thrift-vase necks, inner walls and supported closed floors;
profile bounds use the unchanged home part builder. All15 route/wall/island/
fridge/seating and seven bundle/parse/render checks pass; three targeted
mouth/wall/mount mutations rejected. Grocery/hardware/wine images match main;
all four rooms close/wide/oblique/night and ABAB costs reviewed. #220–#223 full
CI green, including #221 retry; #247 continues. Next Codex #226 bookcase walls,
then #228–#232 and the recorded interior-ceiling/flag/noodle closing audit,
followed by home/hotel passes5–6. Claude keeps pass12 streets/utilities.
No shared home/hotel/kitchen helper edits or street-only changes.

Codex active review `codex/review-books-bookcases` (#226): current main
through #224 integrated. `city/shop-gondolas.js`, books-room definitions in
`city/rooms.js` and wall-shelf browser coverage; #223 bins/order and #224
hollow vessels retained. Reviewing side-wall rotations, corner joins, book
support and reading-seat/till clearance. Next #228 produce, then #229–#232.
Claude retains pass12; no street-only or shared helper edits planned.

#226 Codex review complete (`codex/review-books-bookcases`): main through
#224/#247 integrated, preserving all prior shelf/bin/vessel/cache work. Authored
bookcase dimensions and placement retained; added explicit entrance-to-seat/
till reachability and real C/E controls (BOOKS is absent from the usual shop
route map). Three transform/depth/input mutations rejected. All13 wall/island/
route/seating controls and seven bundle/parse/render checks pass; left/right/
corner/underside/close/wide/oblique/night and ABAB costs reviewed. No shared
helper edits. #247 full CI green. Next Codex #228 produce, then #229–#232;
#232 already upgrades the remaining painted reading chair, so do not duplicate
it. Claude keeps pass12 lights/utilities and his street PRs.

Codex active review `codex/review-grocer-produce` (#228): main through #226
integrated, preserving reviewed fixtures and test repairs. `city/grocer-produce.js`
and its browser test; reviewing actual melon packing, stable face lighting and
fixed fruit/profile preparation. Next #229 corner shops, then #230–#232.
Claude retains pass12; no street-only or shared helper edits planned.

Updated user handoff (2026-10-25 Toronto): Codex completes #228–#232 and the
interior closing audit, then reviews/merges #236 and the open #238–#249 set.
Respect these dependency chains: #238 -> #240 -> #241 -> #246;
#239 -> #245; #248 -> #249. #247 is already merged (Codex's CI fixture fix).
Then Codex takes passes5,6,9 (homes, hotels, civic). For pass6, decide private
hotel/motel pocket-door defaults and auto-close separately from public rooms.
Claude now owns active `city/bathroom-quality.js`, the DINER definition in
`city/rooms.js`, `city/world-bootstrap.js` (Chinatown awning/lamp clearance)
and pass13 facade files. Avoid those active edits; this supersedes the older
pass12-only split. Shared notes/module lists remain additive; rebuild bundles.
Current Codex branch remains `codex/review-grocer-produce`, files above.

User decision for pass6: hotel AND motel washroom pocket doors should also
start closed and slide shut when the player walks away, matching Claude's
public-washroom behavior. Implement for guest rooms during the hotel pass;
Claude's current bathroom-quality edits remain reserved. Homes are unchanged
by this request.

#228 Codex review complete (`codex/review-grocer-produce`): actual two-axis
melon packing/contact corrected; plain timber face lighting made independent
of previous HIT normals; fruit/apple/crate geometry and materials prepared
once; handle render bounds corrected. Two new actual-geometry/cache checks
and four mutation probes pass. All12 produce/shop-route/seating plus seven
bundle/parse/render checks pass; close/oblique/wide/night views and ABAB costs
reviewed. #224/#226 final CI green. No shared helper or active Claude file
edits. Next #229 corner shops, #230–#232, then the recorded interior closing
audit and updated merge chains. Latest hotel/motel door decision above stands.

Codex active review `codex/review-corner-shops` (#229): main through #228
integrated. `city/corner-shops.js`, corner-shop/wall-shelf tests, gas/store
hooks in `city/shops.js` and `city/shop-gondolas.js` (oil/front-wall shelf
option). Reviewing physical supports, frame bounds, directions and real
service routes; preserve previous produce/bin/cache work. Next #230–#232.
Claude's active bathroom-quality, diner, world-bootstrap and facade files
remain reserved, per the latest user split above.

#229 Codex review complete (`codex/review-corner-shops`): clear acrylic
permits sight/shot rays but retains movement collision, restoring customer-side
E service. Added rack support arms/floor feet, a real top-cup cavity and cached
turned profiles; scaled console/till labels and filtered pane reflections.
Three new actual-geometry/E checks plus four defect mutations verified.
All18 corner/shelf/produce/routes/seating and seven bundle/parse/render checks
pass; close/wide/oblique/under/night and ABAB costs reviewed. No active Claude
or shared helper files edited. Next #230–#232, then closing audit; include the
legacy gas hubcap/key and security-mirror sprite with the recorded ceiling/
flag/noodle remnants. User's hotel/motel door decision remains recorded above.

- **Claude, fruit shop wallpaper:** `claude/fruit-wallpaper` off main: `fruitWall` in
  `city/storefronts.js` only (small oranges in a half-drop repeat instead of whole squares of `@`),
  new `city-fruit-wallpaper` browser test.
Codex active review `codex/review-specialist-shops` (#230): main through #229
integrated. `city/record-shop.js`, `city/shop-fittings.js`, specialist-shop test
and record/tattoo/hardware/pharmacy hooks in `city/shops.js`; shelf stock data
in `city/shop-gondolas.js`. Prior acrylic/produce/bin/cache fixes retained.
Next #231–#232, then closing audit. Claude's active bathroom-quality, DINER,
world-bootstrap and facade work remains reserved.

#230 Codex review complete (`codex/review-specialist-shops`): divider letters
read forward on both sides; sleeve artwork and the BP idle display scale
without repeated glyph stamps. The cuff now opens into a closed-back arm
recess. Hose turns use one clipped round-coil surface with correct inner and
outer normals, replacing costly per-turn profiles; fixed book/bag materials
prepare once. Three new native ray/raster/cache checks and six independent
mutations pass. Specialist and all-shop routes/seating/counter/shelf checks
plus seven bundle/parse/render checks pass; close/wide/oblique/night views and
ABAB costs reviewed. #228/#229 final full CI green. No active Claude or shared
helper edits. Next #231–#232, then closing audit. Add the hardware lawnmower,
record turntable/headphones and tattoo lollipop jar to its remaining legacy
props; replacing BX calls alone does not complete the quality pass. Hotel/
motel closed and auto-closing washroom doors remain queued for pass6.

Codex active `codex/review-more-shop-fittings` (#231): main through #230
integrated, both corner-shop test groups retained. Reviewing new returns box,
queue display, dresser, sewing machine, record crate, tea table/cushions and
counter callers in `city/shop-fittings.js`, `city/corner-shops.js` and
`city/shops.js`. Prior BP/record/hose/produce/acrylic fixes remain. Next #232,
then the recorded closing audit and authorised merge chains. No active Claude
bathroom-quality/DINER/world-bootstrap/facade edits planned.

#231 Codex review complete (`codex/review-more-shop-fittings`): LP crate floor/
rim support and fixed shell preparation corrected; pawn TVs sit on the mat
and both lower cases, facing the aisle. Returns slot now has closed recessed
inner walls, and the queue board uses steady scaled lettering. Sewing machine
has a supported needle plate/fabric, presser foot, mounted spool/thread guide
and continuous needle travel to the fabric. Three new actual-shape/raster/
motion checks and seven negative mutations pass. All21 current corner/small/
specialist/shop-route/seating checks and seven bundle/parse/render checks pass;
close/wide/oblique/night and ABAB costs reviewed. #230 full CI green. Next
#232, preserving produce rotations AND all prior cache/contact fixes, then
closing audit. Do not tick all pass7 merely because BX calls disappeared.
Claude's active files remain reserved; hotel/motel door decision unchanged.

Codex active `codex/review-market-and-last-shops` (#232): reviewed main through
#231 integrated. Produce quarter-turns use the cached fruit/shell and correctly
rotated tray rays/normals; both specialist test groups retained. Reviewing
`city/market-hall.js`, new `city/shop-fittings.js` builders and callers in
`city/shops.js`/`city/storefronts.js`, plus the legacy shared armchair and book/
showroom/realty callers in `city/rooms.js` outside Claude's DINER definition.
Avoid active bathroom-quality, DINER, world-bootstrap and pass13 facade work.
Next the recorded interior closing audit and authorized Claude merge chains;
keep pass7 open for its documented remnants. Pass6 hotel/motel washroom doors
start closed and auto-close after walking away, per the user decision.

Usage-resume checkpoint (user request): a one-time continuation is scheduled
for 2026-10-26 07:21:44 UTC (03:21 Toronto). If this session is still working,
avoid a second copy of its chunk. Current branch is
`codex/review-market-and-last-shops`; #230 and #231 are merged, #230 full CI
green. #232 source integration and geometry/cache repairs are implemented;
new `test/browser/city-market-fittings.browser.test.cjs` covers real shapes.
Seven focused checks and broad shop regressions are running. Remaining before
#232 merge: independent negative mutations, close/wide/oblique/night review,
ABAB render costs, final notes/PR description, latest remote integration and
push. Ignored review scripts/artifacts live in `work/backlog-review/232-*`.
Do not merge this checkpoint without finishing that review. Then continue the
recorded closing audit, authorised merge chains and passes5/6/9. Preserve the
hotel/motel closed and auto-closing washroom-door decision and Claude's current
file ownership. Read newer appended notes before resuming.

#232 Codex review complete (`codex/review-market-and-last-shops`): cached
produce survives quarter-turns with correct tray normals and fruit axes.
Market stock is prepared once, supported, nonintersecting and clear of posts;
framed cloth awnings join their posts. Slicer clears its wall/counter and
wheels have shafts; steel clears uprights and the gate reaches the floor.
Curtain tabs join its wall-mounted rail; chair back joins its base. Machine
openings have real depth, mounted coin/cup fittings, clear brochure pockets
and scaled surface symbols. Suitcase straps/supports/handles and roller caps
are bounded correctly. Native 24/7 appliances now fit clear of the register,
a visual-review defect missed by centre-only tests. All29 relevant browser
checks pass across final focused/integration runs, plus seven bundle/parse/
render checks;13 independent negative probes,24 close/wide/oblique/night
views and ABAB costs reviewed. #230/#231 updated full CI green. No active
Claude or shared home/hotel helper files edited. Final source ready for latest
remote integration/push and #232 merge; this supersedes the earlier checkpoint.
Next the recorded interior closing audit, then authorized Claude merge chains
and passes5/6/9. Keep pass7/8 open for remaining ceiling fittings, cords/noodle
strands and legacy small props/stock electronics; add the old 24/7 slushie
machine's rendering to that inventory. The scheduled continuation and user's
hotel/motel door decision above stand; read newer notes before resuming.

#232 merged as3759fec. Codex active `codex/interior-ceiling-quality`: first
closing-audit chunk replaces strip/tin ceiling glyphs in shops/restaurants
with fitted battens. New `city/interior-ceiling.js`, generic `ceilMask` paint
callback and `roomCeil`/`roomSprites` hooks in `city/rooms.js` outside the
reserved DINER definition, plus a focused browser test and shared manifest/
bundle/notes. Home/hotel/civic/transport ceilings and existing feature lamps
stay outside this first chunk. Pendants/spots and the recorded small-prop/
cord/noodle remnants follow. No shared home/hotel helper edits planned.

Ceiling chunk scope correction: tin is a custom pressed-tin renderer with
round hanging lamps, not the fluorescent layout. This first chunk covers
only `ceil:'strip'` in the shop/restaurant whitelist. Tin stays with the next
pendant/spotlight chunk, preserving its existing finish and layout. Existing
lantern/home/hotel/civic/rail controls pass; no DINER definition edits.

Codex fluorescent closing-audit chunk complete on `codex/interior-ceiling-quality`:
new `city/interior-ceiling.js`, three generic room rendering/layout hooks outside
the reserved DINER definition, focused ceiling test, shared manifest/bundle/notes.
Mounted closed housing/diffuser/clips, cached partition-aware layouts and surfaces;
12 browser checks across final focused/integration runs, seven node checks and
six negative probes pass. Twelve clear-floor views and ABAB costs recorded in
WORLD_QUALITY; control images match main exactly. First chunk is strip only,
including gas; tin/pendant/spots follow. #232 final CI has one stale minimum60
staff-view assertion with all57 native views fully visible. Fix separately next,
then continue the recorded closing audit and authorized Claude PR chains. All
active ownership and hotel/motel closed/auto-closing door decisions stand.

#257 fluorescent ceiling fixtures merged as05e97ae. Codex active test-only
`codex/staff-visibility-coverage`: `city-placement.browser.test.cjs` replaces
the stale minimum60 head views with explicit named-room/native-keeper and
three-angle coverage, retaining the actual raster visibility threshold. No
runtime edits. After verification/negative probes, resume pendant/tin/track
closing audit and the authorized review queue; active Claude files reserved.

Staff coverage repair verified: original main reproduces the stale60-view
failure; explicit15-room/native-keeper/three-angle check passes twice, with
missing-clerk/missing-angle/hidden-head mutations rejected. Four bundle/parser
checks pass. No runtime changes or visibility threshold relaxation. Ready to
publish/merge separately; next pendant/tin/track fixtures, shared helpers used
unchanged, all reserved ownership and hotel/motel door decisions preserved.

#258 staff coverage repair merged asdca3b8e. Codex active
`codex/interior-pendant-track-quality`: new `city/interior-ceiling-lamps.js`,
generic pendant/render hooks in `city/rooms.js` outside DINER, tin/spot ceiling
painter hooks only in `city/shops.js`, focused ceiling tests and shared manifest/
bundle/notes. Reuse homeLampModel/homeLampPart/homeRayWorktop unchanged; no
shared helper edits. Preserve authored Tiffany/heat/lantern lamps, room routes
and homes/hotel/civic scope. Next recorded cords/noodles and legacy small props,
then authorized Claude chains. Active Claude files remain reserved.

Codex pendant/tin/track chunk reviewed on
`codex/interior-pendant-track-quality`: mounted hollow enamel pendants reuse
homeLampModel unchanged, with tall-stock/feature-lamp clearance. Tracks have
closed rails, stems, recessed metal heads and luminous fitted lenses. Four new
native actual-ray/cache/scope checks plus existing route/seating/home/feature/
fluorescent checks pass (18 across final runs), seven node checks and eight
independent defect probes pass. Fifteen clear-floor views and ABAB costs are
recorded in WORLD_QUALITY; home/strip control images unchanged. No active
Claude file or shared helper edits. Ready to publish/merge, then the detached
paper-flag/noodle joins, legacy small props and stock electronics closing audit;
continue authorized Claude PR chains and passes5/6/9 afterward. Hotel/motel
doors remain queued closed and auto-closing; homes unchanged by that decision.

#259 pendant/tin/track fittings merged aseb02dac. Codex active
`codex/interior-cord-noodle-quality`: new `city/interior-cords.js`, papelPicado
wrapper in `city/eateries.js`, noodlehouse worker/strand caller in
`city/dining.js`, focused tests and shared manifest/bundle/notes. Shared curve
joins for hanging paper flags; dough endpoints derive from the posed cook's
actual hand shapes. No figures.js, shared home/hotel/kitchen helper or active
Claude DINER/bathroom/world-bootstrap/facade edits. Next legacy small props/
stock electronics, then authorized Claude chains and passes5/6/9.

Cord/noodle review update: flag tops and cord share exact sampled joins, with
real thin paper/cut-out inner edges and wall mounts. Close visual review caught
that separate world-space noodles do not match the cached human sprite's
perspective. Held dough now belongs to eight prepared human figure bodies,
primed under a private actor cache key; hands and dough share the exact raster,
and only this worker refines the whole body up close. No figures.js/shared
helper edits. All11 cord/route/seating/lantern checks and seven node checks
pass; nine independent negative probes pass. A final strand radius/readability
adjustment passes the three focused checks; final13-view/static+moving ABAB
measurements and final probe rerun are being completed before publication.
#258 and #259 full CI: node and three browser shards pass, including repaired
staff coverage; only karaoke test fails. Its13.9s sample is fully sung by the
actual lyric clock (1.3x progress), so it must not expect unsung letters there.
Fix that separately next, preserving start/mid/end colour coverage and seating.

Cord/noodle chunk final review complete on
`codex/interior-cord-noodle-quality` (source2432655): three focused and all
shop routes/seating/lantern regressions pass (11 across final runs), seven node
checks and nine independent mutations pass. Thirteen clear-floor views and
static/moving ABAB costs are recorded in WORLD_QUALITY; control image identical.
No pending geometry adjustment or helper edit. Publish/merge, then repair the
separate karaoke start/mid/end sampling assertion. This supersedes the earlier
WIP checkpoint. Continue legacy prop/electronics audit and authorized Claude
chains, preserving active ownership and the hotel/motel closed/auto-close
washroom-door decision. Latest branch and tests are pushed for usage handoff.

#260 cord/noodle contact repair merged as04e7dda. Codex active test-only
`codex/karaoke-progress-test`: `city-karaoke-stage.browser.test.cjs` samples
start/mid/end at10/12.5/13.9 seconds and reads only the actual screen plane.
The old13.9s expectation incorrectly required unsung letters after progress
already exceeded the full line. Retain both colour directions, nonempty actual
lyric pixels, clear-floor camera and seating. No runtime edits. Next resume
the documented closing-audit follow-ups and authorized Claude review queue.

Karaoke test-only repair verified: all four stage checks plus repeated actual
screen start/mid/end sampling pass; four progress/text mutations and four node
checks pass. No runtime edits. Publish/merge, then Codex takes review #236 and
the recorded #238–#249 dependency chains. Ceiling marks and detached flag/
noodle joins are closed by #257/#259/#260. Small legacy optics/turntables/
headphones/mower/key/hubcap/lollipop/floor-lamp/clock/fan follow-ups remain
explicit in WORLD_QUALITY, with passes7/8 open; do not erase these while
integrating Claude's notes. Preserve active bathroom-quality, DINER,
world-bootstrap and current facade ownership; rebuild bundles. Hotel/motel
washroom doors remain queued closed and auto-closing in pass6; homes unchanged.

#261 karaoke sampling repair merged as662d24d. Codex active review
`codex/review-street-vending` (#236), integrating main into Claude's original
`claude/street-vending` ancestry. Files: new `city/street-vending.js`, the old
vending renderer removal from `city/city-sprites.js`, focused vending tests and
shared manifest/bundle/notes. Review fixes target cached fixed profiles/materials,
nonoverlapping stock, proper scaled READY text and actual coin-return depth.
No active Claude bathroom/DINER/world-bootstrap/facade or shared helper edits.
Next the authorized #238→#240→#241→#246, #239→#245 and #248→#249 chains, plus
independent #242/#243/#244. Preserve remaining interior legacy-prop follow-ups.

#236 Codex review complete on `codex/review-street-vending`: integrated main
through #261, retained Claude's cabinet/layout and added lazy prepared surfaces,
stock clearance, scaled READY, calm surface LOD/glints, a true closed coin
recess and a mounted flap hinge. Four focused plus five native purchase/club
checks, seven node checks and nine negative probes pass. Thirteen clear-floor
views and ABAB costs recorded in WORLD_QUALITY. #261 full CI green. No active
Claude/shared helper edits. Ready to push the reviewed original PR branch and
merge #236, then #238→#240→#241→#246, #239→#245, independent #242/#243/#244,
and #248→#249. Newest #249 remote head isd6960f6, not the older1fc/6f refs;
fetch every head explicitly before review. Preserve remaining interior small-
prop follow-ups and the hotel/motel closed/auto-closing washroom-door decision.

#236 reviewed vending PR merged as885a1ac. Codex active
`codex/review-kerb-fixtures` (#238), integrating main through #236. Files:
`city/kerb-fixtures.js`, `city/kerb-fixtures-render.js`, collision hooks in
`city/main.js`/`city/goods.js`, render hook in `city/city-sprites.js`, focused
kerb tests and shared manifest/bundle/notes. Source review found repeated fixed
profile preparation, the mailbox's full round roof overlapping its carcass,
and rectangular collision/height checks that need actual-shape review. No
active bathroom/DINER/world-bootstrap/facade or shared helper edits planned.
Next #240/#241/#246 as the first dependency chain, then the remaining authorized
chains/independent PRs. Keep all remaining interior audit follow-ups recorded.

Kerb review update: five native/actual-geometry/cache/footprint checks pass and
all initial defect probes reject the broken geometry. One reviewed movement
choice supersedes earlier progress wording: keep main.js's original grounded
barrier check. Applying player foot-height clearance alone permits landing
inside props because street fixtures do not yet provide standing surfaces.
Ball collision keeps its explicit vertical interval, and round props retain
accurate footprints. Proper player prop-top support belongs with a later
movement chunk. No moves.js/terrain.js changes. Final scope is static shapes,
mailbox joins/labels, fixed caches, rounded walking footprints and ball height.
Visual review and ABAB costs, final probes/integration and push are pending;
do not merge the #238 baseline checkpoint yet. Original Claude head remains
33796bc; current review source is local atop checkpoint999af50.

#238 final review complete on `codex/review-kerb-fixtures`: cached fixed shapes
and translated rays; closed mailbox shell/roof, grounded supports, mounted
pulls, scaled nonemissive labels; accurate round footprints and finite-height
ball collisions. Five kerb and five native movement/lamp/ball/vending checks,
seven node checks and twelve independent mutations pass. Sixteen clear-floor
views and ABAB costs recorded in WORLD_QUALITY. #236 full CI green. The earlier
WIP checkpoint is superseded; player walking keeps its original barrier rule,
with prop-top support explicitly left for a separate movement chunk. No active
Claude files or shared helper edits. Ready to push original #238 branch/merge,
then #240→#241→#246. Remaining #239→#245, #242/#243/#244 and #248→#249 remain
authorized; preserve latest heads/ownership and all interior audit follow-ups.
Hotel/motel private washrooms remain closed and auto-closing in pass6; homes
are unchanged by that decision.

#238 merged as97064be. Codex active `codex/review-utility-cabinets` (#240),
merging main into Claude's8424597 without replacing either agent's history.
Files: `city/kerb-fixtures.js`, `city/kerb-fixtures-render.js`, kerb browser
checks and shared bundle/notes. Integrate cabinets into the reviewed cached
model path, retain actual kerb footprints/ball heights and original grounded
walking rule. Cabinet collision must use the cabinet rather than the hydrant
fallback; inspect joined door hardware, mounts and scaled labels. Next #241
then #246 in the first chain. Reserved Claude source/shared helpers untouched.

#240 final review on `codex/review-utility-cabinets`: six focused and five
native integration checks, three node files, nine defect probes, twelve
clear-floor views and ABAB costs complete. Cabinets use cached fixed surfaces,
joined hardware and actual cabinet-sized/height-aware collisions; preserve
#238's grounded walking decision. Ready to update the original PR branch and
merge, then #241→#246. No active Claude/shared helper edits. All remaining
interior audit and hotel/motel door decisions stay recorded.

#240 merged as c33235a. Codex active `codex/review-street-shelters` (#241).
Files: kerb placement/render modules, kerb browser checks, the authored rain
hook in city-render.js and shared bundle/notes. Integrating reviewed main;
cache shelter surfaces, physically support the advert and glass end screen,
share surface/collision bounds including posts and terrain-aware rain cover.
Next #246 overhead cables. No reserved Claude/shared helper edits planned.

#241 final review complete: eight focused plus three furniture/native C
checks, three node files, eleven negative probes, eleven clear-floor views
and ABAB costs recorded. Supported advertising/end glazing, shared actual
surface collision, cached parts, terrain-aware dry cover and live night
lighting all checked. #240 full CI green, superseding cancelled #238 run.
Ready to update original #241 branch and merge. Next #246: newest connector
head is3c98f91 (not the earlier7bcd417); fetch it explicitly before reviewing.
Other authorized chains, interior remnants and hotel/motel door decision
remain unchanged. No active Claude/shared helper edits.

#241 final fetch found Claude's concurrent main-integration commit ae39b63.
Merged it into this review without dropping its ancestry. Its cache port is
covered by the reviewed model path; retained the tested supported-frame,
shared-surface collision/rain and glint fixes. Final runtime sources, bundle
and tests are byte-identical to the reviewed b954d8d versions. Ready to push
and merge original #241; do not start another shelter chunk. #246 follows.

#241 merged as d7da37f. Codex active `codex/review-overhead-cables` (#246),
starting from Claude's latest3c98f91. Files: kerb placement/render modules,
kerb/overhead browser checks and shared bundle/notes. Preserve #241's supported
frames/rain/collision fixes while retaining Claude's cached pole port. Review
fixed span caching, transformer lead contact, service-drop wall mounts and
actual guy-wire foot clearance. Next #239→#245, then independent #242/#243/
#244 and #248→#249. No reserved active Claude/shared helper edits planned.

#246 final review on `codex/review-overhead-cables`: cached span detail levels
and correct moved wire coordinates, transformer bushings/leads, wall-mounted
drops with attachment-aware culling, supported longer guards and actual guy
foot clearance. Five focused and eight inherited kerb controls pass across
final runs, three node files, thirteen mutations and thirteen clear-floor
views plus ABAB costs recorded. #241 full CI green. Remote Claude head moved
to1267478 (main integration only); preserve it before final push. Next #239
then #245, followed by #242/#243/#244 and #248→#249, then passes5/6/9. All
reserved source/shared helpers untouched; retain interior audit remnants and
hotel/motel closed/auto-closing door decision without changing homes.

Preserved Claude's1267478 refresh in the #246 review ancestry. Its main merge
and cached-pole adaptation are covered by the reviewed implementation; final
runtime sources, bundle and checks are byte-identical to e03a5ac. Ready to
push/merge original #246. Do not duplicate the overhead review; #239 is next.

#246 merged as33d70e7. Codex active `codex/review-street-drains` (#239),
starting from c5bf46b. Files: new city/street-drains.js, its ground hook in
city-render.js, focused browser checks, manifest/bundle and shared notes.
Check whole grate extents, filtered materials, tree-pit cell boundaries and
rain only flowing to actual grates. Next #245 service hatches. Reserved
Claude source/shared helpers remain untouched; retain all remaining queue.

#239 final review complete on `codex/review-street-drains`: whole cached tree
pits across cell boundaries, no runoff toward absent bridge gullies, smooth
bar coverage/tones. Four browser checks including actual ground raster, three
node files, eight negative probes, thirteen clear-floor views and ABAB costs
recorded. Ready to push original c5bf46b-derived branch and merge; next #245.
Keep remaining independent chains/interior passes and all reserved ownership.

#239 merged as0a35222. Codex active `codex/fishing-audio-clock-test`, a small
CI repair before dependent #245. #246 full CI passed Node and browser1/3/4;
browser2 failed only the bobber audio delay assertion (0.0419s measured versus
~0.0533s expected). Its mocked callback subtracts a live audio clock, making
browser preemption alter the assertion. Reproduce with controlled clock
advance, keep all distance/gain/pan/ice/cast checks, and restore the live clock
after the intercepted-voice test. Files: activity-feedback browser test and
shared notes only; no runtime/audio or reserved Claude source edits planned.

Fishing clock repair complete: old test fails under a controlled40ms callback
stall, corrected fixture survives it and passes two normal runs. Four timing/
gain/pan/ice defects still fail unchanged assertions; three node files pass.
Only the test and shared notes changed. Ready to push/open/merge this small
CI repair, then resume #245 from main including #239. #246 full CI failure
is diagnosed rather than retried blindly; verify the repaired full run later.

#263 fishing clock repair merged as9ea30c9. Codex active
`codex/review-service-hatches` (#245), integrating latest main into Claude's
8e5c5bd-derived branch. Files: street-drains module and focused tests plus
shared bundle/notes. Preserve whole tree grates, no bridge runoff and smooth
coverage from #239. Review hatch floor attachment/placement, cached cell bounds
and close/far material transitions. Next #242/#243/#244 then #248→#249 and
passes5/6/9. No reserved Claude/shared home/hotel helper edits planned.

#245 source checkpoint: eight focused native drain/hatch checks, three node
files and nine independent defects verified; eleven final clear-floor views
reviewed. Hardware no longer resembles dark holes and follows ambient light.
Final ABAB run/notes and original-branch push/merge still pending. Checkpoint
on Codex's backup branch only; do not merge it before the final review note.

#245 final review complete; supersedes ba7448d checkpoint's pending status.
Eight native checks, three node files, nine mutations and eleven final views
pass; ABAB costs recorded. A longer isolated wide-view repeat does not
reproduce the10.8ms outlier (4.9–5.7→4.9–5.1ms). Original remote head remains
8e5c5bd; ready to update/merge it. #263 full CI queued at last check. Next
#242/#243/#244, then #248→#249 and passes5/6/9, preserving ownership/remnants.

#245 merged as094a819. #263's fishing-clock repair full CI is GREEN (run
40332262062), superseding the earlier queued status. Codex active
`codex/review-street-lamps` (#242), starting from831d99f. Files: new
city/street-lamps.js, lamp draw relocation in city-sprites.js, focused tests
and shared manifest/bundle/notes. Preserve the shared STEEL helpers and Belle
lamps. Review cached fixed profiles, connected neck/drop/lantern surfaces,
terrain offsets and near/far continuity. Next #243 signals, #244 utilities,
#248→#249, then passes5/6/9. Reserved Claude source/shared helpers untouched.

#242 source checkpoint: cached fixed lamp styles and stable moved tube rays,
physical supported lantern ribs, preserved thin-neck fallback, and standard
lamp culling includes its visible head while Belle retains its old path.
Three focused and four native Belle/snow/cover/collision checks plus four node
files pass. Thirteen independent mutations reject broken geometry, caches,
lighting, glyph coordinates and culling. All5234 native lamp bases have zero
terrain height; placements remain unchanged. Belle control pixels identical.
Final full-height views and ABAB costs are running; backup checkpoint only,
not yet ready to merge original #242. Next #243 and the remaining queue.

#242 final review complete, superseding adce610's pending checkpoint status.
Three focused/four native controls, four node files, thirteen defect probes
and fourteen final views pass. Cached styles, physical supported ribs, real
head visibility and both thin-line/billboard paths reviewed; Belle pixels
identical. ABAB and longer warm repeat recorded, with host tails explicit.
#263 full CI green; #245 PR run cancelled, so watch a later complete run
including hatches. Ready to push original831d99f-derived #242 and merge.
Next #243→#244 (independent reviews), then #248→#249 and passes5/6/9; retain
all ownership, hotel/motel door policy and remaining interior audit notes.

Concurrent main update: Claude's #262 integration merged as731b1c9 while the
#242 review was finishing. Merging it into this review, preserving all newly
integrated signal/facade/window/shutter/door/awning/bathroom/wallpaper work and
both note streams; use main's manifest order (a superset) and rebuild. Lamp
model and focused checks remain identical to reviewed d7f30d2. Recheck native
integration/views and ABAB against new main before merging #242. The remaining
#243/#244/#248/#249 baselines are now integrated; review as follow-ups rather
than duplicate merges. Claude also implemented the approved hotel/motel
closed/auto-closing washroom policy in #262; verify it in pass6, do not repeat
its implementation. Keep homes unchanged and reserved ownership intact.

#242 post-#262 integration review complete on `codex/review-street-lamps`.
Nine browser checks/four node files and fourteen updated views pass; Belle
pixels identical, fresh ABAB against731b1c9 recorded. Thirteen defect probes
cover unchanged lamp source. #262 full CI GREEN (40337743373), superseding
the #245 cancelled PR run. Original #242 remains open because its head now
contains reviewed fixes absent from the bulk integration; merge that follow-up.
#243/#244/#248/#249 already merged: review them on new branches, opening small
follow-up PRs only as warranted. Hotel/motel closed/auto-closing doors are
already implemented by Claude; verify in pass6. Keep homes/ownership intact.

#242 reviewed lamp follow-up merged as dbdd74c. Codex active
`codex/review-street-signals`, reviewing the already-integrated #243 baseline.
Files: city/street-signals.js and its focused browser test, bundle/shared notes.
Cache fixed signal profiles, housing/cowl/button/bracket preparation while
keeping vehicle state, pedestrian walk/flash/stop and face/LOD visibility live.
Review actual contacts, translated rays and native close/wide/oblique/night
rasters against dbdd74c. Next facade utilities, integrated facade audit and
passes5/6/9. Keep reserved Claude files/shared helpers untouched; private hotel
washroom policy is already implemented and needs verification, homes unchanged.

User update: Claude is out of weekly usage, paused before committing
`claude/sign-lettering` while its mutation run was active. Neither that branch
on origin nor a local worktree/process is available in this workspace as of
this check. Do not recreate/overwrite its unpublished lettering changes or
claim its mutation run finished. Preserve the typography/facade ownership;
resume that work once its clean source is pushed. Codex continues independent
signal/utilities and home/hotel/civic chunks.

Signal follow-up review complete on `codex/review-street-signals`, from dbdd74c.
Fixed four-style geometry/material/ray/lamp-order cache retains live states,
face selection and near/far fallback. Four focused plus four lamp/awning native
controls, four node files and thirteen defect probes pass. Thirteen final
clear-floor views match main pixel for pixel. ABAB costs recorded, broadly
unchanged with a small hood-view increase; no broad FPS claim. Ready for a new
follow-up PR/merge (original #243 is already integrated). Next facade utilities,
then integrated fascia audit and passes5/6/9. #242 CI Node/browser1/2/4 passed,
shard3 cancelled; watch a subsequent complete run. Keep unpublished Claude
lettering and all reserved ownership untouched.

#264 signal follow-up merged as bbe44ce. Codex active
`codex/review-facade-utilities`, independently reviewing integrated #244.
Files: city/facade-utilities.js and its focused browser test, bundle/notes.
Audit actual wall/pipe/bracket/hopper/shoe/meter contacts and native clearance;
cache fixed preparation if it preserves the reviewed geometry and LODs.
Do not edit reserved architecture/world-bootstrap/lettering helpers or Claude's
unpublished sign-lettering work. Next integrated fascia audit, then passes5/6/9;
verify the already-implemented hotel/motel door policy, leave homes unchanged.

Utility follow-up complete on `codex/review-facade-utilities` from bbe44ce.
Lazy fixed models preserve2470 native routes, supports, meters and runoff;
no placement changes were needed. Three utility plus awning/two fascia browser
checks, four node files and thirteen independent defect probes pass. Sixteen
native views match main pixel for pixel. ABAB/longer repeat recorded, including
host tails; no general frame-time gain claimed. Ready for follow-up PR/merge
(original #244 is already integrated). Next finish the read-only integrated
#248/#249 fascia review, then passes5/6/9. Old home-window worktree is clean
and its76984a3 already lies in current main history; don't duplicate it.
#264 CI Node/browser1/2/3 passed, browser4 still running at last check. Keep
unpublished Claude lettering and all reserved source/shared helper ownership.

#265 utility follow-up merged as c9af5e3. Codex active
`codex/integrated-fascia-audit`: read-only review of integrated #248/#249,
with existing focused tests, bundle-only negative probes and native views.
Only append shared review notes; do not edit Claude's facade/typography source
or recreate the unavailable unpublished sign-lettering changes. Next Codex
implementation is pass5 home openings/trim/layout character, then passes6/9.
Old home-window work is already merged; preserve hotel door policy and homes.

Integrated fascia audit complete on `codex/integrated-fascia-audit`.
Ten native facade checks/two node freshness/parse files, seven bundle-only
negative probes and24 clear-floor views pass. Source, manifest and bundle
remain identical to c9af5e3; ABAB control costs recorded. This finishes the
independent #248/#249 baseline review, while pass13 and Claude's inaccessible
unpublished sign-lettering work remain OPEN. Do not infer a release of reserved
facade/typography ownership. #264 full CI GREEN (40372798867); #265 queued/run
40375072462 still in progress. Next Codex pass5 home entrance doors/surrounds
in a new home-only module and homeDef in rooms.js (no shared door/bath helpers),
then home layouts, hotels and civic. Preserve homes' washroom state and verify
the already-implemented hotel/motel closed/auto-closing policy during pass6.

#266 integrated fascia audit merged as f4168e3. Codex active
`codex/home-entry-doors` (pass5): new city/home-entries.js, only native homeDef
in rooms.js, focused home-entry browser test and shared manifest/bundle/notes.
Build fitted opaque entrance leaves/surrounds with joined supports, recessed
panels and mounted hardware for studio/loft/Belle homes; preserve the existing
exit grid, E interaction and route. Use homeDef's existing doorWall opt-out
instead of changing the shared roomWall/shop/hotel door painter. Fern, Cabin,
hotels, washroom helpers/state and Claude's reserved/unpublished lettering stay
untouched. Next remaining home trim/layouts, then hotel/civic passes6/9.

Home-entry source checkpoint on `codex/home-entry-doors`: fitted studio/loft/
Belle leaves, surrounds, supports and mounted hardware are implemented;
both real E and walking exits pass, and home bathroom defaults stay open.
Two focused geometry/native checks and eight existing home/window/Fern route
controls pass across runs; four node files passed before the final material
cleanup. Visual review found flat-looking recesses and subpixel bright trim
flecks, so panel contrast was corrected, thin ornament removed and fine edge
lighting filtered without changing geometry. Final24 views generated; all
camera floor positions clear. Defect probes, final integration/node checks,
ABAB costs and final note/PR/merge remain pending. This is a backup checkpoint,
not approval to merge. No reserved files or shared door/bath helpers changed.
#265 CI Node/browser1/2/3 passed, browser4 cancelled, so verify a subsequent
complete run including utilities. #264 full CI is green.

Home-entry final review complete; supersedes6afebcb checkpoint's pending status.
Two focused plus eight home/window/Fern controls, four node files, the old
painted baseline and sixteen independent defect probes pass. Twenty-four
final native views reviewed; cached physical panels/frames/hardware and filtered
fine lighting retain clean close/oblique/night silhouettes. ABAB costs recorded:
whole normally1.1–1.2ms (one2.3ms tail), macro up to3.6ms, versus old flat paint
0.4–0.7ms. Added quality has measured cost; no FPS gain claim. Ready for final
note push/new PR/merge. #266 full CI GREEN (40376308187), including utilities;
this supersedes #265 cancelled-run concern. Next home interior passage
surrounds/trim, remaining layouts, then passes6/9. Do not duplicate completed
home windows or hotel washroom policy; preserve homes' bathroom state and all
reserved/unpublished Claude source. No shared door/bath helper changes.

#267 home entrance doors merged as ba55690. Codex active
`codex/home-passage-surrounds` (pass5): new city/home-passages.js, only homePlan/
homeDef in rooms.js, focused native home-passage test and shared manifest/
bundle/notes. Derive the loft/Belle bedroom/study openings from the same cut
measurements as their native grids; build closed supported reveals, surrounds
on both wall faces and overhead infill while retaining wide walk-throughs.
Each collider must follow its actual rendered part; no full-opening bounding
collider. Studio/Fern/Cabin, balcony openings, bathroom state/helpers, hotel/
shop helpers and reserved/unpublished Claude lettering remain untouched.
Next remaining home trim/layout character, then hotel/civic passes6/9.

Passage source checkpoint: three focused geometry/collision/native-render
checks pass on final source. HomePlan shares the exact cut measurements with
closed reveals, two-faced casings and overhead infill; each prop collider is
its rendered box, leaving the1.9m centre open. Native wall paint/ceiling bands
and live light changes continue across the infill; buried end caps defer to
native walls at the joins. Twenty clear-floor views generated/reviewed;
eight prior home-entry/layout controls and four node files passed before
final material/joint refinements. A too-long straight study test met the same
existing dining chair before/after at(13,8.8); the focused route now spans the
whole wall depth and both immediate approaches, without testing a walk into
that chair. Remaining: bundle-only negative probes, final integration/node
checks, ABAB, final notes and PR/merge. Backup checkpoint, NOT ready to merge.
#267 entrance full CI GREEN (40380569613). Keep all ownership and remaining
home/hotel/civic work, including the unavailable Claude lettering branch.

Passage final review complete; supersedes9932c92 checkpoint's pending status.
Three focused plus ten entrance/window/layout/Fern controls, five node files,
the old baseline and thirteen independent defect probes pass. Twenty final
clear-floor views reviewed. Shared cut measurements, closed supported caps,
two-faced casings, native paint/bands/light and exact part colliders preserve
the wide route. ABAB costs recorded (+about0.1–0.7ms for added surfaces).
Ready for final note push/PR/merge. #267 full CI GREEN (40380569613).
Next pass5: Belle balcony rails/door finish and coherent outside furniture,
then remaining home trim/layout audit before hotel/civic passes6/9. Existing
balcony rails are painted both indoors and outside; inspect their shared
measurements and room/world scaling before changing them. Keep bathroom state,
shared helper ownership and unpublished Claude lettering reservation intact.

#268 home passage surrounds merged as e02af73. Codex active
`codex/home-balcony-rails` (pass5), starting with a room/world geometry and route
audit before editing: home-balcony.js, home-only rail builder, homeDef/homeWall
B handling in rooms.js, focused tests and shared manifest/bundle/notes.
Belle rails are currently painted indoors and outdoors; use shared measured
rails with the existing metre→city mapping and an explicit distant fallback.
Preserve balcony boarding/return, usable furniture and native footing. Do not
change shared shop/hotel helpers, washroom state or reserved/unpublished Claude
lettering. French-door finish and exterior furniture fidelity are separate
follow-ups; then remaining home trim/layout audit and hotel/civic passes6/9.

Balcony source checkpoint (NOT merge-ready): six focused checks pass on the
final fitted model, including all three native runs, room/city scaling,
closed supported geometry, routes and exact row coverage from outside. Visual
review found two defects during development: subcell tubes disappeared between
rows, and the old painted B grid could occlude the physical rails. The home-only
built-rail path now uses measured line colliders, no painted grid height, and
cached solid thin strokes selected against both screen axes. Fifteen final
room/city/aerial close/wide/oblique/night/wall/foot views generated and reviewed.
Standing room/deck cameras are clear; aerial cameras intentionally sit beyond
the platform. Final home controls are running. Remaining: bundle-only negative
probes, final bundle/node and native Belle controls, isolated ABAB, final notes
and PR/merge. No mutants are running at this checkpoint.
User's new reports are appended in WORLD_QUALITY.md and take priority after
this checkpoint: fixed physical wall-section materials, taco/coffee washroom
access, street stair/door clearance, aquarium gift-shop sign and missing roof
stair landing. Claude is out of usage; preserve unpublished sign-lettering and
reserved bathroom/DINER/world-bootstrap/facade source. Make narrow follow-up
fixes in shop/dining files rather than restarting completed quality passes.

Balcony final review complete; supersedes41b6d51 checkpoint's pending status.
IMPORTANT correction to that checkpoint: the original B grid boundary/height
is retained. Its north row is2, not3; a correctly targeted negative probe
showed that the grid-height removal was unnecessary. The final change removes
only its painted ironwork, and checks no duplicate surface while preserving
native height1.1. Physical feet/bowed bars stay inside those original edges.
Six focused geometry/cache/room-city/three-side/thin-row/native checks and
thirteen home entrance/window/passage/layout/Fern controls pass across final
runs; both real Belle walk-out/return/reload controls also pass on final source.
Five Node bundle/parse/render/streetscape/furnishing files pass. The full Node
suite is still running (93943, scheduler184352, current seeded-minigame
child188225); it has NOT failed or hung: inspection showed the pachinko test
loading120 complete seeded cities. Scheduler and child are RESUMED after the
isolated benchmarks. Do not report full suite green until it finishes.
Old painted baseline plus17 independent defects fail assertions; mutants were
served by a browser route from an ignored file, never written into source or
the saved bundle. Literal-safe replacement fixed a probe runner issue; the
unnecessary grid-height mutant legitimately survived and prompted the reversal.
Fifteen final clear-floor/native-deck/aerial views reviewed. ABAB against
e02af73 adds roughly1–2ms in most views. Room-wide after varies3.6–7.7ms
versus2.2–2.3ms; aerial oblique initial16ms tail repeated7.8–10.4ms, night
repeated7.6–7.7ms. Added quality costs time; no general FPS gain claim.
Ready for final note push/PR/merge. Next: user's six reported fixes, starting
with fixed shop section materials (five viewIn-dependent painters confirmed),
then taco/roastery door approaches (salsa bar and plant reproduced; CAFE clear),
street stairs/door placement audit, aquarium gift-shop lettering and walk-up
landing. Keep reserved bathroom/DINER/world-bootstrap/facade and unpublished
Claude lettering untouched. Remaining balcony French-door/exterior furniture
and passes5/6/9 follow after the new fixes. Artifacts:work/backlog-review/
home-balcony-rails-*; initial door audit:new-fixes-washroom-baseline.json.

#269 balcony ironwork merged as b9e7883. Codex active
`codex/fixed-shop-wall-materials`, a narrow reported-fix follow-up in
city/shops.js plus one focused browser test, bundle and shared notes. Five
wall painters currently use viewIn: hardware garden, grocer stockroom, video
backroom, herbs tea room and liquor cold room. Their physical wall sections
must retain their material from either side of the section boundary. No
reserved bathroom/DINER/world-bootstrap/facade or unpublished lettering edits.
Next taco/roastery washroom approaches, street entrance/stair clearance,
aquarium gift-shop sign and roof stair landing; remaining passes5/6/9 after.
Full Node suite93943 continues in the background on unchanged pure sources.

Shop wall materials reviewed: five section painters now use physical wall
coordinates, with the garden back wall included in trellis and one consistent
cold-room insulation finish. Removed the now-unused viewIn helper; audit found
no other whole-section camera-position wall switches in shop/dining/eatery/
lobby/storefront painters. The remaining wcFaceInside camera comparison
selects the physical wall face, and homeOutdoorRay maps perspective; retain
both. Two focused material/native hardware walking checks, four hardware/
fridge/gondola controls and two Node bundle/parse files pass. Old baseline plus
seven independent camera/back-wall/global-material defects fail assertions.
Twenty clear-floor close/wide/oblique/night views reviewed across all five
rooms. ABAB177x66 mostly unchanged: hardware-wide1.7–2.1→1.9–3.3ms,
hardware-close1.6–1.7→1.7; grocer-wide1.6–1.7→1.7, close1.3–1.4→1.3–1.4;
video-wide1.8–1.9→1.8–1.9, close1.5–2.1→1.6; herbs-wide2.4–2.5→2.4–2.6,
close1.5–1.6→1.5; liquor-wide3.3–3.5→3.3, close1.5→1.5–1.6. Hardware
wide has a variable tail; no FPS gain claim. No geometry/helper API changes.
FULL NODE SUITE FINISHED:1069/1069 PASS (work/backlog-review/
home-balcony-rails-node.log). Scheduler/children exited normally; no paused
test remains. This supersedes earlier pending full-suite notes. Pure sources
were unchanged during the wall follow-up; final bundle checks also pass.
Next taco/roastery door approaches: move long salsa bar farther toward the
front wall and move its cooler beside it facing north, with measured clear
apron/no overlaps; relocate roastery plant from immediately in front of door
to a clear corner. CAFE is clear and remains a control. Keep reserved sources
and unpublished lettering intact, then remaining new reports and passes5/6/9.

#270 fixed shop-section materials merged. Codex active
`codex/clear-washroom-approaches`: narrow taqueria placement in city/eateries.js
and roastery plant in city/dining.js, one focused bathroom-access test, bundle
and shared notes. Keep the door helpers/state and DINER definition untouched.
Move the salsa bar farther from the door and its cooler to the front wall,
with actual full-width approach clearance, fixture bounds and sitting/service
routes checked. Relocate the roastery door-blocking plant to a clear corner;
CAFE stays a regression control. Then aquarium sign/roof landing and street
stair/door placement audit, followed by remaining passes5/6/9. Full Node is
1069/1069 green; no test process remains paused/running from that run.

Washroom approach final review complete. Taqueria salsa moves to(11.63,6.5),
cooler to front wall(10.1,7.6) facing north; bounds are separate and fully
inside the walls. Roastery plant moves to(1.4,7.4); both lounge chairs shift
half a metre left to retain a comfortable full-width door approach. CAFE stays
unchanged and passes the same route controls. Three focused apron/real E/
native walking/toilet/return/autoclose/fixture bounds checks, both all-shop
route/seating sweeps, coffee service and three cooler/salsa/taco controls pass
(nine unique browser checks), plus two Node bundle/parse files. Old baseline
and seven independent obstruction/overlap/facing/wall defects fail assertions.
Fourteen final close/wide/open-oblique/night/fixture/plant views reviewed.
An initial wide camera touched the same existing roastery table before/after;
final x9.2 cameras are clear in both. ABAB177x66 main→after: taco-wide2.8→
2.3–2.5ms, close2.2–2.6→2.0; roastery-wide2.3–2.6→2.1, close2.3–2.4→2.0;
CAFE-wide1.6→1.5, close1.8→1.8. Layout changes alter what's visible; no general
render speedup claim. #269 FULL CI GREEN40419236061, superseding #268 partial
run concern. Full Node1069/1069 already green on unchanged pure sources.
Ready for final note push/PR/merge. Next aquarium gift-shop sign and missing
walk-up landing, then street-object entrance/stair clearance audit. Preserve
reserved bathroom/DINER/world-bootstrap/facade and unpublished lettering work.

#271 washroom approaches merged as22096d6. Codex active
`codex/aquarium-gift-sign`: narrow aquarium interior wayfinding correction in
city/aquarium.js, one focused native sign visibility/access test, bundle and
shared notes. The right-wall GIFT SHOP lettering overlaps the isolated reef
tank at(22,12); inspect actual native rays, then put the label over the gift
counter on the front wall, retaining existing scalable lettering. Preserve
fish/animal code and reserved facade/global lettering. Then the walk-up's
missing stair landing and street-object clearance at doors/stairs, followed
by remaining passes5/6/9. #269 full CI and full Node1069/1069 are green;
#270 CI was still running at the last check. No parallel Codex chunks active.

Aquarium sign final review complete. GIFT SHOP now sits on the solid front
wall above keeper/counter X, away from the isolated reef tank. Native rays
also exposed wrong-signed left/front wall anchors; these and the left ocean
hall label now use the proper interior-facing signs. All gift letters are
visible from four clear native approaches including night, and enlarge up
close. Exit and both ocean-hall faces have native visibility checks; other
gallery anchors are retained with corrected left-face coordinates. Tank hood
labels and fish geometry stay unchanged. Three focused checks, two aquarium/
touch-pool/plush controls and two Node bundle/parse files pass across final
runs. Old baseline plus nine independent mounting/duplication/missing/height/
signed-face/scale defects fail assertions through isolated browser bundles.
Nine clear-floor wide/close/oblique/night/old-side/service/exit/gallery/reef
views reviewed. ABAB177x66 main→after: wide2.3–3.5→2.0–3.0ms, close1.7–1.8→
1.7–2.0, oblique2.0–2.1→2.0–2.4, exit1.3→1.3–1.9. Newly visible glyphs
change work; broad performance gain is not claimed. #270 and #271 FULL CI
GREEN40420200068/40421294748; full Node1069/1069 already green. Ready for
final note push/PR/merge. Next missing walk-up stair landing: real stairRise
clamps to1m between stair topY2.6 and doorY1, but stairSteps only builds
Y2.6..7.6. Supply supported closed geometry connecting top tread to roof door,
including the landing banister feet; preserve E/return. Then street-object
stair/door clearance audit and remaining passes5/6/9. Keep reserved bathroom/
DINER/world-bootstrap/facade and unpublished Claude lettering untouched.

#272 aquarium gift/inside-face labels merged. Codex active
`codex/walkup-stair-landing`: city/lobbies.js, one focused native landing test,
bundle and shared notes. Audit finds the walk-up is the stair-based roof lobby:
stairRise lifts the player to1m all the way to the roof door, while ten tread
boxes end atY2.6 and leave Y1..2.6 visually unsupported. Build a closed fitted
landing from that top tread to the wall, supporting the level banister feet,
with joined wall/tread edges and cached geometry. Preserve existing stair
height, rail boundaries, room/roof E and return; do not change shared stair
helpers or other lobbies. Then the street-object door/stair clearance audit,
followed by remaining passes5/6/9. #269–#271 full CI and Node1069/1069 green.
Keep reserved bathroom/DINER/world-bootstrap/facade and unpublished lettering
untouched. No parallel Codex chunk is running.

Walk-up landing reviewed. Added one cached closed rounded masonry solid from
the actual top tread to the door wall, slightly buried at both joins, widened
only at its outside edge to carry the level banister feet. Original stairRise,
rail barrier, E and roof return are unchanged; walk:true retains the usable
surface. Bounds/material are prepared once (literal bounds avoid calling the
later renderer const during module initialization). Actual rays check support
across the entire platform and millimetre-side samples at the tread join,
closed underside, curved corner and rail feet. Native walking/E/return and
actual landing pixels pass. A first fixture incorrectly used p.x/y for classic
BX stair boxes; corrected to their real p.box.x/y before counting its result.
Three focused plus three original lobby/police navigation checks and two Node
bundle/parse files pass. Old baseline plus ten independent join/ground/height/
rail-support/collider/cache/draw/roundness/material defects fail assertions.
Nine clear-floor native/low inspection views reviewed across Brownstones,
Chinatown and Shotengai, including close/wide/oblique/night and both joins.
An initial side camera was too close to assess context; final lower side view
shows the whole supported face. ABAB177x66 main→after: wide2.0–3.5→2.3–2.4ms,
close1.1–1.2→1.8, oblique1.6–1.7→2.3, low side1.5–2.2→2.0. Added solid
normally costs about0.6–0.7ms in close/oblique views; no speedup claim. Ready
for final note push/PR/merge. This fixes the reported landing, not lobby pass9:
existing door/rail finish remains for that pass. Next last new report: street
items and vending machines blocking rendered building stairs/entrances.
Audit exact native geometry and all static placement families. Prefer cached
placement-only approach reservations and existing fitStreetFixtures; never
add invisible player colliders/shelter. world-bootstrap/facade edits remain
reserved, so use a post-assembly call if native refresh is needed. Include
kerb fixtures created later and keep bucket/glow caches and el stair clearance
consistent. Then remaining passes5/6/9 and unpublished Claude lettering hold.

#273 physical walk-up landing merged. Codex active
`codex/street-entrance-clearance`, beginning with a native placement/geometry
audit before choosing source changes. Likely ownership: new cached pure
entrance/step-approach helper, city/streetscape.js fixture placement predicate,
city/kerb-fixtures.js placement only, optional separate post-assembly call,
focused native audit test and shared manifest/bundle/notes. No geometry or
rendering changes to held facade/world-bootstrap files. Keep reservations
placement-only, not invisible player/shelter colliders. Cover rendered
brownstone steps and actual door fronts, service door points, ordinary street
fixtures, machines and later kerb fixtures. Preserve existing street geometry,
el stair clearance, buckets, lamp glow, orientation and anchored machine backs.
Choose move/skip behavior from actual full-world conflict counts and visible
examples. This is the last new reported-fix group; remaining passes5/6/9 follow.
#269–#271 full CI and full Node1069/1069 green; #272/#273 CI pending. Preserve
unpublished Claude sign-lettering and all other ownership reservations. No
parallel Codex chunk is running.

27 October follow-up: user also requests item use aboard boats and the elevated
train (and check ferry consistency). Queue a separate input/held-item chunk
immediately after the active street entrance fix. Existing main.js restricts
boat/sea Q and click to rods, el lacks the shared item/quick-slot handler, and
ferry only permits food/drink. Check real inventory/slots/Q/click, effects and
travel/movement controls without bypassing arrest/menu/sleep guards. No second
copy of the street chunk is running. #272 and #273 full CI are GREEN
(40422759285/40424527249).
Clarification: by boat the user means the ferry, not the marina/garden boats.
The queued input chunk is ferry + elevated train; leave small-boat input alone.

Street entrance implementation/review checkpoint: finished-world reservations
now follow offset merchant doors, repeated brownstone bays, housing/generic/
Belle frontages, real service points and each actual stair flight plus its side
rails, outer foot and raised headroom. The cache is placement-only and has no
player collider/shadow/rain/render hook. Native refitting slides the existing
fixtures along the curb/facade, preserving orientation and machine backing;
lamps recalculate arcade height at candidate positions. Both body and vendor
stay together, bikes keep their extras index, final buckets/glow refresh, and
new kerbs/shelters reserve access before spawning (shelter benches stay attached).
Controller cabinets retain their actual nearby signal pole; the inherited
kerb control caught exact-.8m remote placements and now passes. All fixtures
fit without removal, including all448 machines and28 carts. Cached approach
index includes8098 entries across1356 physical stoops. Five focused checks
include native rendered door-centre agreement and actual E-entry through the
hardware door and former cabinet-blocked brownstone flight. Original awning,
kerb and vending controls pass across final runs; nine Node checks pass. Old
baseline +9 independent defects fail assertions using isolated routed bundles;
the additional old native-stoop walking check fails as expected. Actual walk
stops at the existing wall boundary on the high tread, rather than pretending
the wall can be walked into. Final close/wide/oblique/night views show the
cabinet off the stair and post off the door. ABAB repeat is still finishing;
no source mutants or other Codex chunks are running.

Known separate follow-ups from the full native audit: eight authored night-
market counter/pole conflicts belong to five coherent stalls, so do not move
those solids apart. Address them as a complete scene, preserving vendors,
interaction points, canopies, indexes and road clearance. Also fourteen native
machines already lack backing after world assembly on unchanged main; this
chunk preserves their existing positions and tests backing on every relocation,
not a fabricated all-world invariant. Keep that independent placement cleanup
visible in pass11. User-priority next: general handheld item use on FERRY and
EL TRAIN (not marina/garden boats), then the night-market scene and remaining
passes5/6/9. All held Claude reservations remain untouched.

Final street review: all18 unique browser checks across final focused/inherited
runs and nine Node checks pass. Settled60-warm/120-sample ABAB177x66 repeat,
main→after: door wide5.5–5.6→5.4ms, close5.8–5.9→5.8–6.0,
oblique6.2–6.4→6.2–6.3; machine wide4.6→4.5–4.7,
close4.6–4.7→4.5–4.6, oblique4.6–4.7→4.5–4.6;
stoop wide5.6→5.5, close5.3–5.4→5.1, oblique5.5–5.7→5.6.
Initial run overlapped browser checks; settled repeat resolves its load tails.
No material render regression or general FPS gain claim. Final paired24 views
are clear-floor; originally blocked cabinet is visibly beside the full stairs.
Old native walking control stops at433.64 with no stair height; final reaches
the existing high tread/wall boundary at433.94, ground.096 and real E enters.
Old baseline plus9 independent defects and the extra old walking probe fail
assertions (11 total routed probes), without changing source/saved bundle.
Ready to commit/push/PR/merge, then ferry/el handhelds; keep coherent market
and14 unchanged native backing cases queued explicitly rather than claiming
all street scene placements are finished. No parallel Codex work or mutants.

#274 generated street entrance/stoop clearance merged as a3c8050.
Codex active `codex/transit-held-items` from that main. Ownership for this
separate user-requested chunk: shared handheld-mode helper in city/goods.js,
main.js item input only, goods-ui.js held rendering only, gun.js/gun-ui.js
handheld mode/aim/HUD only, held-curios.js telescope activation only, optional
touch controls if their aboard affordances need it, new focused transit item
browser test and shared bundle/notes. Preserve actual walking mode semantics,
boarding/seat/arrival controls, sleep/arrest/menu/freecam guards and small-boat
input. Exercise real ferry/el boarding, quick slots, inventory, Q/click,
visible held gear and telescope, and continuing movement/travel. Then coherent
night-market obstruction and fourteen native backing cases, then passes5/6/9.
Held Claude bathroom/DINER/world-bootstrap/facade/global lettering remain
reserved; no parallel Codex task is active. #274 CI pending, check later.
Transit chunk also owns only the ferry/el help strings in city/hud.js; its
carriage geometry and other HUD paths stay untouched. The hints now describe
general item use/slots, and show aim/reload when a gun is held. A negative
probe proved an extra inventory X guard redundant: existing placeKey already
rejects moving passengers. Reverted that guard, retaining the original drop
policy and deriving the inventory drop hint from placeKey. Tests exercise that
policy and catch bypassing it. The first guard fixture wrongly expected
inventory Q to be swallowed; it intentionally closes the bag and uses once,
so that behavior is now checked and shop panels test input swallowing instead.

Transit review checkpoint: eight focused browser checks and six inherited gun/
ferry/el controls pass (14 unique); four Node files (goods, gun, bundle and
parse) pass, with final bundle/parse recheck green. Actual inventory/slots/Q,
captured mouse, food effects, music/tape, seated use, camera album capture,
6x telescope, gun aim/HUD/fire/reload, touch verbs, shop/sleep/freecam/arrest
input ownership, continuing travel/walking/C and drop policy are exercised.
The ferry travel fixture now advances beyond its real32s dwell rather than
mistaking a docked ship for a movement regression. Cabin context retains indoor
item restrictions on el/ferry lounge; open ferry deck supplies outdoor/water
context. Small boat/sea controls are unchanged. Old baseline plus12 independent
input/render/mouse/telescope/aim/HUD/reload/sleep/drop/context/touch defects fail
assertions across final isolated routed probes. No source mutants are active.
Reviewed22 final paired clear standing/seated/wide/close/oblique/night/live-
window/telescope/portrait views. First portrait capture was cleared by a
queued viewport-resize event under frozen RAF, now captured after resize;
first el-scope camera aimed at the door, final one aims through its real window.
No gameplay geometry change was needed for either fixture. Render ABAB is
finishing; then commit/push/PR/reviewed merge and follow up #274 CI. Next is
the coherent authored night-market obstruction, fourteen native backing cases,
then remaining passes5/6/9. Held Claude sources remain reserved.

Transit final ABAB177x66 main→after: ferry-wide7.4–7.5→8.3–8.5ms,
close8.3–8.4→9.1–9.4; el-wide7.5–7.7→8.3–8.7,
seated close9.3–9.4→10.1–10.3. Newly visible held models cost0.8–1.1ms.
Scopes7.0–7.1→5.5–5.6 ferry,9.1–9.2→7.1 el compare different narrow
fields of view, not equivalent-scene speedups; one existing world pass.
Final bundle checks pass; all14 unique browser checks/four Node files pass
across final runs, and all13 isolated old/independent defect probes fail their
assertions. No active mutant/temp source swap. Ready to commit/push/PR/merge.
#274 full CI GREEN40449222222 (Node plus all4 browser shards), superseding
its earlier pending status. Next keep the authored market and14 unchanged
native backing cases visible before remaining passes5/6/9. Do not touch
reserved bathroom/DINER/world-bootstrap/facade/global lettering/private
Claude sign-lettering. No other Codex chunk/session is active.

#275 ferry/el handhelds merged as75d6108. Codex active
`codex/night-market-clearance` from that main. Begin with coherent native
stall fitting: city/props.js night-market dimensions/group references only,
new city/night-market-placement.js after entrance fitting and before kerbs,
optional ignore-set parameter in streetGeometryCollision and optional explicit
boxes in the existing nearby-fixture placement query; focused native market
browser coverage and shared manifest/bundle/notes. Existing counters are9.6m
wide and roofs11.2m wide; compact realistic footprints allow a complete stall
to fit between doors while retaining its seller, service point, poles/canopy
and curb side. Use the cached actual entrance reservations, check all group
parts together, preserve wall backing/road clearance and update only affected
spatial/shelter cells once. Do not move individual parts apart or push sellers
into a traffic lane. No active mutants/other Codex session. Reserved Claude
bathroom/DINER/world-bootstrap/facade/lettering remain untouched. #275 CI
pending; #274 full CI green. Native14 backing cases and passes5/6/9 follow.

Market implementation checkpoint: counters now2.6m and roofs3.2m across,
with12cm grounded support posts that meet the canopy. Explicit groups retain
counter/canopy/poles/seller references through native assembly. Whole-stall
along-pavement fitting checks cached real entrances, all proposed solids and
seller head/body, actual wall backing, other stalls and ordinary street
fixtures; it keeps the original street side and never pushes into a lane.
Only changed geometry cells/snow caches and solid/extra buckets refresh.
Native full audit now reports ZERO ordinary, kerb, bike, cart or authored-solid
entrance overlaps (all797 authored solids checked). Allfive stalls retained,
no unfitted groups. Four focused market checks plus four coastal controls
pass, as do six inherited native entrance/awning/walking checks and four Node
goods/streetscape/bundle/parse files. Stronger independent physical-neighbour
oracle passes too. Native walking/E now enters the formerly counter-blocked
RAMEN door; tarp, CURIOS shop, fortune payment and goldfish E still work.
Visual and isolated negative reviews are running; source/bundle are unchanged
by mutants. #275 CI pending40450749769, #274 full green. Next fourteen native
orphan-backed machines, then remaining passes5/6/9. Reserved Claude sources
remain untouched; no second Codex chunk/session active.
Market negative-review refinement: native default placement did not need to
reject an ordinary fixture in its preferred gap, so merely removing that check
survived. The placement routine now has a callable once-at-init function and a
focused occupied-gap check: a real-sized native post occupies the preferred
spot, all parts move to a different supported gap, and a populated old roof
snow cache must agree with actual geometry afterward. Omitting neighbour
clearance and omitting snow invalidation both fail this physical check; stale/
missing/duplicate geometry cells and wrong buckets fail too. No per-frame
hook was added. First close/rear cameras had assumed a different fitting
choice; final cameras target actual STREET FOOD155.05,137.78, with a wider
view centred157.3 on the opposite walking line. Final five focused checks,
corrected views and bundle checks are finishing. No source mutants active.

CI follow-up now takes priority immediately after the nearly reviewed market
chunk: #275 Node and browser shards1/2/3 passed, shard4 failed only the
#272 aquarium OPEN OCEAN native label view. Failure was painted102/visible0
at camera3.1,2.6. Aquarium randomly puts an adult visitor at3,2.6, immediately
in front of that camera; inspect/reproduce it with a guaranteed adult rather
than weakening label assertions or deleting people. Likely use clear native
hall approaches farther from those visitor positions and retain forced
visitors in the regression. Keep this in its own branch/PR after preserving
night-market work. Market five focused checks,14 total native/coastal/street
browser checks, four Node files, two old-baseline +12 independent-defect probes
and16 final paired clear views pass/reviewed. No active source mutants.

Market final counts supersede14 above: FIFTEEN unique browser checks
(5 focused +4 coastal +6 native street/awning), four Node files and final
bundle checks pass. Two old-baseline +12 independent defects fail assertions
(14 routed probes). Sixteen corrected paired clear close/wide/oblique/night/
rear/pole/day views reviewed. ABAB177x66 main→after: wide7.4→6.9–7.2ms,
close6.9→6.8, oblique9.7–9.8→9.4–9.6, door7.4–7.5→6.5–8.0.
Smaller footprints change visible work; variable last door sample, no broad
speedup claim. Ready commit/push/PR/merge. Then separate aquarium native-camera
CI repair before fourteen orphan-backed machines and remaining passes5/6/9.
Do not fold a CI test repair into the market PR or leave dirty market work
behind on a branch switch. No active mutants or second Codex session.

#276 coherent market clearance merged as27feccd. Codex active
`codex/aquarium-label-view-fixture` from latest main; TEST ONLY ownership:
`test/browser/city-aquarium-gift-sign.browser.test.cjs` and appended notes.
Runtime/bundle/manifest stay unchanged. Reproduce shard4 failure with an adult
at the existing random visitor spot3,2.6, in front of the old camera3.1,2.6.
Retain real people/tanks/walls and full label visibility thresholds; choose
clear native approaches, likely4,2.1 and20,2.1 looking towards the same labels.
Keep guaranteed adults in that test and verify wrong signed anchors/old camera
fail. Then PR/merge CI repair and monitor full CI, followed by14 native backing
cases and remaining passes5/6/9. Reserved Claude sources unchanged; no parallel
Codex work or source mutants. Full #275 Node/shards1/2/3 green; only this old
native visibility fixture failed shard4. #276 CI pending.

Aquarium CI repair reviewed: guaranteed adult at3,2.6 reproduces the exact
CI painted102/visible0 failure from old3.1,2.6 camera. New left4,2.1 and
right20,2.1 cameras are1.118m/1.044m from the nearest guaranteed visitor;
exit view remains clear. All three focused checks and a fresh-room repeat
pass; wrong left/right signed anchors still fail assertions with the people
retained. Five old/clear/exit views reviewed. Runtime sources/bundle/manifest
are byte-identical to HEAD, verified by git diff: no runtime or render-cost
change, so no ABAB timing is meaningful for this test-only repair. Ready
commit/push/PR/merge and monitor full CI. Then native14 orphan-backed machines,
followed by remaining passes5/6/9. No active source mutants or parallel work.

#277 test-only aquarium visitor/camera repair merged asf0bc7b1; monitor its
full CI (old #275/#276 runs use the original fixture). Codex active
`codex/native-machine-backing` from that main. Own new
city/street-machine-placement.js after coherent market and before later kerbs,
optional extraction of the existing machine backing predicate in
city/streetscape.js, focused native machine placement test and shared manifest/
bundle/notes. Relocate only the14 native machines that lost a backing wall or
front access during assembly; retain all448 objects/kinds and their inventory
identity. Use actual cached facade approaches to find nearby mount planes,
orient to the real wall, retain door/stair/structure/transit/fixture clearance
and a usable front, and update each moved machine's bucket immediately so
subsequent candidates see it. No held world-bootstrap/facade/shared home helper
edits. Then remaining passes5/6/9. No source mutants or parallel Codex session.

Native machine checkpoint: all448 now have real backing/front access; only14
moved, none lost/unfitted. Nearby blank CITY shop-cell side walls are included
alongside actual entrance faces, so most move across the same street19–20m;
one constrained orphan needs a clear wall132m away within the bounded search.
Each move preserves the object/kind, turns the actual controls out of its new
wall, avoids doors/stairs/transit/other models and reserves customer standing
space as well as the body. Buckets update immediately between candidates.
Three focused +four original vending +five native entrance +one market control
pass (13 unique at this checkpoint), plus three Node street/bundle/parse files
and the focused pure vending goods check. New cold placement function allows
two physical stress cases: a preferred native PHARMACY doorway and an actual
post in the preferred customer standing area. Both pass. Removing only the
body's door check survived because customer clearance also protects that
approach; the complete missing-entrance-policy probe now removes both related
checks, with the actual doorway retained as its oracle. Finish these probes,
then final15 unique checks, close/wide/oblique/night/old-site/rotated/far-wall
views and ABAB. Existing runtime vending renderer is unchanged; isolated
model-axis defect probes do not edit its held source. #277 CI pending.

#277 full CI GREEN40453292812: Node and all4 browser shards, restoring the
merged main code's green status and validating combined market/transit work.
Native machine final5 focused checks pass, along with the ten inherited
vending/entrance/market checks (15 unique); four Node files pass across final
runs (vending-only selection in goods), final bundle/parse checks green.
Old native baseline plus8 independent placement/orientation/stock/index/model/
access-policy/customer-space defects fail assertions in9 routed probes. The
two new physical scenarios exercise an actual preferred PHARMACY doorway and
a pre-existing post in the customer standing area; neither disables people or
structure geometry to satisfy the oracle. Complete entrance-policy loss
removes both body and standing-space checks, since either can reject default
candidate doors. Existing models/stock remain unchanged; source mutations are
isolated in routed ignored bundles, never swapped into source. Visual review
and ABAB remain, then commit/push/PR/reviewed merge and remaining passes5/6/9.
No parallel Codex session is active (agent listing contains only root).

Native machine final review: all15 unique browser checks/four Node files
(including vending-only goods selection) and final bundle checks pass. Nine
routed old/independent defect probes fail assertions; no active mutants.
Sixteen paired clear close/wide/oblique/night/old-site/rotated/far-wall/context
views reviewed. Stress cases reset only later kerbs to match their actual
pre-generation placement phase; all building geometry/people remain.
ABAB177x66 main→after: wall-wide6.5–6.7→7.5–7.8ms,
close7.3–7.7→8.3, oblique6.9–7.0→7.4, old floating site6.0→5.8,
rotated wall6.3–6.5→6.5–7.1. New visible machines/stock cost0.4–1.1ms
in these views; different scene contents, no general speedup claim.
#277 full CI green40453292812. Ready commit/push/PR/merge, then resume
remaining home pass5 (Belle French-door finish/outside furnishing fidelity),
pass6 hotel/motel quality/verify existing door policy, and pass9 civic work.
No second Codex session. Preserve all held Claude sources/unpublished lettering.

#278 native machine wall/backing/access fix merged as5b1477c. Codex active
`codex/home-french-doors` from latest main, READ-ONLY audit starting. All newly
reported fixes and ferry/el item use are merged; #277 full CI green, #278 CI
pending. Resume pass5: inspect the Belle French-door opening/painted leaves,
wall thickness and actual room/city balcony mapping before choosing changes.
Likely ownership new home French-door builder, its Belle-only room/painter
hooks and home-balcony.js display integration, focused home door coverage and
shared manifest/bundle/notes. Preserve movement/E/return, saved room/balcony
boundaries, real window views, existing rail model and outside furniture.
Do not change shared home/hotel helpers restaurants/shops call without prior
agreement, or held bathroom-quality.js/DINER/world-bootstrap/facade/global
lettering/private Claude work. Keep pure inspections separate from runtime
changes until the opening audit is concrete. No source mutants or second
Codex session. Then finish remaining pass5 and proceed6/9.

French-door checkpoint: #278 full CI GREEN40456193159. Belle has one measured
3m opening with closed depth reveals/infill, inner/outer casing and permanent
open clear-light leaves, fitted lower panels, hinges and lever hardware. The
same cached core draws at metre/city scales; native mass stays native. City
recess replaces the painted shut doors, its centre now aligns with native12.5
instead of12.0. Flush stone threshold is part of the existing floor painter,
not an overlapping slab. Leaf colliders include glass and participate outside
although their centres lie inside native x20; no full-opening blocker. Four
focused checks passed before final glazing-bar junction cleanup; inherited
balcony/passage/entry/window checks currently running. Native renderer's third
prop argument was initially mistaken for scale; a wrapper fixes it, and actual
visibility coverage verifies both native draw paths. Sources never swapped;
negative probes, final visual review and ABAB remain before PR/merge. This is
the only active Codex chunk. Next remaining pass5, then6/9.

French-door final:17 unique browser checks pass (four focused plus thirteen
rail/passage/entrance/window controls), and three Node bundle/parse/furnishing
files pass. Old baseline and eight independent missing/native-render/city-
scale/infill/glass-collision/outdoor-collision/centre/cache/city-draw defects
fail assertions in nine routed probes; no source or saved bundle swaps.
Reviewed26 screenshots in13 before/after pairs: clear room/city close/wide/
oblique/night, reverse approach, hinges, head and flush threshold. Clear panes
retain the live native neighbourhood; the reverse city opening is a cheap dark
recess, not an additional full interior render. ABAB177x66,60 warm/120 samples:
room wide1.9->2.2-2.3ms, close2.4-2.5->3.0-3.1, oblique2.5-2.6->3.0-3.1;
city wide5.8-5.9->6.0-6.2, close5.0->5.3-5.5, oblique6.2->6.5-6.6. Added
finished geometry costs about0.2-0.7ms here; no speedup claim. All review
cameras are clear and no page errors. Ready commit/push/PR/reviewed merge.
Next outside balcony furniture fidelity, then remaining pass5 and6/9. Reserved
Claude files, shared home/hotel helpers and home bathroom defaults unchanged.

#279 French doors merged as2ef5247; monitor CI on a25bb218. Codex active
`codex/home-balcony-furniture` from that main. READ-ONLY audit first: the
native Belle table/chairs have no outdoor far shade or scaled draw path, so
the city balcony may omit them entirely, rather than merely simplifying them.
Own new home-only balcony furniture module, Belle-only set hook in rooms.js,
scaled model integration in home-balcony.js, focused furniture coverage and
shared manifest/bundle/notes. Retain set positions/footprints/seats, access,
existing plants, rails, French doorway and saved room/world mapping. Do not
modify shared furniture/home/hotel helpers used by shops or restaurants; use
existing helpers unchanged or build a home-only cached model. Next remaining
pass5 closing audit, then hotel/motel6 and civic9. Reserved Claude sources and
unpublished lettering remain untouched; no source swaps or second session.

Bistro checkpoint after usage pause:20 focused/inherited browser checks and
three Node bundle/parse/furnishing files pass. Native and outdoor views now
share the cached home-only set, including supported slats and curved backs.
Existing positions/footprints/seat heights are retained. Audit also found C
could not use the seats after the real roof-mode transition; homeBalconySeat
and one nearSeat hook in moves.js now expose the two real chairs, with actual
C sit/stand, restored clear approach, table-facing direction and eye height
verified at both scales. Earlier wide/night review cameras intersected the
unchanged palm; move them0.5m along the clear deck before final views/timing.
Mutation, final visual and ABAB remain; not ready for PR yet. Preserve this
work in a local checkpoint commit while isolated world-contract CI repair is
reviewed/merged, then fold latest main back in and finish this chunk. No
shared furniture/helper edits, no production source mutants, no second copy.

Codex CI repair `codex/home-doorway-world-contract` in isolated worktree
/workspace/emergent-toys-door-contract from2ef5247. #279 all four browser
shards pass, but Node's real Belle balcony test fails because pure property.js
now requires DOM-backed ROOM_DEFS. Move the shared opening measurements into
the earlier property layer, consume them in homePlan and the facade, retain
all dimensions/geometry. Strengthen existing pure-world test's no-room/centre
contract. Preserve the unfinished bistro branch/working tree in the primary
workspace; its20 focused/inherited browser checks and three Node files pass,
with final mutation/visual/timing work pending. This is a separate immediate
main CI repair, not a duplicate furniture chunk. No source swapping or held
Claude work. Resume bistro after reviewed repair merge.

World-contract final: original pure loader reproduces ReferenceError ROOM_DEFS
without changing files; corrected standalone balcony test and full landmarks,
bundle freshness and parse files pass. Four French doorway browser checks pass
against the isolated repair bundle. All13 room/city close/wide/oblique/night/
head/threshold/hinge/reverse before-after frame hashes are identical, all
cameras clear, no page errors; inspected oblique/night views match the prior
review. ABAB177x66 room-wide2.3->2.2ms, city-wide6.1->6.2-6.4, with identical
scene contents and no extra model/pass; this is host variation, no speedup
claim. Source-only change is data ownership, no dimensions or geometry moved.
Ready PR/reviewed merge, then merge main into preserved bistro checkpoint and
finish its pending probes/visuals/ABAB. Follow full Node CI on the repair.

#280 world-contract repair merged as0b91335 and folded into the preserved
bistro checkpoint. Both branches' complete append-only notes are retained;
bundle rebuilt from the combined sources. Resume only the existing bistro
chunk: final negative probes, corrected-camera views and ABAB against latest
main0b91335, then reviewed PR/merge. Follow CI on08248a60 (#280); #279's only
failure was the now-repaired pure-world contract. No production mutants or
concurrent render benchmarks.

Bistro final-check checkpoint:20 unique browser checks pass across final runs,
including the final four focused geometry/render/C/thin-metal checks after
merging #280. Four Node landmarks/bundle/parse/furnishing files and final
bundle/parse repeat pass. Twelve original isolated probes plus a final
coplanar-seat-pan defect fail intended assertions (13 unique; unsupported
seat repeated after inset fix). The independent drawn-back/facing check caught
a reversed v-axis basis; corrected before final review. Seat pan now meets
the inner frame edge instead of overlapping its top, with a matching rendered
surface check. Sources never swapped. Final corrected-camera visual/ABAB run
currently active; no other render load. #280 full Node CI green and browser
shard4 green, other three pending. Then final notes/commit/push/PR/reviewed
merge, next pass5 closing audit (include the noisy external balcony deck
material), then6/9. Do not claim the whole home pass complete yet.

Bistro final review complete:21 unique browser checks pass across final runs
(five focused plus16 inherited balcony/French-door/home-layout controls), four
Node landmarks/bundle/parse/furnishing files and final bundle checks pass.
Old baseline plus13 independent rendering/scale/foot/support/arch/orientation/
cache/resolution/seat-reach/hook/footprint/coplanarity/material defects fail
assertions in14 unique routed probes. No source/bundle swaps. A role-coloured
raster diagnostic confirmed remaining seat mottling came from unresolved
rounded-edge light, not holes; cached subcell light filtering keeps the top
calm, restores rounded lighting nearby and preserves underside lighting.
Final24 screenshots in12 before/after pairs reviewed: room/city close/wide/
oblique/night/feet/back. All corrected cameras clear, no page errors. ABAB
177x66,60 warm/120 samples main0b91335->after: room-wide3.5->3.3-3.4ms,
close3.4-3.5->2.9-3.0, oblique4.6->4.4; city-wide7.4-7.5->8.1,
close6.6-6.7->7.6, oblique9.7-9.9->10.8. Added visible outdoor set costs
0.6-1.1ms; native set is cheaper here, no broad FPS gain claimed. #280 full
Node and all4 browser CI shards GREEN40499058549. Ready final commit/push/PR/
reviewed merge. Next pass5 closing audit, beginning with the noisy outside
balcony deck material; then remaining home finish and passes6/9. Reserved
Claude sources/shared helpers, existing private bathroom policy remain intact.
