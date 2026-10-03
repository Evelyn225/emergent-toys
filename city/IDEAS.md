# ASCII City: ideas for later

A wishlist of districts and buildings to look over. Nothing here is promised; pick what sounds fun.
Things get crossed off (deleted) once they're in the game.

## New districts

### Little Italy / the Market Streets
- An open-air market some mornings: stalls go up at 6am and pack away by noon, so the streets look different by hour.
- Buildings: pizzeria (slice-tossing shift), butcher, cheese shop, an old social club with a back-room card game at night.
- Hook: market stalls are easy to shoplift, but you get chased on foot through crowded aisles.

### Theater District
- Marquees covered in chasing lights; scrolling ASCII signs with show titles that change weekly.
- Buildings: theaters (buy a ticket, sit in the dark, watch an ASCII play), a stage door for autographs after a show,
  costume shop, late-night piano bar.
- Hook: a stagehand shift (pull ropes on cue, a rhythm game), and crowds pouring out at 10:30pm: prime pickpocket time.

### University Hill
- Campus quad, ivy on brick, a clock tower that chimes the hour.
- Buildings: library (quiet zone: you get shushed for running), lecture hall to sneak into, cheap noodle place, dorms,
  observatory.
- Hook: tutoring gigs as tasks; on clear nights the observatory telescope shows an ASCII moon and stars.

### The Strip / Neon Row
- The rowdiest part of town: strip-mall casinos, pawn shops, 24hr everything.
- Buildings: casino (slots, blackjack, maybe borrow from poker-palace), wedding chapel, bail bonds, all-night diner, a
  motel with a flickering sign.
- Hook: gambling loses money fast; bail bonds gets you out of jail early for a fee.

### Old Town / Cobblestones
- Crooked lanes that break the grid, gas lamps, the oldest buildings in the city.
- Buildings: antique shop (weird one-off items), clockmaker, haunted inn, a fortune teller.
- Hook: the fortune teller hints at something that actually happens later that day.

### Suburbs / the Edge of Town
- Low houses, lawns, sprinklers, a cul-de-sac, a strip mall with a big parking lot.
- Buildings: big-box store, bowling alley, mini golf, a drive-in movie (watch from your own car), gas station.
- Hook: a reason to own a car. A third home tier with a yard and garage.

### Airport / Rail Yard
- Runway lights, planes overhead, a grand central station with a departures board.
- Buildings: terminal with duty-free, baggage claim (lost bag task), the station concourse, a freight yard.
- Hook: a baggage handler shift; a "leave the city" ending or fast-travel loop.

### Fishing Village (another island)
- Reached by ferry from the waterfront: the ferry is a ride like the el.
- Buildings: fish market, bait shop, net shed, seafood shack, a chapel on a cliff.
- Hook: fishing off the pier and selling the catch; storms cancel the ferry and strand you overnight.

### Underground / Abandoned Subway
- A closed ghost station behind a broken grate.
- Buildings: graffiti hall, a tunnel market, a speakeasy, an illegal fight ring.
- Hook: pitch dark without a flashlight item; a good place to hide while wanted.

### What makes a district feel like its own place
The levers the engine already has, so a new district can pull every one of them:
- **Facades**: its own building style (a new STY in city-render.js): shape of windows, colours, what's on the ground floor.
- **Block layout**: lot shapes and heights (BUILD in world.js), or something that breaks the grid entirely.
- **Street furniture**: its own lamps, signs strung across the street, trees, stalls (props.js).
- **Shop signs**: its own word list (DIST_WORDS) and opening hours.
- **Sound**: its own ambience bed and music (audio-mix.js).
- **People**: what they say (talk.js DISTRICT_LINES), how they dress, how many are about and when.
- **One signature building** with a real interior, and **one thing to do** there you can't do anywhere else.

## More district concepts, with flavour first

### The Canals (a little Venice / Amsterdam)
- Some streets are water: canals with stone edges, humpbacked footbridges, houseboats moored along them, lamps
  reflected wobbling in the water at night.
