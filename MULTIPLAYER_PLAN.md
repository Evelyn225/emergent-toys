# Multiplayer plan (v1.5: presence + chat + rides + guns + hooks + shared police)

Sketch, not a spec. Line refs are to `city/` as of this writing.

## Social follow-up (protocol 12)

- Public interiors identify the building, not the exact point where someone pressed E. Private flats also identify their owner; following a marked invitation selects the friend's flat even if you own one in the same building. Stations identify their station; carriage IDs and arrival phases use the shared 45-second train cycle.
- Player map locations travel separately from interior coordinates. The map directory searches player names, keeps vehicle/interior markers, and labels last-known positions for quiet peers. Player waypoints follow the latest location.
- Multiplayer menus block input while simulation and rendering continue. The background fallback steps normal physics too, so airborne players land. Offline pause stays unchanged.
- Chat entry uses transparent monospace text and a terminal prompt. Give-money forms show a live available balance.
- Homeowners authorize invited guests to operate their TV and workshop. The owner reserves supplies, resolves harvests and supplies the resulting items; guest bags stay personal. Guests cook with ingredients from their own bag. The shared stove, TV, grow racks and running processor/fan are visible to other visitors. Private storage and furniture placement stay restricted to the owner.
- Teleport requests work in both directions through Players. The recipient explicitly accepts or declines; requests expire after 30 seconds. Public rooms can be joined directly. Homeowners can grant arrival in their home; a visitor cannot grant access to a third party's private home, so their destination uses the building entrance.

## Status

- **Done (branch `multiplayer`)**: phases 0-2. `city/net-core.js` (pure: checks, smoothing, rules), `city/net.js` (transports,
  drawing, chat, clock, menu), `vendor/trystero.js` (Trystero 0.26.0 bundled). Esc -> Multiplayer to join; T or Enter to chat;
  `?room=code` invite links; `?net=local` for two tabs on one machine. Other players are drawn on foot or as a car
  (a picture only: no riding or collisions yet). Tests: `test/city-net.test.cjs`, `test/browser/ascii-city-net.browser.test.cjs`.
- **Verified by hand**: two real machines connect over Trystero and see each other (ghosts, skateboarding).
- **Release order (feature flags, `NET_FEATURES` in `city/net-core.js`)**: ghosts (other players on foot, in cars and on
  skateboards, name tags, wanted stars, join/leave lines) are always on. `chat`, `clock` and `tags` are switched on
  (chat and clock not yet tried by real players). `tags`: spray-paint tags are shared: each player sends their whole
  list (up to 60, from their save) on joining and after every spray; others show them on their walls (never in their
  own save), a tag anyone has there blocks the spot, and a player's tags go when they leave. Each later phase lands behind its own flag (`rides`, `guns`, `hooks`, `police`), off until it's
  been tried. `?netfeatures=a,b` sets exactly that list for trying things (`?netfeatures=none`: ghosts only). The set of
  switched-on features is part of the build fingerprint, so players with different sets get the "different version"
  message instead of half-working.
- **Phase 3 (flag `cars`, on)**: done on the branch. A car you've driven is shared: others get a stand-in for it in
  their own traffic (`remote: true`; `playerCar()` in `core.js` makes the traffic, police, gas stations and alarms leave it
  alone). Parked ones go out once a second (your nearest 12). E by someone's stopped car asks for a lift: mode `'ride'`,
  carried in their car's stand-in, mouse to look about, V for the chase camera, E to get out; put out when they park,
  wreck it or leave. E by one they've left parked asks for it: their game hands it over and drops it, so it's never in
  two places; one they bought stays locked. Crashing into or shooting someone's car sends the damage to them
  (`damageCar` -> `netHurtCar`); if both drivers' games felt the same crash, it counts once.
  Not done: door locks for drivers, a passenger shown in the car, two drivers pushing each other (each just stops).
- **Spray paint (flag `paint`, on)**: `main`'s freehand spray paint (`city/spray-paint.js`) is shared through its
  `PAINT_LISTENERS` hook: strokes go out as you spray them; on joining, everyone sends you their most recent 3000 dots.
  Others' paint stays on your walls and in your save (as the hook intends), deduplicated by dot so rejoining doesn't double it.
  The old tags (`tags` flag) still sync for saves that have them.
