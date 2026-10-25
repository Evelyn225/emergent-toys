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
- **Claude pass 8 progress:** dim sum live seafood tank, PR #215; sushi
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
