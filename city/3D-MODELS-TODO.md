# 3D model pass: what's left

Follow-up to #83 (signals, roof clutter, el columns and stairs, carts, park lamps). Same recipe each time: drop the
camera-facing `drawArt` / `drawShape` billboard and build the thing out of `drawBox` / `rod` / `dot` / `rayCone`
(plus `rayCopperDrum`, `rayBeveledBay` where they fit), with rods for anything thin so it holds at distance.

Left out on purpose: UI markers (`!` over cops and hailers, the `\ /` target arrow), the street lamp's far LOD
(`lampCell` past `LAMP_3D` is already the near-3D / far-billboard split), steam puffs, birds, butterflies, fish.

## Batch 1: street furniture (small, same scale as #83) - done

- [x] **Fair bulb posts** `props.js:289`: the `(*)` posts along the pier edges. Basically `drawParkLamp` with a
      colour-cycling bulb. Easiest one on the list.
- [x] **Night market lanterns** `props.js:276`: `-|-` / `(@)` art on a string. Reuse the chinatown
      `drawLanternString` paper lanterns (already 3D) or a `dot` on a short rod.
- [x] **Velvet rope + brass posts** at the club `stripclub.js:80`: two rods with a `dot` cap, a sagging rope
      between them (same sag idea as `drawLanternString`).
- [x] **Parked bicycles** in the Shotengai `props.js:316`: two wheels (`drawRod` discs like `CART_WHEEL`), a frame
      of rods, a seat box.
- [x] **Bridge hangers and cable lights** `city-sprites.js:1114`: hangers are `|` billboards and the cable is a row
      of `.` / `*` points. Hangers become `rod`s, cable lights become `dot`s (or the whole cable a chain of rods).

## Batch 2: signs (all have the same shape: a panel with `signGlyph` text, like `drawBoard` / the cart name) - done

- [x] **Shotengai banners** `props.js:310`: hanging cloth across the street. Thin box facing along the street,
      word via `signGlyph`, two short hanging cords.
- [x] **Aquarium neon fish sign** `props.js:303`: the `><(( o ))>` over the doors. A flat panel on the facade
      with the fish as neon tube cells, flicker kept.
- [x] **Marina board** `marina.js:134` and the **FOR SALE / RENTAL** boards on boats `marina.js:130`: an easel or
      post-mounted panel. Price list text needs a few rows of `signGlyph`.
- [x] **Boat navigation lights** `marina.js:108`: red/green `o` billboards, should just be `dot`s.

## Batch 3: Gardens

- [ ] **Picnic blankets** `gardens.js:192`: currently a `########` sprite standing up. Should be a flat box on the
      grass (checker on the top face), the basket `gardens.js:200` a small box with a handle rod.
- [ ] **Swan boats** `gardens.js:164`: parked and paddled. A hull box plus a neck rod and a head `dot`; the paddler
      already sits in it as a figure.
- [ ] **Animals** (flamingos, ducks, tortoises, bear, peacock) `gardens.js:155-163`: lower priority, the ASCII art
      is part of the charm. Flamingo (rod legs, body box, neck rod) and tortoise (`rayCopperDrum`-ish shell) are the
      cheap wins if you want any.

## Batch 4: big skyline pieces (drawShape silhouettes, these look flat when you walk around them)

- [ ] **Bridge towers** `city-sprites.js:1110`: currently fake-foreshortened by `across()`. Two legs as boxes,
      cross beams, red beacon `dot` on top.
- [ ] **Smokestacks** `city-sprites.js:160`: a tapering drum (`rayCopperDrum` or a stack of drums) with bands,
      smoke can stay a billboard.
- [ ] **Dockside cranes** `city-sprites.js:156`: lattice mast like `drawRadioTower`, jib as a box that slews for
      real instead of the `across()` hack, hook on a rod.
- [ ] **Lighthouse** `city-sprites.js:918`: drum tower in stripes, lantern room, the beam stays as is.

## Batch 5: the fair rides (biggest, do last)

- [ ] **Ferris wheel** `city-sprites.js:1265`: rim and spokes as rods, gondolas as boxes. Most work on the list.
- [ ] **Carousel** `city-sprites.js:1284`: `rayCopperDrum` base, `rayCone` roof, rod poles, horses can stay sprites.

## Later / maybe: street trees

- [ ] **Trees** `city-sprites.js:51` (`drawTree` / `treeCell`, plus winter branches). Every street has them, so
      they matter most visually, but a canopy that reads well in 3D (cluster of spheres via `dot`, trunk `rod`) is
      a perf question. Worth a test on one street before committing.

## Interiors (separate pass)

Rooms (`rooms.js`, `grand-hotel.js`, `shotengai.js`, `home-balcony.js`) still use `SP(...)` art sprites from `ART`:
stools, plants, jukebox, barber chair and pole, treadmill, weight rack, speakers, cages, the home cat and dog.
These are a different scale (metres, not cells) and you're always close, so they'd need their own batch.
