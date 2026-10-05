# Glyphport: ideas for later

A wishlist of districts and buildings to look over. Nothing here is promised; pick what sounds fun.
Things get crossed off (deleted) once they're in the game.

## Next up: the picks
The ones that would add the most for the least, roughly in order. Each builds on something already in the game.
1. **The Relics** (below, in Bigger city-wide ideas): the watch and the globe become two of a set, and collecting
   them all opens the tower with no door. A reason to do everything else.
2. **Rooftop runs**: roof hopping is in; time trials across the rooftops, a courier job that only pays if you
   never touch the street.
3. **A bike**: rent, park, steal; between walking and a car, and it fits down alleys.
4. **Museum extras**: the heist is in (pick the door, dodge the torch beams, crack a case, beat the silent alarm);
   next: the plan on paper, a guard's keycard to pickpocket, the power box in the alley, a rotating special exhibit.
5. **Seasons, more of them**: seasons and snow are in; next, what changes with them: snowmen, a summer heatwave
   that packs the pier, the shops' stock by season, fewer people out in a blizzard.

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
- Buildings: (the casino's in, downtown) a poker room (borrow from poker-palace), wedding chapel, bail bonds,
  all-night diner, a motel with a flickering sign.
- Hook: bail bonds gets you out of jail early for a fee.

### Old Town / Cobblestones
- Crooked lanes that break the grid, gas lamps, the oldest buildings in the city.
- Buildings: antique shop (weird one-off items), clockmaker, haunted inn, a fortune teller.
- Hook: the fortune teller hints at something that actually happens later that day (like the fortune cookie's
  stock tip, but for anything: a gold duck in the pond, a storm, a shop's sale).

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
- Hook: pitch dark without a light (the paper lantern from the night market would do); a good place to hide while
  wanted.

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

### The Arts Quarter (old warehouses gone creative)
- Murals are on every blank wall here (the city has a few already, and you can spray tags): denser, bigger pieces,
  paste-ups, stencils, a hall of fame wall the writers repaint every week.
- Food trucks instead of carts, fairy lights strung over a yard, street performers (a juggler, a sax player you can
  tip, a living statue).
- Signature: a gallery whose paintings are generated art (it could borrow from the other toys on the site), and a
  print studio. Thing to do: paint a whole mural yourself (pick the colours and the word), not just a tag.
- Sound: a busker, a DJ in a yard, chatter. Engine: murals are facade art; buskers are people with a spot.

### Civic Centre (City Hall and the marble quarter)
- Wide boulevards, marble and columns, a domed City Hall, statues on plinths, a big fountain plaza with pigeons.
- Signature: City Hall interior (rotunda under the dome, a mayor's office), the courthouse (go to court instead of
  paying a fine), the museum (with a heist).
- Thing to do: feed pigeons that flock, a protest or parade some days, pay off your record.
- Sound: fountains, pigeons, footsteps echoing on marble.

### The Night Market: what's left (three stalls are in, on a Chinatown street, 8pm to 2am)
- More rows: grills with smoke rising off them, a stall-cooking shift (fold bao to order), haggling over prices.
- Games: a mahjong table in the street (goldfish scooping and the fortune teller are in).
- A knock-off stall: designer watches and bags for cheap that pawn for nothing (or now and then, for a lot).

### Hilltop / the Heights (harder: the world is flat today)
- Rich houses up winding roads, a funicular railway up the hill, a lookout over the whole city at the top.
- Would need terrain height in the raycaster: big but it'd change how the whole city looks.

## Buildings for the districts we have

### Downtown
- Skyscraper observation deck: an elevator ride up, pay-per-look telescopes.
- Courthouse: go to court after being busted instead of paying, argue your case in dialogue.
- Museum: see the heist plan below.
- Newspaper office: the source of the headlines; a paper route by bike.

### Midtown
- Department store: escalators, floors, perfume counter, toy section.
- Radio station: go on air, pick songs; changes what the boombox and the bars play.
- Post office: mail-sorting shift, package delivery tasks.
- Rooftop bar: elevator up, skyline view.

### Chinatown
- Herbalist with a wall of drawers: cures for drunk or tired (herbal tea and tiger balm are a start).
- Lantern festival: weekly, paper lanterns over the streets, a dragon parade in traffic.
- Private karaoke box rooms.
- Bakery: egg tarts, pineapple buns (the night market has bao).

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

## The museum: what's left (it's in: downtown across from the plaza; the heist works)
- **Case the joint**: the guards' loops drawn on a floor plan in your bag once you've watched them by day.
- **Shortcuts**: pickpocket a guard's keycard (no lock to pick); cut the power at a box in the alley (the beams go
  dark for a minute); the skylight from the roof.
- **A disguise**: a guard's uniform from a laundromat dryer, and the guards nod you through.
- **A special exhibit that changes each week**, and a museum shop restock to match.
- **Fencing**: the pawn shop takes the Glyphport Star at 40%; a proper fence in the docks who pays more and asks less.

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
- More on the calendar (fireworks are in): a Saturday farmers market, a Sunday parade down Broadway, a monthly
  lantern festival in Chinatown, a festival under the Shotengai roof (stalls, goldfish scooping, a portable shrine
  carried down the street), Halloween with trick-or-treaters, snow at New Year. A page in the pause menu showing
  the week ahead.
- The city changes over time: construction sites finish into new buildings as days pass.
- **The Relics**: the cursed pocket watch and the Glyphport snow globe are two of a set of strange objects scattered
  round the city, each bending one rule. Others: a compass that points at whatever you need most (the nearest
  food when you're starving, a hospital when you're hurt, the gold duck); a mirror that shows a cop coming before
  they see you; a key that opens any one door, once. Each turns up somewhere different (a prize counter, a market
  stall, the bottom of the gardens' lake, the bank vault). Carry them all to the tower with no door and it opens.
- **The watch's curse**: make it earn the word. Lean on it too long and odd things happen: a day slips by when you
  only meant an hour, the street lamps flicker as you pass, a figure in a long coat is always a block behind.
- **Collectibles**: fifty rubber ducks hidden round the city (on ledges, in fountains, on roofs), a tally in the
  bag, a prize for every ten.
- **Seasons, further** (they're in: a week each, snow in winter, autumn leaves, spring blossom, frozen ponds, the
  Equinox Orrery from the museum to turn them): snowmen, slush, a summer heatwave, what the shops sell, how many are out.

## New ideas since last time
- **Rooftop runs**: time trials across the roofs with checkpoints, a pizza courier who only gets paid if the box
  never touches the street, a rooftop chase when the cops corner you up there.
- **Needs extras**: cook at home (a fridge and a stove), food going cold if you carry it too long, a food truck
  that turns up where people are hungriest, a vending machine you can shake (and get crushed by).
- **More carnival**: a rollercoaster along the pier (the stock market already mentions one), goldfish scooping,
  whack-a-mole, a big top prize shelf (a giant plush you can't carry without both hands).
- **The stock market and crime**: insider trading (act on a fortune cookie tip once too often and the SEC calls),
  a newspaper whose headlines move the market.
- **People who remember you**: the stallholders, the bouncer, the nurse who's patched you up five times.
- **Photo booth and photo mode**: freeze the frame, hide the HUD, save the ASCII as a text file or an image.
- **Shotengai extras**: a sento bathhouse (soak: sobers you up, warms you through), a gacha machine wall
  (a random capsule toy for $1), a maid cafe, a rhythm game cabinet, the summer festival under the roof.
- **Graffiti extras**: the council's clean-up crew scrubbing tags you've left; your tags slowly fading; other
  writers tagging over yours; a reputation for it (people mention your tag).
- **Rain gear and weather**: puddles you can splash, umbrellas for sale under the Shotengai roof when it pours.
- **Bikes**: rent one, park it, steal one; faster than walking, slower than a car, can go down alleys.
- **A phone**: messages from people you've done favours for, an alarm before an event, a map app.
- **Gardens extras**: a hedge maze (the gardens' south lawn has room), rare flowers for someone's task, a night
  tour or a lantern festival, a koi pond in the conservatory, feeding time at the bear pen, the boats racing.
- **Home extras**: decorate your place with what you carry (put the lucky cat on the shelf), a fridge for food,
  a pet that waits for you.

## Sounds to find

What's in `audio/ascii-city/` now: city day and night beds, rain, crowd, restaurant, coffee shop, bossa nova,
karaoke, arcade, crash, eat, drink, lighter and cigarette drags, skateboard, harmonica. Everything else is
synthesised on the fly (sirens, beeps, the organ notes at the candles) and would sound better as a real recording.
Loops want to be seamless, 30s to a couple of minutes; one-shots short and dry. Free sources: freesound.org (check
the licence on each), Pixabay sound effects, the BBC sound effects archive (personal use).

### Music and ambience loops
- **Cathedral**: a choir and a big empty-church room tone with echo. Church bells for the hour, and for the top of
  the bell tower. (The organ and room-tone loop is in.)
- **Shotengai**: shop greetings shouted from doorways,
  a crane game's tune, the hum under the roof, rain drumming on it.
- **Fireworks**: crackles (the burst recording is in; crackles are still synthesised), the crowd going "ooh".
- **Sunset Pier**: carnival / calliope music, a carousel band organ (the classic oom-pah waltz), the crowd at a fair,
  seagulls.
- **Aquarium**: tank bubblers and pump hum, a muffled crowd, maybe a soft ambient pad. Aquarium music and a low-passed
  waterfall loop for subtle tank water are in.
- **Jail**: echoey cell block room tone, distant shouting, a radio, a buzzing fluorescent light.
- **Botanical Gardens**: ducks quacking, the conservatory's waterfall loop (only audible nearby) and its
  steamy drip, rain on the glass roof, a whole aviary of chatter, the closing bell, oars / pedals splashing.
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
- **Street**: a taxi horn, a car door, a shop door bell, footsteps
  on wood (the pier) and on metal (the el stairs).

### Item sounds
- A beer pour, ice in a glass.
- Crunchier bites for chips and apples, a slurp for noodles and pho.
- A newspaper rustle and a book page turning.
- An umbrella opening, rain on the umbrella.
- A yo-yo whirr, sparklers crackling, the rubber duck squeak, the plush shark squeak, a snow globe shake.
- A boombox tape clunk and skateboard ollie snap are in. The can opening sound is in.