- **Phase 4 (flag `guns`, on)**: other players are targets in `traceShot` / `traceRoomShot`; every shot goes to
  everyone (`netShotFired`): they see the streak, hear the bang and their street scatters. A hit is taken by the victim's
  game like a police round (22-36 off 100: three rounds put you down); down, you lie in the street for the others a few
  seconds and wake in hospital (nobody takes your gun: it wasn't the police). Gunning a player down is a crime
  (`shotdown`, 3 stars) if anyone saw. Friendly fire is on by default; each player can switch it off for themselves in
  the multiplayer menu.
- **Phase 5 (flag `hooks`, on)**: a cast passing through another player on foot hooks them (`netHookTarget` in
  `lureHits`). In their game they're held at the end of the line (walking off just drags against it), Space or E over
  and over works it loose, and it slips out by itself after 6 s if you don't reel. Q reels: their game walks them in,
  snagging on a corner as an NPC would; at your feet the hook comes out. Either end lets go if the other's gone, gets
  in a car, goes indoors, or the line runs past 1.5x a full cast.
- **Phase 6 (flag `police`, on)**: while you're wanted, your updates carry the police after you (up to 12: pursuing
  cruisers, officers on foot, on the roofs, or in the building with you). Others get your cruisers as stand-ins in their
  traffic (`cop: true`, `state: 'out'` so they're lit and wail; never `pursuit`, which their police code would count as
  their own), and see your officers running. Their own patrol cars aren't drawn within 1.5 cells of one of yours.
  Busted at the wheel: your passengers are pulled out and get a star (`accomplice`). Not done: the 5-star helicopter
  isn't shared.
