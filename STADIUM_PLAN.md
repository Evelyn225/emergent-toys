# Stadium plan: a fully simulated soccer match you pay to watch

A stadium in the city. You buy a ticket, find your seat and watch two teams of eleven play a whole match. The game
is simulated live from the ball, the players and the rules, not played back from a script. Every match is different.
The crowd reacts, the scoreboard keeps time, and results go into a league that carries on between matches. This plan
is a series of PRs, each one playable and tested on its own.

## Is it doable?

Yes, as a medium-to-large feature. Most of what it needs exists:

- **Already there:**
  - A ball with physics (`city/goods.js` `ball`, `drawBall`).
  - Figures drawn from 16 angles with walk and run poses, cached as sprites (`city/figures.js`).
  - Rows of seats you can sit in (the cinema's `seatRow`, `freeOnRow`).
  - Paid entry (`sh.fee`: the museum, the club).
  - Landmark buildings and their facades.
  - Text drawn on surfaces, for the scoreboard (`wallText`).
  - Crowds of people (`people.js`).
- **New, and where the work is:**
  1. **The match AI:** about 1,500 to 2,500 lines. Plausible-looking football (shape, passing, pressing, runs,
     keepers) is a solved problem in games, at the level of positions, scores and simple decisions. Expect early
     versions to look like kids chasing the ball until the team-shape layer (§3.3) is in.
  2. **The stadium:** a large interior with stands, floodlights, and a pitch with its markings.
  3. **Presentation:** crowd reactions, sound, the scoreboard, a TV-style camera and goal replays.
- **Risks:**
  - **Readability:** 22 players at ASCII resolution read fine from the stands if kits are bold colours and the ball
    is drawn bright. The ball is small, so it gets a minimum on-screen size.
  - **Render cost:** 23 to 25 figures at once. The sprite cache handles it. The crowd is painted onto the stands,
    not drawn as figures.
  - **Size:** a full pitch (105 by 68 m) plus stands is about 130 by 100 m, bigger than a city block (80 m). See
    §2.1.

## Progress

- **Phases 1–2 (done, #460):** `city/match-engine.js`, a deterministic headless engine calibrated over hundreds of matches, plus the top-down view in Dev tools > Other.
- **Phase 3 (done, #461):** `city/stadium.js`, the ground's interior.
  - Four stands you can climb and sit in, roofs, floodlights, a scoreboard, advertising boards, goals with nets and a marked pitch.
  - The match is played by figures in kit. V gives the TV view and E leaves.
- **Phase 4 (this PR):**
  - **The building:** the ground in the Yards on two blocks with the street between them removed (`world.js` `STADIUM_SITE`, STY 26). Brick at street level with turnstiles and fixture posters, steel cladding with the name, the pitch visible from above, and four floodlight pylons.
  - **League and tickets:** `city/league.js` runs a double round-robin with fixtures on Wednesday 19:30 and Saturday 15:00. The gates open 90 minutes before kick-off, and tickets are $15 to $40 by section. The match waits for kick-off, the city clock keeps pace with it, and results from the other games come in. The league table is saved.
  - **Directories:** a map entry and a dev-tools entry.
- **Phase 5 (atmosphere, `city/stadium-atmosphere.js`):**
  - **Crowd bed:** the recorded crowd bed follows the match. It murmurs before kick-off and rises with danger.
  - **Event sounds:** synthesised:
    - the referee's pea-whistle trill (one for a foul, two for half time, three for full time)
    - an ooh at shots, groans at misses, applause at saves and substitutions
    - a roar for home goals, a cheer and a groan for away goals, boos for cards against the home side
    - the home end clapping and chanting
  - **Words:** PA and commentary lines for every event, and the score and clock in the top status line.
- **Phase 6 (replays and celebrations):**
  - **Big screen:** a 20 m screen beside the scoreboard shows the match top-down.
  - **Replays:** after every goal, the build-up (from the engine's 8-second buffer) replays at 55% speed. It plays on the big screen (marked REPLAY), and with V on, on TV from a camera low behind that goal.
  - **TV during celebrations:** the camera follows the scorer, not the ball in the net.
  - **Celebrations:** the scorer bursts about 14 m toward the corner fans and is mobbed, arms up. The other side stands with hands on heads.
- **Next:** phase 7 (extras: betting, concessions and scarves, season tickets, cup matches).

## 1. What the player gets

- **Fixtures:** matches on a schedule, for example Saturday 15:00, Wednesday 19:45 under floodlights, and a Sunday
  match. They're listed on a poster outside, on the map and in the newspaper if there is one.
- **Tickets:** bought at the turnstiles. Prices depend on the seat: behind the goal $15, side stand $25, centre $40.
  A season ticket is a later extra.
- **Going in:** turnstiles, a concourse with a food kiosk (hot dog, pie, drink, as existing food items) and a
  scarf seller (a held item in team colours), then up the steps to your block and seat.
- **The match:**
  - 90 minutes of game time compressed to about 12 real minutes by default (a setting from 6 to 30), with half time
    and stoppage time.
  - The scoreboard shows the clock, the score and scorers.
  - The PA announces line-ups, goals and substitutions. A text ticker at the bottom gives commentary.
- **The crowd:** murmurs, gasps at near misses, roars at goals, and boos fouls against the home side. The home end
  sings. Some matches have a Mexican wave.
- **Viewing:** you can sit in your seat (the default), stand, walk the concourse, or press a key for a broadcast
  view that follows the ball side-on from the gantry. Goals get a replay on the big screen and in the broadcast
  view.
- **Afterwards:** the full-time result, the league table on the board and a crowd that files out. The result is
  saved.
- **Optional extras (later phases):** bets at a booth outside (odds from the teams' ratings, paid at full time),
  and a programme item listing the squads.

## 2. The stadium

### 2.1 Where and how big

- **Recommended exterior:** a landmark that takes two adjacent blocks with the street between them removed, about
  160 by 80 m.
  - The bowl is oval, with four floodlight pylons you can see across the city and light up at night.
  - Put it at a district edge with a big plaza in front: industrial or near the docks, away from the coast work.
- **The interior** is its own room at full scale: pitch 105 by 68 m, run-offs 5 m, stands about 15 m deep with 20
  rows each side. Rooms are already in metres and separate from the city map, so this fits the existing
  `enterRoom` model. If a two-block footprint is too disruptive, the exterior can sit on one block while the inside
  stays full size. Interiors are already allowed to be bigger than the buildings outside.

### 2.2 The room

- **Grid:** generated, like the backrooms. Outer walls, a ring concourse, stairs (vomitories) up into four stands,
  and the pitch in the middle.
- **Stands:**
  - Tiered boxes (props), one per 3 or 4 rows, so the rake is solid to walk on and see from.
  - Seats are `seatRow`s per row, so `nearSeat` and `freeOnRow` work unchanged.
  - Your ticket's block and row are highlighted with an usher figure at the gangway.
- **The pitch:** a floor painter, `pitchSurface(lx, ly)`, returning `[base, level]`.
  - Mown stripes 5.5 m wide.
  - White lines 12 cm wide: touchlines, halfway line, centre circle, boxes, penalty spots and arcs, corner arcs.
  - The lines are filtered by footprint, like `roadLine`. Grass wear in the goalmouths grows over the season.
- **Goals:** two models, with posts and crossbar as solid white tubes and the net as a see-through line pattern.
  The net bulges where the ball hits it.
- **Other furniture:**
  - Dugouts, advertising boards round the pitch (lettering of the city's shops), and corner flags (cloth
    fluttering).
  - A tunnel the teams walk out of.
  - A big screen at one end: the scoreboard, plus replays drawn by re-rendering the stored replay (§4.3) into a
    framed area.
- **Floodlights:** the room's light comes from four pylons. At night the pitch is bright and the stands dimmer.
- **The crowd:**
  - A texture on the stand faces: a dither of heads, shirts in the home or away colours by end, and empty seats
    where the attendance is low.
  - It animates by changing the texture: bobbing when singing, arms up at a goal (a band of skin colour rising), a
    wave moving round.
  - A few real figures sit near your seat so it doesn't look painted on close up.

## 3. The simulation

Fixed step, 20 ticks per simulated second, separate from rendering. It's deterministic given a seed, so tests and
replays work, and it can run headless and fast.

### 3.1 State

```
MATCH = {
  seed, rng, t,                 // match time in seconds (0..90*60 + stoppage), period: 1 | 2 | 'ht' | 'ft'
  teams: [home, away],          // { name, colours, rating, formation, players[11], subsLeft, score }
  ball: { p:[x,y,z], v:[vx,vy,vz], spin, owner, lastTouch },
  ref: { p, v }, phase: 'kickoff' | 'play' | 'throwin' | 'corner' | 'goalkick' | 'freekick' | 'penalty' | 'goal' | 'ht' | 'ft',
  restart: { team, at:[x,y] }, events: [ { t, kind, team, player } ],
  stats: { shots, onTarget, possession, passes, passesDone, fouls, corners }
}
player = { id, team, number, name, role, pos:[x,y], vel:[vx,vy], face, stamina, attrs: { pace, accel, control,
  passing, shooting, tackling, heading, positioning, vision, gk }, state, target, cooldown, carded }
```

Pitch coordinates are metres with the origin at the centre: x along the length, y across.

### 3.2 Physics

- **Ball:** 3D, with gravity 9.8, air drag about 0.25%/m, and rolling friction about 0.6 m/s² on grass.
  - Bounces off the ground with restitution 0.55. A ball hitting the posts or crossbar bounces off them, and the
    net catches it.
  - Spin bends lofted crosses a little (a lateral acceleration proportional to spin × speed).
- **Players:** move as point masses with a top speed (6.5 to 9 m/s by pace) and acceleration (3 to 5 m/s²). Turning
  is limited when fast. Stamina drains with sprinting, lowers top speed late in the match, and recovers at walking
  pace.
- **Control:** a player controls the ball within 0.7 m and moves it with touches. Each touch is a small kick ahead
  in the dribble direction, and how good it is depends on `control`. A bad touch can lose the ball.

### 3.3 Team shape (what stops it looking like kids chasing the ball)

- **Formation slots:** each team has a formation (4-4-2, 4-3-3 or 4-2-3-1), with home slots in a normalised
  rectangle.
- **Where the shape sits:** every tick, the team's block moves with the ball and the phase.
  - In possession: it pushes up and spreads wide, and the full-backs advance.
  - Out of possession: it drops, narrows and stays compact. About 35 m from the back line to the front line.
- **Lines:** the defensive line holds one height, steps up together on a pass backwards, and drops when the ball
  is played over the top. That gives offside traps.
- **Targets:** each outfield player's target is their slot, adjusted by their current job (§3.4).

### 3.4 Decisions (each player, 4 to 6 times a second, staggered)

- **With the ball:**
  - **Score every option, then pick:** the best option is chosen with a little noise, scaled by `vision`.
  - **Shot:** expected goals from distance and angle, the keeper's position and the defenders in the cone. Shoot
    when it beats passing.
  - **Passes to each teammate:**
    - Ground passes: the receiver's openness (time for the nearest defender to reach them) and the progress up
      the pitch.
    - Interception risk: for each defender, the time to reach the lane against the time the ball takes to get
      there.
    - Lofted options as well: switches of play, crosses from wide, through balls into space behind the line.
  - **Dribble:** carry into space ahead if the nearest defender is far enough, or take a defender on when `control`
    is high and the space behind is good.
  - **Clear:** under pressure deep in their own half, kick it long and high.
- **Off the ball, in possession:**
  - Support: offer an angle to the carrier, 10 to 20 m away, out of the defenders' shadow.
  - Runs: forwards time runs behind the line, staying onside, when the carrier faces forward and has time.
  - Width: wingers stay wide.
- **Off the ball, defending:**
  - One presser closes down the carrier, a second covers the pass back, and the rest hold the shape and mark the
    zone.
  - In the box, mark the nearest attacker goal-side.
  - Tackle when close: success depends on `tackling` against `control`. A late or reckless one is a foul, which
    can mean a card.
- **Keeper:**
  - Stays on the line between the ball and the goal centre, coming off it as the shooter nears.
  - Claims crosses inside the six-yard box.
  - Saves: reacts after 0.25 to 0.4 s, then reaches across a distance set by `gk`. A save parries or catches.
  - Distribution: rolls it out or kicks long.
- **Set pieces:** fixed patterns, cycled.
  - Corners: some players attack the near post, far post and penalty spot, others stay on the edge of the box.
  - Free kicks: a wall for central ones within 30 m.
  - Penalties: a placement choice against a dive choice.

### 3.5 Rules and the referee

- **Restarts:** kick-off; ball out over the touchline (throw-in), over the goal line (goal kick or corner by last
  touch); goals (the whole ball over the line between the posts and under the bar).
- **Offside:** judged at the moment of the pass: an attacker beyond the ball and the second-last defender, in the
  opponents' half.
- **Fouls:** come from tackles (§3.4) and lead to a free kick, or a penalty inside the box. A foul's severity sets
  the chance of a yellow or red card. Two yellows make a red.
- **Advantage:** played on when the fouled team keeps the ball, for a short window.
- **Time:** 45-minute halves with stoppage time from stoppages, half time, full time. Three substitutions per team,
  made around minute 60 to 80 for tired players.
- **The referee:** a figure who follows play at a diagonal, about 15 m from the ball. Linesmen are optional figures
  on the touchlines.

### 3.6 Teams and the league

- **Clubs:** eight, one per district or so (for example the Docks, Midtown, Chinatown, the Brownstones), each with
  kit colours and a crest made of letters.
- **Players:** generated per club from a seed, with names from the existing name pools, attributes around the
  club's rating, and numbers 1 to 11 plus substitutes.
- **The season:** a double round robin. The table (played, won, drawn, lost, goals for, goals against, points) and
  scorers are saved in the save file. Matches you don't attend are simulated instantly at kick-off time, headless,
  so the table moves on whether or not you watch.
- **Calibration targets,** checked over 200 seeded matches between equal teams:
  - 2.4 to 2.9 goals a match
  - home win 43–47%
  - 9 to 15 shots per team
  - pass completion 70–85%
  - 4 to 6 corners per team
  - 10 to 14 fouls a match

## 4. Presentation

### 4.1 Drawing the match

- **Players:** existing figures in kits, with `figLook` given shirt, shorts and socks colours and a number on the
  back drawn as lettering. Run poses use speed. Keepers wear a different colour.
- **The ball:** drawn with `drawBall`, with a minimum size of one bright cell and a shadow on the grass so you can
  read its height.
- **Celebrations:** a scorer runs to the corner and teammates pile on. These are a few authored poses and paths.

### 4.2 Sound

- **Crowd bed:** a crowd loop whose volume and pitch follow "danger", the attacking team's expected-goal threat
  this second.
- **One-shot sounds:** gasps at shots, a roar at goals, whistles (kick-off, foul, half time and full time are
  different patterns), and the thud of kicks near the ball.
- **Chants:** the home end sings when winning or level. They're synthesised or short loops in the style the audio
  code already uses.

### 4.3 Replays and the broadcast view

- **Ring buffer:** the last 12 s of player and ball positions are kept at 20 Hz.
- **Replays:** after a goal or a big save, the big screen plays the buffer back, and the broadcast camera can show it
  in slow motion.
- **Broadcast camera:** placed at the centre of the main stand, raised, tracking the ball with a lead. It can zoom
  by changing the FOV.

### 4.4 Ticker and commentary

- **Commentary:** text lines from templates, keyed by event, for example: "Kick-off at the Docks Ground.",
  "Okafor drives forward...", "Wide!", "GOAL! Okafor, 34'". Lines are throttled so they don't spam.
- **Half and full time:** at half time and full time it shows the stats panel.

## 5. Phases (each a PR, with its tests)

**Phase 1: headless match engine.**
- Physics, team shape, decisions, rules, the clock, teams and league data. No drawing.
- *Done when:*
  - Seeded matches complete deterministically.
  - The invariants in §6 hold.
  - The calibration targets in §3.6 are met within tolerance over 200 matches.
  - Running a whole match headless takes under 2 s.

**Phase 2: a debug view of the pitch.**
- A top-down ASCII view in a dev-tools panel: players as numbers in team colours, the ball as `o`.
- *Done when:* you can watch a match from above, scrub through it, and see that the shape and passing look right.

**Phase 3: the stadium interior.**
- The room, stands, seat rows, pitch markings, goals and floodlights.
- Players drawn as figures, driven by the engine.
- *Done when:*
  - From a seat you can watch a match through to full time.
  - Frame time with 25 figures on screen is within budget (ABAB against the cinema).

**Phase 4: the building and tickets.**
- The exterior landmark, turnstiles, ticket prices and seat allocation, the fixture schedule and the poster.
- An entry on the map and in dev tools Places.
- *Done when:* you can buy a ticket, enter, find your seat, watch, and leave. A match you skip appears in the table.

**Phase 5: atmosphere.**
- The crowd texture and its reactions, crowd sound and chants, whistles, PA and commentary ticker, the scoreboard.
- *Done when:* a goal produces a roar, a crowd surge and a scoreboard update in the same second.

**Phase 6: replays, the broadcast view and celebrations.**

**Phase 7: extras.**
- Betting booth, concessions and scarves, season tickets, cup matches, night matches with a trip home.

## 6. Tests

- **Engine invariants,** over seeded matches:
  - the ball is never inside a goal frame unless a goal is given
  - every restart is taken from the right place by the right team
  - players stay within the pitch plus run-off
  - the clock always runs forward
  - at most 11 players per team are on the pitch
  - the substitution limit is respected
- **Rules unit cases:**
  - scripted positions for offside and not-offside
  - which restart follows a ball out off each team
  - a penalty for a foul in the box
  - a second yellow becomes a red
- **Calibration:** the §3.6 statistics over 200 matches, run as a slower CI job or sampled down to 40 in the normal
  suite.
- **Determinism:** the same seed gives the same events list.
- **Browser:**
  - buying a ticket and sitting in your seat
  - the scoreboard shows the engine's score
  - the crowd texture changes on a goal
  - performance budget at the stadium

## 7. Rough size

| Part | Lines (approx.) |
|---|---|
| Engine: physics, rules, clock | 500 |
| Engine: team shape and decisions | 900 to 1,500 |
| Teams, names, league, saving | 250 |
| Stadium room, pitch painter, goals, crowd texture | 600 |
| Exterior landmark, tickets, fixtures | 300 |
| Sound, ticker, scoreboard, replays, broadcast camera | 500 |
| Tests | 600 |

The engine is the bulk of the work, and it can be built and tuned headless before anything is drawn. That's the
main reason this is very doable.