- Tall narrow gabled houses leaning together, flower boxes, bikes chained to railings.
- Water taxis instead of cabs (a boat ride like the el); a canal-side cafe terrace; a floating flower market.
- Signature: a glass-roofed covered market hall over the water. Thing to do: pole a boat yourself.
- Sound: lapping water, bicycle bells, an accordion. Engine: water rendering exists already; canals are new road kinds.

### Shotengai / Little Tokyo
- Covered shopping arcades: a roof over the street hung with paper banners and lanterns, the light under it warm
  even when it rains outside.
- Vending machines every few metres, tiny bars with noren curtains, a pachinko parlour roaring with light.
- Signature: a capsule hotel (sleep in a pod) or a sento bathhouse. Thing to do: a crane game that pays prizes,
  pachinko, a ramen counter with a slurp minigame.
- Sound: arcade jingles, shop greetings, the rattle of pachinko. Engine: the covered street is a new roof-over-road
  prop; vending machines and lanterns exist.

### The Arts Quarter (old warehouses gone creative)
- Every blank wall is a mural: procedural ASCII graffiti that's different on every building, tags, paste-ups.
- Food trucks instead of carts, fairy lights strung over a yard, street performers (a juggler, a sax player you can
  tip, a living statue).
- Signature: a gallery whose paintings are generated art (it could borrow from the other toys on the site), and a
  print studio. Thing to do: paint your own mural on a wall that stays there (saved).
- Sound: a busker, a DJ in a yard, chatter. Engine: murals are facade art; buskers are people with a spot.

### Civic Centre (City Hall and the marble quarter)
- Wide boulevards, marble and columns, a domed City Hall, statues on plinths, a big fountain plaza with pigeons.
- Signature: City Hall interior (rotunda under the dome, a mayor's office), the courthouse (go to court instead of
  paying a fine), the museum (with a heist).
- Thing to do: feed pigeons that flock, a protest or parade some days, pay off your record.
- Sound: fountains, pigeons, footsteps echoing on marble.

### The Night Market (a district that comes alive after dark)
- Quiet car parks and shuttered shops by day; at dusk stalls roll out, strings of bulbs go up, smoke rises off grills.
- Dozens of food stalls with things you can't get elsewhere, games (balloon darts, goldfish scooping), a fortune teller.
- Signature: it exists only at night, and it's packed. Thing to do: eat your way down the rows; a stall-cooking shift.
- Sound: sizzling, hawkers calling, music from somewhere. Engine: time-of-day props, like the pier's lights.

### The Greenhouse Quarter / Botanical Gardens
- A park district: winding paths that ignore the grid, a lake with paddle boats, a hedge maze.
- Signature: a giant glass conservatory with a jungle inside (steamy, palms, a waterfall, butterflies) and a desert
  room; a small zoo or an aviary.
- Thing to do: get lost in the maze, rent a paddle boat, find a rare flower for someone's task.
- Sound: birdsong, the waterfall, rain on glass. Engine: the maze and paths are new block kinds.

### Hilltop / the Heights (harder: the world is flat today)
- Rich houses up winding roads, a funicular railway up the hill, a lookout over the whole city at the top.
- Would need terrain height in the raycaster: big but it'd change how the whole city looks.

## Buildings for the districts we have

### Downtown
- Skyscraper observation deck: an elevator ride up, pay-per-look telescopes.
- Stock exchange: buy low, sell high on a moving price line.
- Courthouse: go to court after being busted instead of paying, argue your case in dialogue.
- Museum: ASCII exhibits (dinosaur skeleton, paintings); a night heist as a big crime.
- Newspaper office: the source of the headlines; a paper route by bike.

### Midtown
- Department store: escalators, floors, perfume counter, toy section.
- Radio station: go on air, pick songs; changes what the boombox and the bars play.
- Post office: mail-sorting shift, package delivery tasks.
- Rooftop bar: elevator up, skyline view.

### Chinatown
- Herbalist with a wall of drawers: cures for drunk or tired.
- Lantern festival: weekly, paper lanterns over the streets, a dragon parade in traffic.
- Private karaoke box rooms.
- Bakery: pork buns, egg tarts.