- **Round after the first real test**: paused (or in another tab) players can't be shot or hooked and show "(paused)";
  Chat in the phone's More sheet and a controller's Actions (the on-screen keyboard; Done sends); others now see boats,
  the swan, aircraft, skate bails, spraying (arms out, a mist), fishing lines (the hooked end too), peeing (their stream
  runs through your own pee.js, so the splashes and puddles happen in your street, and you hear it), who's riding in a
  car (on its tag), and everyone on the minimap and the big map (inside: at the door they went in by). Other players'
  skaters are drawn as plain solid figures: skate.js's per-pixel skater is made for the chase camera and comes apart up
  close. Flips and spins already came through (the board's yaw, pitch and roll are sent).
- **Next**: try it all with real players: peaceful mode, car hits, pickpocketing and soccer balls are tested only in
  tabs on one machine (see the sections at the end). Smaller
  gaps: the gifts, drops, visiting and craft rides from the latest round are tested only in tabs on one machine too.
- **Decided while building**: a follower's clock is set to the keeper's on every sync (both run the same clock between
  syncs, so the step is tiny). A player who goes quiet for 8 s is hidden, not dropped: only the transport saying they
  left removes them, so a tab that was in the background comes back. A background tab gets no animation frames, so
  `net.js` keeps sending, listening and running the shared clock on a 250 ms timer whenever frames stop for 0.4 s. In a room,
  sleeping doesn't skip the night and the pocket watch only hurries time for the clock keeper. Everyone wears the
  same outfit as the skater, in colours picked from their name.

## The rule that makes this tractable

**Every client keeps running its own city.** NPCs, NPC traffic, weather timers, shops, minigames, money, inventory
and saves all stay local, exactly as now. Multiplayer adds *networked entities* on top, and each one has exactly one
**owner client** that simulates it and broadcasts it. Everyone else draws a proxy, smoothed between updates.

| Entity | Owner | Others see |
|---|---|---|
| Your avatar | you | proxy figure + name tag + chat bubble + wanted stars |
| A car a player has entered | its current driver (or last driver while parked) | proxy car in `cars`, flagged `remote` |
| Police chasing you (pursuit cruisers, foot cops) | you | proxy cruisers / cops |
| A shot | the shooter | tracer, bang, NPC panic; damage on the victim |
| A hook on a player | the angler starts it, the **victim** moves themselves | line from rod tip to victim |

There is **no game server**. Clients talk peer to peer over WebRTC using [Trystero](https://github.com/dmotz/trystero),
which finds peers through public signaling relays (Nostr by default), so the site stays static on Vercel. Every job a
server would do (arbitration, host election, rate limits) is done by a deterministic rule every client applies the
same way. "Owner decides" means cheating is easy. That's fine for friends, not for strangers.

## Transport: Trystero

- `joinRoom({ appId: 'glyphport', password: roomCode }, roomCode)` per room. `password` encrypts the signaling
  handshake so other people on the public relays can't read it; anyone with the code can still join, so the code is
  the invite.
- Actions (0.26 API): `const tick = room.makeAction('tick'); tick.send(data, { target }); tick.onMessage = (data, { peerId }) => ...`,
  one per message type, all made up front. `onPeerJoin` / `onPeerLeave` replace a server's join/leave messages.
  `selfId` is your peer id. `onJoinError` reports failed connections (usually: needs TURN).
- Strategy: start with the default (Nostr). If a relay set proves flaky, Trystero can switch to MQTT or BitTorrent
  trackers with a one-line import change. Keep the import in one place (`net.js`).
- **Loading**: the bundle is one classic script, Trystero is ESM. Its built ESM (Trystero + the Nostr strategy +
  noble-secp256k1, one file via esbuild) is vendored as `vendor/trystero.js` (license in `vendor/trystero-LICENSE.txt`)
  and loaded with `await import('./vendor/trystero.js')` (the `./` matters: without it it's a bare specifier).
  `vercel.json` deploys `vendor/**`; `tools/prepare-desktop.cjs` copies it into the desktop build.
- **NAT failures**: direct WebRTC fails for some players (symmetric NAT, strict corporate/school networks), roughly
  10-15%. Ship without TURN first. If it bites, pass a TURN server through Trystero's `rtcConfig` (Cloudflare Calls
  TURN or a metered free tier). That is the only server-ish thing this design might ever need.
- **Mesh size**: every peer connects to every other, so upload grows with player count. Cap rooms at **8**; refuse
  the 9th in the join UI.
- **Desktop**: the Windows build (WebView2) has WebRTC. If a Linux/macOS Tauri build ever ships, check WebKit's
  WebRTC support there before promising multiplayer on it.

## Messages

One **bundled tick** per peer, plus rare events. Size matters little; count matters for CPU and upload, so never send
a separate message per entity.

```
tick   (10-15 Hz) {
  t, x, y, z, a, pitch, mode, roomKey, pose, held, stars,
  veh?:  { id, kind, body, x, y, hx, hy, v, brake, lights, damage, seats:[peerId|null] },  // the car you drive
  cops?: [{ id, foot, x, y, hx, hy, v, lights, aim }]                                     // your pursuit, if wanted
}
parked (1 Hz)    [{ id, kind, body, x, y, hx, hy, damage, owner }]   // player-touched cars you left parked
hello  (on join, and to each new peer) { name, look, ver }          // look = figLook params; ver = bundle version
chat   { text }                                                     // <=120 chars
claim  { id, t }                                                    // taking a parked player car
ride   { veh, seat } / rideOk { veh, seat, ok }
shot   { x0, y0, z0, x, y, z, what, target?, veh? }                 // target = peerId when a player was hit
hook   { target, x, y, z } / unhook { target, why }
bump   { veh, dx, dy }                                              // your car hit their car; owner applies it
clock  (clock owner only, every 5 s + on change) { tod, dayNum, weather, rain, storm, snow, bolt }
```

Encode `tick` as JSON first. Trystero actions also take binary (`ArrayBuffer`), so switch `tick` to a packed
`Float32Array` only if profiling says so.

Trystero data channels are reliable and ordered, so a lost packet delays the ones behind it. At 10-15 Hz with
interpolation that shows as an occasional hitch, not a desync. Acceptable for v1.5.

### Rules that replace a server

- **Clock owner** = the lowest `selfId` among connected peers (string compare). Recomputed on every join/leave, so
  when they leave the next one takes over with no handshake.
- **Vehicle claims**: a `claim` with the earlier `t` wins, ties broken by lower peer id. Everyone applies the same
  rule to the same messages and agrees without a referee. The loser's client gets them out of the car with a line
  ("Someone beat you to it.").
- **Vehicle ids**: `selfId + ':' + counter`, so two peers never mint the same id.
- **Rate limits on receive**: drop chat beyond 1/s (burst 3) and shots beyond `1 / FIRE_GAP` per peer. A peer that
  keeps exceeding gets muted locally. Not secure, just stops a broken client flooding everyone.
- **Version check**: `hello.ver` must match yours, or the join UI says "they're on a different version, refresh".
  Different bundles disagree on world layout and item ids.

## New files

Add to `tools/city-manifest.json`:

- `city/net-core.js` (**pure**): message shapes and validation, snapshot interpolation buffer (render 100 ms behind,
  lerp position, slerp yaw, snap on teleports > 4 cells), `roomKey()`, vehicle ids, the claim / clock-owner rules.
  Unit-testable in the existing vm harness.
- `city/peers.js` (**pure**): `peers` map, proxy avatars, proxy vehicles, proxy cops, the hooks the gameplay files
  call (`peerTargets()`, `peerVehicleAt()`...).
- `city/net.js` (**dom**): the **transport interface** (`join(code)`, `leave()`, `send(type, data, to?)`,
  `on(type, fn)`, `onJoin`, `onLeave`) with two implementations:
  - `trystero`: the real one;
  - `local`: a `BroadcastChannel` transport for two tabs on one machine, for development and tests (no relays, no
    WebRTC, instant).
  Plus send pacing and the join UI (room code + name) in the pause menu.
- `city/chat-ui.js` (**dom**): bottom log, input box, bubbles.
- `vendor/trystero.js`.

`main.js` gets two calls: `netTick(dt)` after the player has moved (send + apply inbound), and `drawPeers()` wired into
the same sprite pass that draws `people` (via `figSprite`, `figures.js:365`).

## Features

### 1. Presence (the base everything else needs)

- Your `tick` carries `px, py, a, pitch, mode`, height (`outdoorGroundHeight` / roof / el / body.z), a pose key that
  maps to `FIG_POSES` (walk, run, sit, crouch, skate, swim, dance), held item id, and current vehicle + seat.
- **Interiors**: `room` coordinates are local, so `tick` carries `roomKey = room.kind + ':' + room.ret[0..1]` (the
  door you came in by). Peers draw only when `roomKey` matches yours, or both are outdoors. Train/el/ferry rides: key
  on the line + car so riders in the same carriage see each other.
- World wraps (`rel()`, `worldCoord()` in `core.js:23`), so all peer distances go through `rel()`.
- Name tags: small text over the head, fade past ~25 cells, hidden behind walls (reuse `lineOfSight`, `crime.js:41`).

### 2. Chat + speech bubbles

- `T` (or Enter) opens a one-line input at the bottom; Esc cancels. Controller: reuse the on-screen keyboard in
  `controller-ui.js`. While typing, `K` input is swallowed so you don't walk off.
- **Log**: last 6 lines bottom-left, fade after 10 s, full history while the box is open.
- **Bubble**: text above the speaker's head in screen space, wrapped to ~24 chars/line, 3 lines max, shown for
  `4 + text.length / 15` seconds. Shrinks and fades with distance, hidden past ~20 cells or out of line of sight.
  Your own bubble shows above you in third-person (car, skate, chase cams).
- Same-room rule as presence: a bubble indoors is only seen by people in that `roomKey`. The log is room-wide to
  start (everyone in the Trystero room); add a `/near` toggle later if wanted.
- Sender caps length and strips control chars; receivers enforce the same and the rate limit above.

### 3. Shared clock and weather (needed for chat to make sense: "look at the sunset")

- The clock owner (lowest peer id) broadcasts `clock`. Others overwrite `tod`, `dayNum`, `weather`, `rain`, `storm`,
  `snow`. Lightning `bolt` seeds come along so flashes line up.
- On joining, you take the room's clock, not your save's. On leaving, your save keeps whatever time you left at.
- Sleeping (hotel/home skips hours) and pause can't move a shared clock. In MP: sleep is a fade + needs refill with
  no time skip, and the pause menu doesn't freeze the world (`main.js:315` path gets an `if (netOn)` branch).
  Minigames already keep the world running behind them (`main.js:327`).

### 4. Shared vehicles + riding

- **Which cars are shared**: only cars a player has touched. Entering a car (`actions.js:298`, sets `c.player`) gives
  it a net id. While driven it rides in your `tick`; once you leave it parked it goes in your 1 Hz `parked` list, so
  others see where you left it and can take it (`claim`, rules above). If you disconnect, your parked cars vanish
  from everyone else's world. Simple and acceptable.
- Proxy cars go into each client's `cars` array with `c.remote = true` (plus `c.netId`, `c.owner`). Every place that
  skips `c.player` must also skip `c.remote`: **24 checks in 12 files** (`grep -n "c\.player" city/*.js`), e.g.
  `traffic.js:431,443`, `gun.js:89,173`, `crime.js:327,404`, `damage.js:13-19`, `gas.js:139`. Wrap it as
  `const playerCar = c => c.player || c.remote` and replace them in one pass.
- NPC traffic treats proxy cars as obstacles via the existing car grid (`fillGrid`, `traffic.js:334`), so NPC cars
  brake for them. Car-vs-car between two players: each client collides its own car against proxies as kinematic
  boxes and sends `bump` to the owner, who applies the shove. Good enough; it won't be physically exact.
- Damage to a proxy car (gunshot, crash) is sent to the owner, who runs `damageCar`; the result shows up in their
  next `tick`.
- **Riding**: walk up to a player-driven car and press E -> `ride { seat }` sent to the driver only. The driver's
  client auto-accepts if the seat is free (option to lock doors) and lists you in `veh.seats`. Passenger enters a new
  mode `'ride'`:
  - position follows the proxy car's interpolated position plus seat offset; camera is `chaseCam` /
    `stepTaxiCamera` pointed at the proxy (the taxi already has a rider-in-car camera, reuse it);
  - free mouse look; E gets out at the curb (`leaveCar` logic minus the parking);
  - can shoot from the window (drive-bys fall out of section 5 for free).
  - Driver disconnects (`onPeerLeave`) or the car is wrecked -> passengers are ejected onto the sidewalk.
- Seats: 1 driver + 3 passengers for cars, 1 for taxis' front seat, none for bikes/skate. Boats and the helicopter can
  come later with the same pattern (`mode === 'boat' | 'sea' | 'air'`).

### 5. Gunshots

- `traceShot` (`gun.js:53`) gets one more loop next to the people/cops loops (`gun.js:84-87`): every visible peer in
  your `roomKey` is a `figure(peer, 'player')` target (standing height 0.175, lying 0.04, already handled), and proxy
  cars are already covered by the `cars` loop once `c.remote` isn't skipped there. Indoors: `traceRoomShot` gets the
  same peers.
- Shooter decides. `fireGun` (`gun.js:107`) broadcasts `shot` every time. Every client: draws the tracer (push into
  `gun.shots` with a `remote` flag), plays the bang at distance, and calls `panicAt` on its own NPCs so the street
  scatters on everybody's screen.
- Victim client: on `shot.target === selfId`, apply `COP_HURT` (`gun.js:19`) to `needs.health` and set `gun.hurtT`,
  the same path cop shots use (`gun.js:245-248`). At 0 health, `shotDown()` (`gun-ui.js:110`) already handles going
  down. In MP, add a short downed state (5 s on the ground, visible to others) before the pass-out.
- Crime: shooting or killing a player calls `gunCrime('murder' | 'gunfire', ...)` on the shooter's client like an NPC
  kill. Witnesses are the shooter's local NPCs and cops, so the shooter's own police come for them.
- Friendly fire toggle per room, set by whoever creates the room and carried in `hello` (receivers ignore player
  hits when off).

### 6. Fishing rod hooks players

- `lureHits` (`fishing.js:209`) also checks peers on foot (not in cars, not indoors unless same `roomKey`) with the
  same reach/height test. On a hit the angler sends `hook { target }` and enters the existing `'hooked'` line state
  with `f.who` pointing at the peer proxy.
- **The victim moves themselves** (they own their position). Victim client gets a `hooked` state:
  - first 4 s: walking is slowed by half; mashing jump/E builds "work it loose" (mirror of the NPC timeout at
    `fishing.js:228`); succeed -> `unhook { why: 'free' }`;
  - when the angler reels (`f.st === 'haul'`, visible in their `tick` as a pose/flag), the victim client pulls
    itself toward the angler's interpolated position at `HOOK_HAUL` (`fishing.js:208`), with the same wall check
    (`map[idx(...)] > 0` -> snag, unhook).
  - within 0.1 cells of the angler: released, both get a line in chat-bubble form (reuse the NPC quips).
- Angler draws the line to the victim's proxy position; other clients draw it between the two proxies.
- Edge cases: either player gets in a vehicle, enters a door, disconnects, or goes past `CAST_MAX * 1.5` -> unhook.
  Hooking someone on a skateboard and towing them is a fun later extension.

### 7. Shared police

Each client keeps running police **only for its own player**, as now (`crime.js`, `stepCrime`). What's added:

- `stars` in your `tick` -> stars over your name tag on everyone's screen, plus a minimap blip if `bigmap.js`
  makes that easy.
- While you have stars, your `tick` carries `cops` from `cars.filter(c => c.pursuit)` and
  `footCops.filter(c => c.chase)`. Others draw them as proxies with lights and sirens (positional audio), so a chase
  going past you looks and sounds real.
- Others' clients **hide their own local patrol cars within ~1.5 cells of a proxy cruiser** so there's no doubling
  where the two overlap.
- Crimes against players count (section 5). A wanted driver's passengers: when the driver is busted, passengers are
  pulled out too and get 1 star as accomplices (or just ejected; decide).
- Proxy cops shoot only at the player who owns them (their owner already sends those `shot`s through `copsShoot`,
  `gun.js:225`).
- **Not** in this version: one shared police force that reasons about everyone at once. Two wanted players next to
  each other each have their own cops; both sets are visible to both players, so it reads fine.

## What stays single-player

NPC people and traffic, shops, money, inventory, property, saves, jobs (courier, taxi job), minigames, stocks,
league, cooking, interiors' contents. Saves stay per-player in localStorage; MP never writes another player's state.

## Phases and effort

One developer who knows the codebase; agent help speeds up phases 0-2 most.

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Vendored Trystero, transport interface + `local` transport, `net-core`/`peers`, join UI, avatars, name tags, interiors by `roomKey`, version check | 3-4 days |
| 1 | Chat log + bubbles + controller input | 1-2 days |
| 2 | Shared clock/weather, clock owner rule, sleep + pause rules | 1 day |
| 3 | Shared player vehicles, `c.remote` pass, claims, proxy collisions, riding | 4-7 days |
| 4 | Gunshots vs players, damage, downed state, friendly-fire toggle | 2-4 days |
| 5 | Rod hooks players | 1-2 days |
| 6 | Shared police: stars, pursuit in `tick`, proxy cops, local cop suppression | 4-7 days |
| | **Total** | **~3-5 weeks** |
| later | TURN fallback via `rtcConfig`, only if players report failing to connect | 0.5 day + a TURN account |

Phases 1, 2, 4, 5 can happen in any order after 0. Do 3 before 6 (chases are car-heavy).

## Testing

- `net-core.js` and `peers.js` are pure: interpolation, roomKey, claim and clock-owner rules, message validation and
  receive rate limits in node tests through `test/helpers/load-city.cjs`.
- Browser tests use the `local` (`BroadcastChannel`) transport: two Playwright pages in one browser context join the
  same room, script one to walk / chat / shoot / cast / drive, and assert the other sees the proxy move, the bubble,
  the health drop, the hook pull, the passenger following. No public relays in CI, so no flakiness from them.
- One manual smoke test per release over real Trystero across two networks (home Wi-Fi + phone hotspot), since
  NAT behaviour can't be tested locally.
- Add a `?netlag=150&netloss=0.05` dev flag on the transport to simulate bad connections.

## Risks

- **Connectivity**: some players won't connect without TURN, and public signaling relays can be slow or down. The
  join UI needs a clear "couldn't reach them" state after ~15 s instead of hanging.
- **Global player state**: fine for this design because only *your* player is ever simulated locally; remote players
  are proxies, never `px/py`. Don't let anyone add code that temporarily swaps a peer into `px/py` to "reuse" logic;
  that's how desyncs and save corruption start (see the camera save/restore dance in `main.js:420-452`).
- `c.player` misses: one forgotten check means NPC traffic tries to drive a proxy car. Add a grep test that fails if a
  new `c.player` appears without `playerCar()`.
- Time-moving features scattered around (fortune teller `weatherDue`, orrery `seasonShift`, dev tools) all need an MP
  guard so only the clock owner can change the shared clock.
- Freecam and dev tools should be disabled in MP.
- No authority: a modified client can teleport, one-shot people, or fake claims. Acceptable for friends only; if it
  ever goes public, move to Cloudflare Durable Objects behind the same transport interface.

## Built: pickpocketing players, hitting them with cars, peaceful mode, soccer balls

Decisions (from the user): pickpockets take cash only, and the victim can notice and stop it; peaceful or paused players
can't be pickpocketed. Being run over hurts a bit, and puts you in hospital if it takes you to 0. Peaceful is per player
and replaces the friendly-fire toggle. Only a ball's owner can pick it up. As built:

- **Peaceful** (`net.peaceful`, Esc > Multiplayer, kept between sessions): sent as `peaceful`; `netCanTouch(s)` is false
  if either side is peaceful or the other is away, and guns, hooks, car hits and pickpocketing all check it, on both
  sides. A `~` after their name.
- **Car hits** (`netCarHitsPlayer` in `drive()`): the victim takes 10 + 22 x speed (10-60) and lies flat for 1.2-2.7 s
  (pose `down`, can't move); at 0, hospital (`netShotDown(by, 'car')`). The driver gets `hit` for the hit and `roadkill`
  if it put them in hospital, from their own witnesses.
- **Pickpocketing** (`netPickTarget`, `netPickpocket`): within 0.3 cells and behind them. The thief plays the NPC
  minigame; 0.6-1.5 s in, the victim feels it, and turning to face the thief or stepping 0.45 away stops it (the
  thief's minigame ends there and they're caught). Success: the victim's game hands over a tenth of their cash, at
  most $50; they find out a moment later. One try per thief per minute.
- **Soccer balls** (`netBallFrame` and friends): as planned below; the ball physics are goods.js's own `stepBall`, run on
  other balls by swapping them in.

## Built: the players menu, gifts, shared drops, visiting, riding in anything

- **Players menu** (hold Tab; phone: More > Players): everyone in the room, with where they are. Let go and it closes;
  click something and it stays open until Done. Per player: **Whisper** (`dm`: only they get it, no speech bubble),
  **Give money**, **Give item** (pick one from your bag), **Invite home** (needs a home), and **Go to their home** once invited.
- **Gifts** (`gift` / `giftAck`): money leaves your pocket and the item your bag when you send; the receiver's game takes
  it if there's room and answers. No answer in 10 s, or no room, and it comes back. Accepted ones are gone for good.
- **Shared drops** (`drops`, 1 Hz): things you put down in the street are shown to everyone. E picks it up: your game asks
  theirs (`dropClaim`), theirs takes it out of its street and says yes (`dropGiven`), so it can't be picked up twice.
- **Visiting** (`invite`): the invite carries your home record (cell, kind, furniture). The guest's map gets a waypoint;
  E at that door enters a copy of your flat (`room.guestHome`) keyed by the cell, so both of you are in the same room.
  Guests can't use the bed, closet, shelves or workshop, or move furniture; the TV and terrace work.
- **Riding in anything** (flag `cars`): boats, the swan and aircraft as well as cars (`craft:<peer>:sea|air|swan` ids).
  E by one that's stopped (an aircraft: on the ground) asks for a seat: a car or taxi seats 3, a boat 3, a helicopter 3,
  a plane 2, the swan 1. Getting out of a boat puts you on the nearest land; getting out in the air drops you with a
  parachute. Riding with someone on a taxi shift, you pay the meter fare (`fare`) when you get out; it counts toward their shift.
- **Checked**: the football league (item 6) seeds fixtures from the season, which in multiplayer is now worked out from
  the shared clock's slot, so everyone sees the same matches. Trains, the el and the ferry (item 7): the el and the ferry
  already shared a room; trains all shared one key, so now a train is keyed by its station and the half-hour you boarded,
  and two players on the same train see each other. Homes are keyed by cell, so a visit and its owner meet.
- Protocol 10.

## The plan as written (kept for the reasoning)

Same rule as everything else: the game of the player it happens *to* decides what happens to them; the other side
only asks. So no player's money, items or health is ever changed by someone else's game.

### Peaceful mode (do this first: the other two check it)

- A toggle in Esc > Multiplayer, per player, **off by default**: "Peaceful: you can't hurt or rob other players, and
  they can't hurt or rob you." It replaces the friendly-fire toggle, which only protects you one way (you could still
  shoot people while they can't shoot you).
- Sent in every update (`peaceful: true`, like `away`). Anything player-against-player checks both sides: if either the
  one doing it or the one it's done to is peaceful, it doesn't happen.
  - guns: `netShotTargets` / `netRoomShotTargets` skip them, and a peaceful shooter gets no player targets at all, so the
    round goes past (the streak and the bang still happen);
  - hooks: `netHookTarget` skips them, and the hooked side refuses (`unhook: 'no'`);
  - car hits and pickpocketing: below, same check;
  - shared police, chat, riding, paint, cars: unaffected.
- Shown over them: their name with a small `~` (or "(peaceful)" up close), so nobody wonders why their shots miss.
- Optional later: a room-wide "peaceful room" setting, held by whoever keeps the clock, that switches it on for everyone.
- Size: half a day to a day.

### Hitting players with cars

- Now: another player's car drives straight through you, and yours through them (`drive()` in `main.js` only checks
  NPCs, `people` and the foot police).
- Driver's side: in `drive()`, alongside the NPC check, test other players on foot (live positions, not `away`, not
  peaceful, not in a car or on the water) against the car's front the same way. On a hit: the car slows as it does for
  an NPC, and the driver sends `runover { speed, dir }` to that player.
- Victim's side: knocked flat (the existing `knockDown` look, pose `down` sent so others see it) for a couple of seconds,
  can't move meanwhile, and loses health by speed: slow, a bruise; over the NPC fatal speed (`FATAL_V`), down and into
  hospital the way a shooting does (`netShotDown`, with "hit by a car" in the message), lying in the road for the others.
- Crime for the driver, from their own witnesses: `hit` (2 stars) when they get up, `roadkill` (4) when they don't, as
  for NPCs. News lines already exist for both.
- Riding: hitting someone with passengers aboard makes no difference to the passengers.
- Size: one to two days, most of it making the knock-down feel right on the victim's screen.

### Pickpocketing players

- Target: another player on foot, close (0.3 cells) and **behind them**, i.e. they're facing away from you, using
  their sent heading. Not away, not peaceful, not in a car. G, as for NPCs; the prompt says "G: pick Bob's pocket".
- The thief plays the same pickpocket minigame as on NPCs (`startCrime('pickpocket')`).
  - **Success:** the thief's game sends `pick` to the victim. The victim's game chooses what goes (see the decisions
    below), takes it out of their own money or bag, and replies with it; the thief's game adds it. The victim gets a line
    a moment later ("Your pocket feels lighter.") so they know, but not who unless they turn round in time.
  - **Failure:** the victim's game is told at once ("Ann just tried to pick your pocket!") and the thief's own witnesses
    decide the crime (`pickpocket`, 1 star), as for NPCs.
- Not twice in a row: one attempt per victim per minute, checked on the victim's side.
- Size: one to two days.

### Soccer balls

- Now: a kicked ball (`ball` in `goods.js`: kicked off the bag, dribbled by walking into it, E to pick it up) exists
  only in its kicker's game. Nobody else sees it.
- **Whoever touched it last runs it.** That player's game simulates it (the existing `stepBall` physics: bounces,
  slopes, walls, water) and sends its position and speed with their updates (`ball { id, x, y, z, vx, vy, vz, t }`);
  everyone else has a stand-in, drawn by the existing `drawBall`, moved between updates and carried on along its
  velocity so it doesn't lag behind.
