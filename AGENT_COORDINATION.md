# Current quality work: Codex and Claude

Read this alongside `WORLD_QUALITY.md` (the checklist and the per-chunk notes)
and `corridor-geometry-notes.md`. Do not edit or restore `CLOUD_HANDOFF.md`.

Everything before 2026-10-30, including every chunk's branch, test and timing
log, is in `AGENT_COORDINATION_ARCHIVE.md`. Keep this file to
what the next agent needs: replace stale entries, and move finished detail into
the `WORLD_QUALITY.md` chunk note. Don't let it grow back into a log.

## Who is doing what

- **Codex:** paused at #344 to conserve weekly usage. Not expected to pick up
  without the user saying so; if it does, check open PRs first.
- **Claude:** pass 9 civic interiors: gym, laundry, storage, then museum. One
  branch and PR per chunk. Merging after green CI is authorised by the user.
- **Reserved, don't edit without agreement:** `city/bathroom-quality.js`, DINER,
  `city/world-bootstrap.js`, facade and global lettering.

## Working rules

- One branch and PR per chunk, from current `origin/main`. `main` itself is
  checked out in another worktree.
- Native geometry and interaction checks, plus isolated mutations that make them
  fail. Review close, wide, oblique and night views. Time serial ABAB against
  exact main at 177x66 (viewport width 1170); record it as local observations,
  not an FPS guarantee.
- Preserve both agents' `WORLD_QUALITY.md` notes and manifest entries. Rebuild
  with `node tools/build-city.cjs`, never hand-merge `ascii-city.bundle.js`.

## Known local test failures

Both pass in CI and depend on the character grid rather than on the game:

- `city-jail-guard-desk` 'desk appears from the legal jail cell'.
- `city-home-french-doors` 'native room and city render the open leaves...':
  passes at viewport 1170x800 and 1400x800, fails at 1100x800 and at its default
  1280x720 under Windows. The door head is drawn in every case.
