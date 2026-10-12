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

## Batch 3: Gardens - done

- [x] **Picnic blankets** `gardens.js:192`: currently a `########` sprite standing up. Should be a flat box on the
      grass (checker on the top face), the basket `gardens.js:200` a small box with a handle rod.
- [x] **Swan boats** `gardens.js:164`: parked and paddled. A hull box plus a neck rod and a head `dot`; the paddler
      already sits in it as a figure.
- [x] **Animals** (flamingos, ducks, tortoises, bear, peacock): built like the people (`animalLook` /
      `ANIMAL_BODIES` in `figures.js`, drawn with `drawFigure`), solid colour, facing the way they move. The same
      builder could take the aviary birds and the street pigeons later.

## Batch 4: big skyline pieces (drawShape silhouettes, these look flat when you walk around them) - done

- [x] **Bridge towers** `city-sprites.js:1110`: currently fake-foreshortened by `across()`. Two legs as boxes,
      cross beams, red beacon `dot` on top.
- [x] **Smokestacks** `city-sprites.js:160`: a tapering drum (`rayCopperDrum` or a stack of drums) with bands,
      smoke can stay a billboard.
- [x] **Dockside cranes** `city-sprites.js:156`: lattice mast like `drawRadioTower`, jib as a box that slews for
      real instead of the `across()` hack, hook on a rod.
- [x] **Lighthouse** `city-sprites.js:918`: drum tower in stripes, lantern room, the beam stays as is.

## Batch 5: the fair rides (biggest, do last) - done

- [x] **Ferris wheel** `city-sprites.js:1265`: rim and spokes as rods, gondolas as boxes. Most work on the list.
- [x] **Carousel** `city-sprites.js:1284`: `rayCopperDrum` base, `rayCone` roof, rod poles, horses can stay sprites.

## Batch 6: dogs and the ball - done

- [x] **Street dogs** (walkers' dogs) and the **lost dog** task: built like the Gardens animals (`ANIMAL_BODIES.dog`,
      `drawDog` in `figures.js`), trotting, sniffing nose down, tail wagging, in their coat colour with a red collar.
      The lead is a sagging cord of rods.
- [x] **The ball**: a football (`raySphere`, black pentagons and white hexagons that roll with it).
- [x] **Pets at home**: the cat (an orange tabby sitting up, tail round its paws, green eyes, a slow blink) and the
      dog (sitting up, wagging, tongue out), built like the rest; they turn to watch you when you're close. Close-up
      animals are built small and scaled up to fill the sprite (`ANIMAL_SCALE`), so they get more pixels.
- [x] **Pet shop**: wire cages on stands with a kitten and a puppy inside, and the shop dog sitting on the floor.

## Not doing: street trees (they read fine as flat sprites)

- **Trees** `city-sprites.js:51` (`drawTree` / `treeCell`, plus winter branches). Every street has them, so
      they matter most visually, but a canopy that reads well in 3D (cluster of spheres via `dot`, trunk `rod`) is
      a perf question. Worth a test on one street before committing.

## Interiors - mostly done

- [x] Room furniture is a `ROOM_MODEL` prop that draws itself (rooms.js): potted plants, bar stools, the jukebox,
      treadmills, dumbbell racks, the barber's pole and chairs, karaoke speakers, florist bouquets, the train's grab
      poles, the lighthouse's coil of rope, the Grand Hotel's service bell.
- [ ] Still ASCII: the Gardens greenhouses (aviary trees, birds, cacti, the lizard, butterflies), the Grand Hotel's
      two little signs, the club's candle flames and VIP sign.
