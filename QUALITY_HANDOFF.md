# ASCII City handoff for Claude — 2026-10-23

User requested: wrap up because credits are nearly exhausted, provide a handoff, then Claude continues. Do not start a replacement programme: continue `WORLD_QUALITY.md`, top down, in small tested PRs. User permits pushing/PRs/merging after focused checks while full CI continues. People and Cabin Cove are the visual baseline. Read `corridor-geometry-notes.md`. Do not modify `CLOUD_HANDOFF.md`, unrelated yomi work, or resume the paused presentation agent.

## Already on main

- PR135 reported fixes/furnishings; PR136 furniture/interaction follow-ups.
- PR137 reviewed Claude's soundscape chunks 1–3 (54219ff, 79c1965, 8b52516): merged; full CI green. Pass30 remains open, these are partial chunks.
- PR139 beds/storage, PR142 counters/stools/benches, PR144 booths/shell chairs/round tables/pouffes: merged, full CI green. Shared furniture pass1 is checked. Specialist built-ins/room-specific variants remain in later interior passes.
- PR146 first bathroom chunk: hollow elliptical sinks/toilets/baths, solid plumbing, wall-mounted mirrors, corrected hotel fixture placement. Merged as 07df7b7. Ten focused browser checks and touch check passed. Full CI run39986375335: Node and browser2/3 passed; browser1/4 still in progress when last checked. Do not claim full green yet.
- PR148 integrates Claude's activity stack (#138,#140,#141,#143,#145) with current main, original commits preserved. Merged as e33233e0ac9e8202a825bbeada27531db338e93c. Resolved appended audio-test/checklist conflicts by keeping both streams and rebuilding bundle. 20 combined activity/audio/furniture/bathroom browser checks passed; Node crime/sound-distance/bundle passed; campfire/chimney views inspected. CI run39987428950 still queued/running when last checked. PR138 auto-marked merged; the other four stacked PRs were closed with integration notes because GitHub rejects retargeting a head already included in main. All five original commits ARE on main.

## Current unmerged bathroom chunk

Branch `codex/bathroom-details`, based on current main e33233e; its PR is linked in the final handoff message. Commits fd8de1d (shower/surrounds), c43cffd (merge activity main), plus the final handoff/clearance correction commit.

Changes:
- `city/bathroom-quality.js`: `BATHROOM_SHOWER` with shallow recessed tray/drain, open front, collision-matched clear framed side glass, rear-mounted controls/riser/head and supported shelf/bottle. `bathroomOpenings` discovers actual WC partition gaps; `bathroomSurrounds` fits both faces through wall depth and fills above the lintel.
- `city/hotel-polish.js`: motel uses new shower, fitted to the rear/right partition.
- `city/rooms.js`: `makeRoom` adds shared surrounds to WC rooms.
- `test/browser/city-bathroom-quality.browser.test.cjs`: meaningful rendered recess/mount/collision and all-WC opening checks, in addition to first-chunk tests.
- `WORLD_QUALITY.md`: second bathroom chunk notes. Pass2 deliberately remains unchecked; privacy doors, accessories and remaining layout review are NOT complete. Shower has no new washing interaction. Mirrors use styled glass, not an actual reflected-world render.

Verification before final clearance correction: four bathroom checks passed; all-shop bathroom/clerks/walk routes passed; Fern fitted furniture and all-home amenity checks passed; 390px touch toilet use passed; bundle/render-cost Node checks passed. Front/side/inside motel, both sides bar opening and Fern wide opening screenshots reviewed. Warmed local medians at177x66 cells: motel1.9->2.7ms, bar2.5->3.3ms, Fern3.4->4.0ms; noisy tails, no FPS guarantee.

One hotel amenity check caught the new shower's side screen too close to the motel bathroom doorway's centre route cell. Player continuous movement was possible, but `roomPath`'s 1m-grid route failed for tier0 (all other amenities and tiers passed). Root cause is the GLASS location, not the overhead lintel: `roomOpen` already excludes boxes above1.2m. Final correction parameterizes tray half-width and uses1.2m width (halfWidth=.6) atx=w-1.6 instead of1.4m width atw-1.7, retaining right wall contact and clearing the doorway centre cell. Final targeted hotel/shower checks BOTH PASSED after restarting the HTTP server (an execution transport disconnect had stopped it). Full scene/route checks should be repeated on final dimensions before merging. Do not delete the failing route test or loosen navigation to hide the issue.

## Next work

1. Checkout the bathroom branch. Confirm clean git status, build (`node tools/build-city.cjs`), `node --check ascii-city.bundle.js`, focused bathroom/hotel/all-shop checks. Review final screen position and doorway from both sides, phone/day/night; merge once satisfactory.
2. Watch full CI for PR146 and148 and new bathroom PR. Fix real regressions, keep meaningful tests; don't claim a queued suite passed.
3. Continue pass2: privacy doors, useful mounted accessories, remaining bathroom layouts. Then pass3 kitchens/dining. Do not mark broad checklist rows complete based only on the small chunks.
4. Coordinate with Claude's existing activity work. The five merged activity chunks do not complete pass29; there may be newer open activity PRs after #145 (e.g. #147). Inspect remote refs/PRs before duplicating or overwriting work. Claude continues bottom-up, primary quality work continues top-down.

## Local workspace / verification helpers

Primary `/workspace/emergent-toys`, HTTP8123 (restart with `python -m http.server 8123 --bind 127.0.0.1` if needed). `node --require ./work/browser-local.cjs --test TEST...` uses system `/usr/bin/chromium` and rewrites primary file URLs to HTTP. Browser/server/git network commands need sandbox escalation in this environment. Git push works with `git -c credential.helper='!gh auth git-credential' push ...`. Prefer GitHub connector for PR/CI; gh API is blocked by policy.

Ignored evidence under `work/bathroom-details/`: baseline bundle, review.cjs with before/after screenshots, benchmark.cjs/json, mobile.cjs. Earlier evidence under work/bathrooms/, work/booth-seating/, work/counter-seating/, work/beds-storage/. These are local only, not in git; screenshots may not render through local file links on ChatGPT web, use image-view tool when showing.

Isolated activity review worktree `/workspace/emergent-toys-activity`, branch codex/review-activity, head f81f51b (merged via PR148). Dependency symlink points at primary node_modules; server8126. Combined audio test conflicts already resolved. Don't force push Claude's branches.

Useful checks:
```
node tools/build-city.cjs
node --check ascii-city.bundle.js
node --test test/city-bundle-current.test.cjs test/city-render-costs.test.cjs
node --require ./work/browser-local.cjs --test test/browser/city-bathroom-quality.browser.test.cjs
node --require ./work/browser-local.cjs --test --test-name-pattern='every shop and the rooms' test/browser/ascii-city-shops.browser.test.cjs
node --require ./work/browser-local.cjs --test --test-name-pattern='hotel tiers have reachable' test/browser/city-life-polish.browser.test.cjs
```
