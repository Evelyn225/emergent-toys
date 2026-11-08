# Multiplayer plan (v1.5: presence + chat + rides + guns + hooks + shared police)

Sketch, not a spec. Line refs are to `city/` as of this writing.

## Status

- **Done (branch `multiplayer`)**: phases 0-2. `city/net-core.js` (pure: checks, smoothing, rules), `city/net.js` (transports,
  drawing, chat, clock, menu), `vendor/trystero.js` (Trystero 0.26.0 bundled). Esc -> Multiplayer to join; T or Enter to chat;
  `?room=code` invite links; `?net=local` for two tabs on one machine. Other players are drawn on foot or as a car
  (a picture only: no riding or collisions yet). Tests: `test/city-net.test.cjs`, `test/browser/ascii-city-net.browser.test.cjs`.
- **Not verified**: real Trystero connections between two machines (the dev sandbox can't reach the Nostr relays).
  Needs a manual test on two networks.
- **Release order (feature flags, `NET_FEATURES` in `city/net-core.js`)**: release 1 is **ghosts only**: other players
  on foot and in cars, name tags, wanted stars, join/leave lines. `chat` and `clock` are built and tested but off; turn
  one on by flipping its flag (try them first with `?netfeatures=chat,clock`). Each later phase lands behind its own flag
  (`rides`, `guns`, `hooks`, `police`), off until it's been tried with real players. The set of switched-on features is part
  of the build fingerprint, so players with different sets get the "different version" message instead of half-working.
- **Next**: get release 1 tried on two real machines, then switch on `chat`, then `clock`, then build phase 3 (shared
  vehicles + riding), then 4-6.
- **Decided while building**: a follower's clock is set to the keeper's on every sync (both run the same clock between
  syncs, so the step is tiny). A player who goes quiet for 8 s is hidden, not dropped: only the transport saying they
  left removes them, so a tab that was in the background comes back. A background tab gets no animation frames, so
  `net.js` keeps sending, listening and running the shared clock on a 250 ms timer while `document.hidden`. In a room,
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