### Docks
- A container yard you can climb.
- Fish auction at 5am.
- Shipyard crane-operator shift (a container stacking game).
- A sketchy warehouse rave, Friday nights only.

### Brownstones
- Stoops to sit on; neighbors who recognize you over time.
- Corner bodega with a cat to pet.
- Community garden: plant something, come back days later to pick it.
- Jazz basement club.

### Waterfront
- Boat rental: putter round the bay.

## Weird and special buildings
- Pay phones: call a number scrawled on a wall, get a strange task.
- A tower with no door: the city's mystery, with clues scattered round town.
- Pawn shop extras: buy back what the police confiscated when you went to jail.
- Photo booth: an ASCII photo of yourself as an item.
- Vet clinic / maternity ward window: small wholesome stops.
- Boxing ring at the gym: a timing-based fight minigame.
- Rooftop pigeon coop: feed them and they follow you for a bit.
- Dive bar pool table: a pool minigame with betting.
- Wax museum: statues that look like the actual townsfolk.

## Bigger city-wide ideas
- Each district gets its own music and ambience (the audio mix system can carry it).
- District reputation: regulars warm to you, or get wary if you commit crimes there.
- A calendar of events: Saturday farmers market, Sunday parade, weekly fireworks over the bay.
- The city changes over time: construction sites finish into new buildings as days pass.

## Sounds to find

What's in `audio/ascii-city/` now: city day and night beds, rain, crowd, restaurant, coffee shop, bossa nova,
karaoke, arcade, crash, eat, drink, lighter and cigarette drags, skateboard, harmonica. Everything else is
synthesised on the fly (sirens, beeps, the organ notes at the candles) and would sound better as a real recording.
Loops want to be seamless, 30s to a couple of minutes; one-shots short and dry. Free sources: freesound.org (check
the licence on each), Pixabay sound effects, the BBC sound effects archive (personal use).

### Music and ambience loops
- **Cathedral**: organ music (something slow, Bach-ish), a choir, and a big empty-church room tone with echo.
  Church bells for the hour, and for the top of the bell tower.
- **Pleasure pier**: carnival / calliope music, a carousel band organ (the classic oom-pah waltz), the crowd at a fair,
  seagulls.
- **Aquarium**: underwater ambience, tank bubblers and pump hum, a muffled crowd, maybe a soft ambient pad.
- **Jail**: echoey cell block room tone, distant shouting, a radio, a buzzing fluorescent light.
- **Laundromat**: washers churning, dryers tumbling, a fluorescent hum, late-night radio.
- **Waterfront**: waves on the pier pilings, gulls, a foghorn, the ferry horn.
- **Subway and el**: a train arriving and braking, the doors' chime, a platform announcement, an el going overhead.
- **Districts**: Chinatown street music, the docks' cranes and ship horns, birds in the brownstones' parks.

### One-shots for places and things
- **Fair**: the ring toss ring clinking on a bottle, the high striker's mallet thud and the bell's DING, a prize
  win jingle, the Ferris wheel's creak and its bar clunking shut, a cotton candy machine whirring.
- **Cathedral**: the great doors' heavy creak and boom, a match striking (lighting a candle), footsteps on stone.
- **Aquarium**: splashing hands in the touch pool, a shop door chime.
- **Jail**: the cell door clanging shut, a key in a lock, keys jangling on the guard's belt.
- **Laundromat**: coins in the slot, a washer starting, the end-of-cycle buzzer, the door clunking open.
- **Street**: vending machine thunk and coins, a taxi horn, a car door, a dog barking, a shop door bell, footsteps
  on wood (the pier) and on metal (the el stairs).

### Item sounds
- A soda can cracking open and fizzing, a beer pour, ice in a glass.
- Crunchier bites for chips and apples, a slurp for noodles and pho.
- A newspaper rustle and a book page turning.
- An umbrella opening, rain on the umbrella.
- A yo-yo whirr, sparklers crackling, the rubber duck squeak, the plush shark squeak, a snow globe shake.
- A boombox tape clunking in and play pressed, the skateboard ollie snap.