- When you touch someone's ball in your own game (walk into it, or kick it with Q), you take it over: your game carries
  on from the latest state with your touch added and starts sending it, stamped with the time of your touch. If two
  players touch it at once, the later touch wins (ties: lower id), and the other snaps to it. That's what makes passing
  and tackling work without asking anyone first, at the cost of a small hitch when two feet meet it together.
- Each player's ball has its own id (one each, as now); a room can have several going.
- Picking up: E picks up only your own ball. Anyone can kick or dribble anyone's.
- Lost in the water: whoever's running it then sees it go, and it's gone for everyone (the owner's bag doesn't get it
  back, same as now).
- Later, if wanted: goals at the stadium or the park pitches counting for whoever scored.
- Size: one and a half to two days, most of it making the hand-over between players smooth.

### Decisions needed before building

1. What a pickpocket takes: cash only, or sometimes an item from the bag? How much cash: a share of what they carry
   (say 10%, at most $50) or a fixed $2-20 like NPCs?
2. Can being run over send you to hospital (and cost the bill), or only knock you down?
3. Peaceful mode: per player only, or also a room-wide switch? And should it replace the friendly-fire toggle (my
   recommendation) or sit alongside it?
4. Soccer balls: can anyone pick up anyone's ball (taking it into their bag), or only its owner (my recommendation)?
