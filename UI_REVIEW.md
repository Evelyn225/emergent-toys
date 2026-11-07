# UI review

Keep Glyphport's pixel font, straight edges, restrained colour and ASCII game art. Improve hierarchy, legibility and use of space across desktop, controller and touch. Preserve existing actions, prices, saves and minigame rules. Changes are made in `city/*.js`, followed by the canonical rebuild. Each chunk needs native browser evidence, failing-before checks and real control coverage.

## Review findings

- Shared menus: descriptions and section names are too dim; desktop rows are cramped; focus is mainly a small caret. Disabled rows make prices hard to read. Some specialist panels use unrelated spacing and colours.
- Map: search/tools and directory compete for space; centring uses the whole canvas rather than the clear map area. Phone filters are tiny. Repeated shop labels and markers need clearer hierarchy. Search, categories, destination details and a route should read as one flow.
- Minigames: titles, instructions, status and rewards inherit the tiny playfield font. On phones there is a large empty area and very small game text. Results need clear outcomes and accessible replay/leave actions. Keep each game's identity and mechanics.

## Chunks

1. [x] Shared menus: readable contrast, section hierarchy, comfortable rows, obvious focus, legible disabled prices; pause, inventory, shops, storage and reward controls.
2. [ ] Map: coherent directory/search/tools, larger touch targets, clear available viewport, centring/fit/zoom/picking agreement, readable categories and selected route.
3. [ ] Minigames: readable common title/status/result layout, responsive playfield and controls; arcade, shifts, casino, mahjong, crime, cooking, workshop and boxing.
4. [ ] Specialist panels: cooking, workshop/supplier, courier, furnishings/photos, stadium, fishing competition, arrests and controller sheets; retain their useful details and interactions.
5. [ ] Integration: keyboard/controller/touch, desktop/phone/landscape, long names and empty/full/disabled states, real purchases/results/routes, visual review and measured UI cost.

## Evidence

Initial native survey: pause, inventory, shop, storage, prizes, controls, map, Snake, Blackjack and Mahjong at1170×800,390×844,320×568 and844×390. No page errors. Screenshots and measurements are local review artifacts under `work/ui-review-*`.

- Shared-menu foundation: opaque ink panel, ruled mint headings, descriptions/hints above4.5:1 contrast, 36 px desktop rows, filled keyboard focus with an inset marker, and readable disabled prices. W95 and existing actions remain. All three new checks fail on exact parent87f4fa2; all eight existing inventory/preview/phone controls pass. Native desktop/phone/small-phone/landscape views reviewed. Quiet serial main dfdcca1 / parent87f4fa2 / current, repeated: world render7.4/7.2 |7.2/7.6 |7.1/7.9 ms at177×66; warmed pause construction/layout3.5/2.0 |2.1/2.2 |2.0/2.0 ms; inventory2.8/1.6 |3.0/3.2 |1.8/2.6; shop.8/.5 |1.1/1.0 |1.2/.9. These are local observations, not an FPS guarantee; previews make the main/parent inventory construction different. No per-frame menu work added. Four isolated low-contrast/row-spacing/focus/disabled-price mutations fail their intended browser checks.
