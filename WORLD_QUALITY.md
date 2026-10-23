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
