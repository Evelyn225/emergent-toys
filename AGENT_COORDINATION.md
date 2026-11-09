# Current quality work: Codex and Claude

Read this alongside `WORLD_QUALITY.md` (the checklist and the per-chunk notes)
and `corridor-geometry-notes.md`. Do not edit or restore `CLOUD_HANDOFF.md`.

Everything before 2026-10-30, including every chunk's branch, test and timing
log, is in `AGENT_COORDINATION_ARCHIVE.md`. Keep this file to
what the next agent needs: replace stale entries, and move finished detail into
the `WORLD_QUALITY.md` chunk note. Don't let it grow back into a log.

## Who is doing what

- **Codex:** numbered world-quality first passes are implemented through final integration. Coast/islands #472/#477 are merged; main's #478 ghost-sign/step pass is integrated. Pending stack: water/weather #479 → inventory/shop previews #480 → abandoned-ground extension #481 → final tour/cabin weather #482. Merge in order only after each current full CI head is green; do not force-push. The extension leaves main's dressed shops alone and covers 51 other sites. Final coverage and native/timing evidence are in `WORLD_QUALITY.md`. Keep the user's original ASCII hand/rod, yo-yo orientation and restored light fishing splashes. Skating remains separate. UI review (pass34) has all five implementation chunks checked in `UI_REVIEW.md`: shared menus #485 → map #486 → minigames #487 → specialist panels #488 → final notes on `codex/ui-review-integration`. Every branch now includes main9fb23c6 (#483/#484); canonical bundles were regenerated. All56 affected current-tree browser checks and four Node files pass. All updated heads require fresh full green CI before merging in order; old green heads were superseded. Preserve the existing world and skating work.

- **Skating follow-up (Codex):** #467 is merged. `codex/skate-mouse-manual`
  tunes mouse-only manual entry/range and verifies real mouse motion gestures
  as well as simple fallback tricks. Controller pressure, raw gesture samples,
  other world work and reserved files are preserved; see `SKATE_IMPLEMENTATION.md`.
- **Claude:** finished pass 33 (abandoned shopfronts: ghost signs and step dressing on top of Codex's rust, boards and graffiti, `city/abandoned-shop-dressing.js`). Earlier: passes 7 to 13 closed; pass 16's first chunk (road and pavement surfaces, #374) is in. Next: pass 14
  (market streets and the Shotengai's roofs, stalls and frontage), then 15 and the rest of 16. The user cleared Claude to edit facades and lettering. One branch and PR per chunk. Merging after green CI is
  authorised by the user. Another Claude session is working on skate parks, grinding and then ocean waves: check
  open PRs before touching `city/skate*.js`, `city/skatepark*.js` or the sea.
- **Multiplayer (Claude):** branch `multiplayer`, see `MULTIPLAYER_PLAN.md`. Owns `city/net-core.js`, `city/net.js`, `vendor/`; small hooks in `main.js`, `render.js`, `pause.js`, `state.js` (env) and `actions.js` (sleep). Phases 0-3 merged in #509; phases 4-6 (guns, rod hooks, police) on the branch, PR #510.
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
