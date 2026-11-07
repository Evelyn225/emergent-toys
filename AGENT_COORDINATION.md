# Current quality work: Codex and Claude

Read this alongside `WORLD_QUALITY.md` (the checklist and the per-chunk notes)
and `corridor-geometry-notes.md`. Do not edit or restore `CLOUD_HANDOFF.md`.

Everything before 2026-10-30, including every chunk's branch, test and timing
log, is in `AGENT_COORDINATION_ARCHIVE.md`. Keep this file to
what the next agent needs: replace stale entries, and move finished detail into
the `WORLD_QUALITY.md` chunk note. Don't let it grow back into a log.

## Who is doing what

- **Codex:** continue autonomously between phases. User rejected smooth held hand/rod work on 5 November local date; the original hand/rod are restored on corrected tools #446, curios #447 and final sizes #449. #448 is closed. Native held/extended yo-yo views confirm its orientation was unchanged. Preserve that ASCII style; avoid large smooth canvas silhouettes. On 6 November the user also preferred the earlier light ASCII fishing splashes: those strokes are restored, with minimum projected ring size, extra far contrast and a slightly wider far bite cue (#451). Pass 27 is complete. Pass 29 smoke/fire/fireworks is #450; world fishing, damage and sports feedback is #451 (with the user’s splash-style correction), with native/control/mutation checks. Workshop state/materials on `codex/workshop-state-surfaces` complete pass 29 (native bounds/labels/motion/materials plus controls, mutations and ABAB reviewed). Next: pass 30 sound occlusion and closing sound audit, then 31–32 and abandoned shopfronts (33). CI found a hidden developer-panel key handoff issue; commit 368828d fixes it and adds a failing-before browser regression, integrated into all corrected heads. Full CI is queued; merge corrected heads only after green CI. Skating stays separately tracked.
- **Skating follow-up (Codex):** #467 is merged. `codex/skate-mouse-manual`
  tunes mouse-only manual entry/range and verifies real mouse motion gestures
  as well as simple fallback tricks. Controller pressure, raw gesture samples,
  other world work and reserved files are preserved; see `SKATE_IMPLEMENTATION.md`.
- **Claude:** finished pass 33 (abandoned shopfronts: ghost signs and step dressing on top of Codex's rust, boards and graffiti, `city/abandoned-shop-dressing.js`). Earlier: passes 7 to 13 closed; pass 16's first chunk (road and pavement surfaces, #374) is in. Next: pass 14
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
