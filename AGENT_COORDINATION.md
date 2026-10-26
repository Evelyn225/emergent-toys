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
- **Claude pass 12, facade utilities:** `claude/facade-utilities` from main (new
  `city/facade-utilities.js` after `world-bootstrap.js`, reading `ARCH_BUILDINGS`
  faces and street geometry; one draw hook in `city/city-sprites.js`). Next:
  pavement service hatches and overhead cables.
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
