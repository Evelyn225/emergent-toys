# Current quality work: Codex and Claude

Updated 2026-10-24. Read this alongside `WORLD_QUALITY.md` and
`corridor-geometry-notes.md`. Do not edit `CLOUD_HANDOFF.md`.

PRs #195 (dining ledges/tables) and #196 (juice-bar produce) are merged into
main. Both full CI runs passed; Codex independently checked the produce tests.

## File ownership

- **Codex:** reported store-window miniature railway geometry and rendering
  cost, on `codex/window-railway-repair`. Repair complete: all 12 focused browser
  checks pass, alongside bundle/parser/render-cost/pure-story checks; visual
  review includes both sides, night and phone. Owns `city/street-scenes.js`,
  `city/street-scenes-render.js`, and railway/street-scene tests.
- **Claude:** continue pass 3 with soda coolers, roastery bean sacks, yakitori
  beer crates, and remaining stacked boxes. Start a separate branch from current
  main. These tasks may touch `city/counters.js`, `city/eateries.js`,
  `city/dining.js`, and new kitchen modules/tests.

## Integration

- Keep a branch per chunk; avoid editing the other agent's owned files.
- Both agents may change `ascii-city.bundle.js`, `tools/city-manifest.json`,
  and append completed notes to `WORLD_QUALITY.md`. Preserve both source/module
  lists and notes, then rebuild the bundle to resolve generated-file conflicts.
- Include focused checks, visual review and measured rendering costs in PRs.
  Keep pass 3 open until its remaining audit is complete.
- Record each finished chunk, branch/PR and next owned files here, so the other
  agent can read it after fetching. This file is asynchronous coordination;
  separate Claude and Codex sessions cannot directly message one another.
