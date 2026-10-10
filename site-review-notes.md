# site review notes (2026-10-10)

Running list of what needs updating across the toys. Check things off as they land.

## bug hotline (`critters.html`, `api/bug-chat.js`)
- [x] bugs have no memory: the API ignored `conversationHistory`
- [x] endpoint was an open LLM proxy: client `bugType` went straight into the system prompt, `CORS: *`, no length caps
- [x] OPTIONS preflight returned 400 (body validated before the CORS branch)
- [x] model was hardcoded to `gpt-4o-mini` (now `BUG_CHAT_MODEL` env, same default)
- [x] can send again mid-reply; messages interleave and the typing indicator breaks
- [x] no way to switch bugs without refreshing
- [x] broken image icon when Unsplash fails
- [x] on phones the chat and input are below the fold
- [x] spider / centipede searched as "insect"
- [x] local `server.cjs` had its own copy of the bug-chat logic and served `/api/*.js` source as static files before the API routes
- [ ] no rate limiting (would need a store like Vercel KV / Upstash)

## needs touch controls (desktop-only right now)
- [x] sand playground: tool bar (sand, plants, wind, walls, erase, vortex, pause) for touch and mouse, resizes keep the sand, the floor sits above the tool bar, and the colour button works on phones (taps on it used to be swallowed). the scroll note was wrong: that slider is brightness and density together
- [x] ball like: draw / drop ball / erase tool bar
- [x] erosion: water / rock / sand / delete tool bar, new terrain button, rebuilds on real resizes
- [x] physarum: on touch, tap food to remove it, tap elsewhere to add, reset button
- [x] patch synth: every control was mouse-only (knobs, cables, keys, moving modules), and on phones the page overflowed and couldn't scroll. now pointer events throughout, the rack scrolls sideways in its own strip, the module bay scrolls away, touch gestures for unplugging/moving cables, knob double-tap reset

## smaller per-toy stuff
- [x] patch synth visuals: jacks along the bottom of each module, colour stripe per module family, real font (Satoshi was never loaded), empty rack space styled as a bay, rack centred, rack no longer cut off at 980-1250px widths, hint wraps
- [x] ascii render: renders only on change (was every 150ms, even paused), bright maps to dense (was inverted), aspect-corrected (was stretched ~1.4x), proper ramps (classic / detailed / blocks), contrast + auto-levels, invert, shimmer instead of the ramp rotation, webcam mode, paste and drop anywhere, save .txt, phone layout, background rain at 20fps and truly off when off
- [x] vornoi was misspelled in the URL and index (now voronoi, old URL redirects)
- [ ] voronoi: can't get wave colors back after randomize, adding points is double-click only
- [x] magnetic pendulum: one scale for both axes, no more squish
- [ ] magnetic pendulum: always exactly 3 magnets
- [x] dla crystal: resizes keep the crystal, stops once fully grown
- [ ] dla crystal: tap-to-reset is the only interaction
- [ ] morse: any key (incl. cmd/ctrl combos) fires a tone. ideas: text-to-morse playback, adjustable speed
- [ ] poker palace: on phones the bankroll/stats panel sits above the table

## site-wide
- [x] sitemap listed 3 pages that don't exist (birds, word-sigil, audio-sampler) and was missing physarum, magnetic pendulum, dla crystal
- [x] favicons, home button, backgrounds, manifest and catch sounds loaded from raw.githubusercontent.com instead of the site
- [x] `site.webmanifest` icon pointed at a nonexistent `public/images/` path and had no name
- [ ] sleepOS still pulls its fonts and wallpapers from raw.githubusercontent.com (`os/os.css`, `os/registry.js`, `apps/browser.js`). left alone for now since wallpaper URLs get persisted into users' saved filesystems and the bundle needs a rebuild
- [x] only index / sleepOS / mosh mirror had a meta description, only index and sleepOS had Open Graph tags, so most toy links unfurled blank. every toy now has a description, OG/Twitter tags and a real 1200x630 screenshot in `images/previews/`
- [x] sleepOS preview pointed at `images/sleep-os-preview.png`, which doesn't exist
- [ ] tablecloth, wave collapse and the best emoji are in the sitemap but not linked from the index. lissajous was in the same spot and got pulled from the sitemap
- [ ] previews are static screenshots; retake them when a toy's look changes a lot
