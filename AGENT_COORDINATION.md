# Current quality work: Codex and Claude

Read this alongside `WORLD_QUALITY.md` (the checklist and the per-chunk notes)
and `corridor-geometry-notes.md`. Do not edit or restore `CLOUD_HANDOFF.md`.

Everything before 2026-10-30, including every chunk's branch, test and timing
log, is in `AGENT_COORDINATION_ARCHIVE.md`. Keep this file to
what the next agent needs: replace stale entries, and move finished detail into
the `WORLD_QUALITY.md` chunk note. Don't let it grow back into a log.

## Who is doing what

- **Codex:** subway pass 22 and the video-store follow-ups are merged. Current pass 27 chunk (`codex/held-food-surfaces`) converts 20 grocery/produce and 24 cooked-meal pictures to solid colour, preserving printed labels, bites, portions and cooking quality. Solid picture cells now meet the fingers independently of font metrics; soup lowers inside its bowl. The legacy ceiling-ownership regression now recognizes the seven fitted station lamps. Remaining in pass 27: bought/street foods and drinks, tools/weapons/fishing gear, curios/electronics and item-specific model/size follow-ups, then 29–32 and abandoned shopfronts (33). See `WORLD_QUALITY.md`; skating stays separately tracked.
- **Claude:** passes 7 to 13 closed; pass 16's first chunk (road and pavement surfaces, #374) is in. Next: pass 14
  (market streets and the Shotengai's roofs, stalls and frontage), then 15 and the rest of 16. The user cleared Claude to edit facades and lettering. One branch and PR per chunk. Merging after green CI is
  authorised by the user. Another Claude session is working on skate parks, grinding and then ocean waves: check
  open PRs before touching `city/skate*.js`, `city/skatepark*.js` or the sea.
- **Reserved, don't edit without agreement:** `city/bathroom-quality.js`, DINER,
  `city/world-bootstrap.js`. (Facades and lettering: released to Claude by the user, 2 November.)

## Working rules

- One branch and PR per chunk, from current `origin/main`. `main` itself is
  checked out in another worktree.
- Native geometry and interaction checks, plus isolated mutations that make them
  fail. Review close, wide, oblique and night views. Time serial ABAB against
  exact main at 177x66 (viewport width 1170); record it as local observations,
  not an FPS guarantee.
- Preserve both agents' `WORLD_QUALITY.md` notes and manifest entries. Rebuild
  with `node tools/build-city.cjs`, never hand-merge `ascii-city.bundle.js`.
