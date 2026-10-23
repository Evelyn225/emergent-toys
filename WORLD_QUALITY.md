# ASCII City quality programme

Fix the reported defects first. Then complete the numbered quality passes in order, as small reviewable changes. People and the Cabin Cove prototype are the current visual baseline, not targets for wholesale replacement. New content in the fixes uses the same standard.

## Fixes first

- [x] Aim-aware, unobstructed interaction selection shared by E and its prompt. People and dropped items must remain selectable beside other interactions, including indoors.
- [x] No city traffic, crowd or night bed on islands, including inside the shelter and Fern House.
- [x] World sounds lose volume and high frequencies with distance and pan from their source; fireworks need believable range and propagation delay.
- [x] Shore water advances and recedes across sand; white/pale-blue foam follows the moving edge rather than overlaying transparent stripes on the sea.
- [x] Televisions have an unlit case/bezel and a separate animated screen with recognisable programmes.
- [x] Refit Fern House: attached kitchen units, enclosed bathroom, reachable toilet/bath, coherent partitions, grounded plants and workshop, ceiling-mounted lighting.
- [x] Black lettering on all island information and name signs, smaller boards, readable close/far text. Remove Fern's HOUSE / FALLS sign.
- [x] Match island waymarks to actual visible sights: birds, tide pools, and a physical fire ring at the Fern camp. Keep markers out of access routes.
- [x] Furnish homes: buy/place/rotate/move/store furniture without blocking exits or intersecting walls. Keep existing workshop equipment compatible.
- [x] Individually switchable lamps and a usable record player, with saved state.
- [x] IDEA furniture shop and a plush shark, using proper fitted furniture and product models.
- [x] Framed pictures: an in-game camera/print or local image upload, with bounded local save storage and no external upload requirement.

## Quality bar for each pass

- Shared measurements for connected surfaces, visible geometry and collision; follow [corridor geometry notes](corridor-geometry-notes.md).
- Rounded profiles where appropriate, real thickness, supported fixtures, clean joins, usable clearance and correct orientation. Texture cannot substitute for silhouette.
- Calm materials with filtered small detail; smooth changes with distance, readable signs without repeated letters, and no flickering overlaps.
- Features have visible, audible and persistent results. E prompts describe the actual selected target.
- Review close/wide and oblique browser views, day/night and relevant weather; walk access routes and use real controls.
- Keep terrain/building caches, culling and render cost under review. Measure representative scenes before adopting broadly.

## Subsequent passes

Each unchecked row is a chunk, with its own verification and screenshots. The list covers the whole game, rather than only islands.

