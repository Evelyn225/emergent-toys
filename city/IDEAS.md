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

### The Night Market (a district that comes alive after dark)
- Quiet car parks and shuttered shops by day; at dusk stalls roll out, strings of bulbs go up, smoke rises off grills.
- Dozens of food stalls with things you can't get elsewhere, games (balloon darts, goldfish scooping), a fortune teller.
- Signature: it exists only at night, and it's packed. Thing to do: eat your way down the rows; a stall-cooking shift.
- Sound: sizzling, hawkers calling, music from somewhere. Engine: time-of-day props, like the pier's lights.

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

## The museum, and how the heist could work

**The museum by day**: a grand building downtown (columns, a dome, banners for the current show). $10 in. Halls
of exhibits drawn in ASCII: a dinosaur skeleton you walk under, Egyptian room with a sarcophagus, a gallery of
paintings (generated art, so it's different every visit), a gem room with the city's famous diamond under glass.
Guards on patrol routes, cameras on the walls, a gift shop.

**The heist, step by step** (a few evenings' work, not one button):
1. **Case the joint.** Visit by day. Each guard walks a fixed loop; watching tells you the timing. Cameras sweep a
   cone; you can see it on the floor. The game remembers what you've seen and draws it on a floor plan in your bag.
2. **Get the tools.** A lockpick (have one: the lock minigame), a crowbar from the hardware store, a disguise
   (a guard uniform from a laundromat dryer, or a hard hat), and a getaway car (owned or stolen) parked nearby.
3. **Get in after dark.** Pick the back door lock, or climb the fire escape to the roof skylight.
4. **Inside: stealth.** It's dark; guards carry torches (a cone of light). Stay out of their cones and the cameras'.
   If one sees you: a few seconds of "huh?" to get out of sight, then alarms and four stars.
5. **The vault.** The diamond's case: a harder lock minigame on a timer, or cut the glass (hold still, a meter
   that wobbles if a guard's near).
6. **Get out and away.** Back the way you came, to the car, lose the police. Then fence the diamond at the pawn
   shop (a big payout) or keep it at home in your closet as a trophy.
- Smaller crimes on the way could be optional shortcuts: pickpocket a guard's keycard, cut the power at a box in
  the alley (the cameras go dark for a minute).
- The engine already has: rooms with props, people with paths, the lock and pickpocket minigames, wanted stars,
  owned cars. New: guards that see in a cone, darkness with torch light, and the plan on paper.

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

## New ideas since last time
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
- **A piss button**: goes with hunger and thirst. A bladder meter that fills as you drink (beer fastest), toilets
  in bars, diners, the jail cell and home; or go in an alley, which is public urination if a cop sees.

## Sounds to find

What's in `audio/ascii-city/` now: city day and night beds, rain, crowd, restaurant, coffee shop, bossa nova,
karaoke, arcade, crash, eat, drink, lighter and cigarette drags, skateboard, harmonica. Everything else is
synthesised on the fly (sirens, beeps, the organ notes at the candles) and would sound better as a real recording.
Loops want to be seamless, 30s to a couple of minutes; one-shots short and dry. Free sources: freesound.org (check
the licence on each), Pixabay sound effects, the BBC sound effects archive (personal use).

### Music and ambience loops
- **Cathedral**: organ music (something slow, Bach-ish), a choir, and a big empty-church room tone with echo.
  Church bells for the hour, and for the top of the bell tower.
- **Shotengai**: pachinko parlour roar (thousands of steel balls, jingles), shop greetings shouted from doorways,
  a crane game's tune, the hum under the roof, rain drumming on it.
- **Fireworks**: real bursts and crackles (it synthesises a thud now), the crowd going "ooh".
- **Sunset Pier**: carnival / calliope music, a carousel band organ (the classic oom-pah waltz), the crowd at a fair,
  seagulls.
- **Aquarium**: underwater ambience, tank bubblers and pump hum, a muffled crowd, maybe a soft ambient pad.
- **Jail**: echoey cell block room tone, distant shouting, a radio, a buzzing fluorescent light.
- **Botanical Gardens**: birdsong (the lawns by day), ducks quacking, the conservatory's waterfall and its
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
- **Street**: vending machine thunk and coins, a taxi horn, a car door, a dog barking, a shop door bell, footsteps
  on wood (the pier) and on metal (the el stairs).

### Item sounds
- A soda can cracking open and fizzing, a beer pour, ice in a glass.
- Crunchier bites for chips and apples, a slurp for noodles and pho.
- A newspaper rustle and a book page turning.
- An umbrella opening, rain on the umbrella.
- A yo-yo whirr, sparklers crackling, the rubber duck squeak, the plush shark squeak, a snow globe shake.
- A boombox tape clunking in and play pressed, the skateboard ollie snap.
