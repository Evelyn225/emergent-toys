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
- [ ] sand playground: touch can only add sand (walls, wind, erase, vortex, plants, pause are keyboard/right-click). no resize handler. instructions say scroll = density but it changes brightness
- [ ] ball like: touch can draw but can't drop balls or erase
- [ ] erosion: touch is water only, no rock/sand/delete, no terrain reset, no resize
- [ ] physarum: can't remove food on touch, reset is R only
- [ ] patch synth: 572px wide layout on a 390px phone, module bay covers the rack

## smaller per-toy stuff
- [ ] ascii render: re-renders every 150ms even when paused, "animate" rotates the char ramp (scrambles brightness), mushy letter-heavy ramp. webcam mode would be nice (reuse mosh mirror camera code)
- [x] vornoi was misspelled in the URL and index (now voronoi, old URL redirects)
- [ ] voronoi: can't get wave colors back after randomize, adding points is double-click only
- [ ] magnetic pendulum: x/y scaled separately so portrait phones squish it, always exactly 3 magnets
- [ ] dla crystal: any resize (incl. phone address bar) wipes it, keeps burning CPU after hitting the edge, tap-to-reset is the only interaction
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