1. [ ] Shared furniture: chairs, stools, benches, sofas, beds, tables, shelves, cabinets, wardrobes and counters; unified fitted construction and seating.
2. [ ] Bathrooms: toilets, baths, showers, sinks, mirrors, taps, plumbing, partitions, doors and useful layouts.
3. [ ] Kitchens and dining: cupboards, worktops, appliances, cookware, dishes, food displays, seating and cooking feedback.
4. [ ] Home lighting, electronics and decoration: lamps, switches, TVs, record players, radios, clocks, books, plants, frames and keepsakes.
5. [ ] Standard apartments, lofts and Belle homes: distinct layouts, finished openings, balconies, windows and coherent furnishing sets.
6. [ ] Hotels and motels: rooms, suites, lobbies, reception, bathrooms, service areas and price-appropriate character.
7. [ ] Shop interiors: grocer, deli, hardware, sports, toys, thrift, records, tattoo, florist, pet shop, pharmacy, pawn, jeweller and remaining specialist stores.
8. [ ] Restaurants, cafés and bars: ramen/noodles, diners, regional restaurants, bakery, tea, coffee, karaoke and nightlife.
9. [ ] Civic interiors: hospital, bank, jail, gym, laundry, storage, museum and apartment lobbies.
10. [ ] Leisure interiors: arcade, casino, cinema, club, aquarium, conservatory, aviary and cathedral.
11. [ ] Everyday street objects: bins, hydrants, benches, mailboxes, bollards, drains, grates, utility cabinets, bus shelters and vending machines.
12. [ ] Street lights and utilities: poles, signals, lamps, overhead cables, pipes, meters and service access.
13. [ ] Signs and shopfronts: typography, physical mounts, fascia, windows, shutters, awnings, doors and displays across every district.
14. [ ] Market streets and Shotengai: roofs, supports, lanterns, stalls, baskets, bicycles and connected frontage details.
15. [ ] Building architecture: roofs, masonry, cornices, balconies, stairs, fire escapes, chimneys, rooftop equipment and facade variation.
16. [ ] Roads and ground: kerbs, pavement, crossings, junctions, road markings, patching, slopes, walls, fences and retaining edges.
17. [ ] Bridges: decks, joints, towers, supports, cables, railings, approaches, lighting and snow/water integration.
18. [ ] Parks and vegetation: trees, shrubs, flowers, planters, grass, paths, ponds, picnic props and seasonal material transitions.
19. [ ] Coast and islands: rock, sand, tidal pools, driftwood, camps, skiffs, piers, shelters, landings and water/land joins. Preserve Cabin Cove's completed work.
20. [ ] Water and weather: ocean, inland water, wakes, spray, rain, snow, puddles, shore foam, reflections and waterfall continuity.
21. [ ] Cars and road services: vehicle bodies, cabins, wheels, lamps, glass, dashboards, taxis, emergency vehicles, traffic damage and fuel equipment.
22. [ ] Elevated railway and subway: carriages, seats, doors, poles, bogies, platforms, stairs, rails, supports and station displays.
23. [ ] Ferries and boats: hulls, deck joins, seating, cabin fixtures, railings, boarding, terminals, food counters and visible navigation hardware.
24. [ ] Airport and aircraft: fuselages, cockpits, interiors, wheels, rotors, wings, terminals, hangars, runway furniture and boarding.
25. [ ] Fairground and industrial landmarks: rides, booths, cranes, gantries, warehouses, smokestacks and working moving assemblies.
26. [ ] Landmark exteriors: lighthouse, cathedral, towers, museum, conservatory, aquarium and grand hotels.
27. [ ] Inventory and held objects: food portions/bites, drinks, tools, weapons, fishing gear, curios, electronics and dropped/displayed models.
28. [ ] Wildlife, pets and fish: readable shaped species, habitat, movement and proximity detail; preserve existing people.
29. [ ] Activity feedback: fishing, cooking, workshops, sports, skating, crime, damage, smoke, fire and fireworks.
30. [ ] Soundscape throughout: location-specific ambience, distance, occlusion, indoor transitions, machines, music and activity feedback.
31. [ ] Presentation and controls: inventory/shop previews, map, placement controls, interaction prompts, touch accessibility and scaling.
32. [ ] Final integration tour: all districts, all interiors, every island and vehicle; saves, interactions, seasonal scenes and measured city/coast/interior performance.

## Checkpoint

The reported-fix batch is implemented and reviewed in Chromium, including shoreline wash/backwash, Fern kitchen/bathroom/living room, IDEA, placed furniture, night lighting, and the 390px phone menu. Regression coverage includes actual E/Q/F controls, photograph save/reload, packed lamp state, workshop refresh, legacy save migration, reachable island sights, and shared tide-pool collision heights.

At home, F opens furnishings; Q unpacks a held purchase, Q rotates during placement, E places, and Esc cancels. Lamps and frames use aimed E. The compact camera captures the view with Q; the album holds eight local photographs. Each home supports 48 movable furnishings. Plush sharks can go on the floor or supported tables. IDEA occupies one existing open hardware-store location and is searchable by name.

The numbered passes above remain the work queue. The new models establish reusable rounded geometry and filtered materials, but no broad category is marked complete merely because these foundations exist.


## Completed chunks

- Reported fixes and home furnishing foundation: [PR #135](https://github.com/Evelyn225/emergent-toys/pull/135). Botanical-garden birds replace city beds on islands; new home furniture, photos, lamps and records are usable and persistent.
- Shared furniture, first chunk: dining chairs, four-leg tables and upholstered sofas now have rounded solids, connected rails/legs, separate cushions and filtered materials. The shared helpers reach existing apartments, hotels, cafés and other callers. Standard home sofas now use the shared builder. Reviewed front, back, oblique and studio views; existing seating and hotel controls are covered by browser regressions. Beds, shelves, wardrobes, counters, stools and benches remain in pass 1.
- Shared furniture, second chunk: fitted beds, wardrobes, workshop cupboards, TV stands, bedside units and open book/display shelves in all four homes and three hotel tiers now use shared rounded construction. Beds have joined timber frames/headboards, separate mattresses, shaped pillows and tucked bedding aligned with the head. Cabinet doors, drawers and handles face their approach; shelf tops retain the existing display height. Corrected overlapping hotel bedside units and small Belle/motel TV-base wall intersections. Reviewed before/after front and oblique bedroom/storage views, including Fern at night. Wall/cabinet/bed clearance checks cover all seven plans; existing sleep, amenity and workshop routes remain usable. Warmed local median render times at 177×66 cells: studio 3.9→6.8 ms, loft 4.3→5.4 ms, Fern bedroom 5.2→5.4 ms, suite bedroom 3.7→5.3 ms; these are local observations. Counters, stools and benches remain in pass 1.
- Hotel smoke-test timing follows the actual sleep and fade transitions instead of assuming the animation finishes within fixed wall-clock waits on a busy browser runner.
- Shared furniture, third chunk: shared service counters have fitted panels, a thick rounded worktop and a separate cash register whose keys/display face the keeper. Tall stools use shaped padded seats, turned metal bases and solid rounded footrest rings; low stools have open legs and joined supports. Backless and backed benches use rounded slats and connected supports indoors and outside, with their seat tops matching the sitting height. Existing street-bench pads remain flat; the renderer also accepts their terrain height explicitly. Preserved low-stool footprint orientation after the walking sweep caught narrowed gaps in the dumpling shop. Reviewed close/front/oblique views, bar/pho/laundry/hospital/street settings and 390px day/night touch seating. All shop routes, seats, service purchases, work shifts, indoor conversations, hospital exits and laundry checks pass. Warmed local medians at 177×66 cells: bar 3.9→6.2 ms, pho 4.3→4.7 ms, hospital 4.1→5.2 ms; the street sample was 13.0→11.4 ms with noisy tails. These are local observations. Booths, shell chairs, round/pedestal tables and pouffes remain in pass 1; specialist built-ins also receive their own interior passes.
- Interaction follow-up: line of sight derives eye height from the current player state, so a room entered before the next render uses indoor metres immediately. Grand Hotel check-in exercises that transition.

- Interaction integration checks: transparent counter grilles preserve sight; seated head height and jail cab-driver conversations remain selectable; the VIP host keeps the service action; ceiling lamps require a deliberate aim. Shop reachability checks now choose a visible counter approach. Casino staking tests isolate games from patrons and aim at equipment, while person selection has separate coverage. Camera and flatpack art use visible glyphs, including at the hand grip.
- Indoor audio uses the building's actual outdoor location for both nature ambience and sirens. Real Web Audio checks confirm mainland sirens stay silent in an island interior, nearby sources play, moving inside does not change the outdoor source location, and changing buildings clears distant voices.
- Soundscape (pass 30), chunk 1, activity feedback: car explosions, burning aircraft and abandoned-aircraft crashes/ditchings now use the shared distance profile (`worldClip` in `audio.js`): later, quieter and duller with distance, panned, muffled indoors, with a smooth edge instead of a hard 300/400 m cut-off. They previously measured distance from `px,py`, which are furniture coordinates indoors, so a blast on the mainland could play at full volume inside an island shelter. `audioWorldPosition` is now the only listener position: subway stations reached by train, train cars and the lighthouse lamp room also listen from outdoors, and the rotor loop uses it instead of its own copy. Island nature beds and existing distance behaviour are unchanged. Node: sound-distance test covers the new room kinds. Chromium: 27 aircraft/siren/gameplay/transit audio checks, including a new explosion test (near, 300 m delayed/dulled, other-island silent, beside-the-shelter muffled).
- Soundscape (pass 30), chunk 2, music: every recorded bed now runs through its own stereo panner. A playing record player pans toward where it stands in the home (centred as you stand over it, distance gain unchanged), and Nico's rooftop serenade pans toward the bar roof. Your own boombox and every room/district bed stay centred. Chromium: record pan flips with facing in the real furnishing flow; actual bed panners follow the record, the serenade and the boombox (13 furnishing/siren/gameplay audio checks).
- Soundscape (pass 30), chunk 3, machines: laundromats, whose walls of drums are all drawn turning, now have a synthesised washer layer (tumbling thud, slosh, motor hum) over the existing fluorescent hum, calibrated to the recorded beds by measured RMS (CAL 1.0 at gain 1). "Your machine clunks to a stop" now plays a last heavy turn and the door lock clicking free, once, only if you're in that laundromat. Node: the mix runs washers only in laundromats. Chromium: real entry and E to start a wash, layer audible inside and silent after leaving, one finish clunk (11 audio checks). No subjective listening claim.
