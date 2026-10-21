# Recorded gameplay effects

`gameplay-audio-assets.js` maps the four supplied originals under ignored `audio/ascii city/` to upload copies under `audio/ascii-city/`. The originals are unchanged. Run `node tools/prepare-city-gameplay-audio.cjs` to regenerate the mono 24 kHz PCM WAVs and `gameplay-levels.json` (source hashes, durations, loudness and true peak). These effects use their original pitch; the transit voice treatment does not apply to them.

- `gunshot.wav`: player and police gunfire, with existing volume/pan inputs and distance/indoor filtering. Shooting rules, dry fire, near misses and screams retain their existing behavior.
- `revolver-reload.wav`: successful reload only, fitted to the existing 1.6-second action. Holstering/canceling a reload stops its recording.
- `cooking-sizzle.wav`: one loop for the current cooking game, driven by its existing heat state above the existing sizzle threshold. Cooling, serving or aborting stops it; repeated sizzle events do not layer copies. Other cooking cues remain.
- `helicopter-rotor.wav`: a shared buffer for the police helicopter and active player/abandoned helicopters. Actual rotor speed controls pitch/level; distance, listener height, pan and indoor muffling control nearby sound. Parked, destroyed, ditched or out-of-range craft do not drone indefinitely. Exiting the player helicopter stops its active loop; no flight mechanics or rotor physics were changed.

Processing targets −20 LUFS while preserving a −3 dBTP ceiling; the high-crest reload/rotor remain about 0.5–0.7 LU below target to retain peak headroom. The looping assets use a 120 ms equal-power tail/head join and PCM encoding, avoiding MP3 padding and a fade-to-silence at every wrap.

`gameplay-audio.js` preloads through the existing promise/buffer cache after audio unlock. Gun events play immediately if decoded, using their old synthesized sounds until the recording is available. A late load never replays a past shot/reload. Loop creation reads current state on the audio update, so a completed activity cannot start after a delayed load. All recorded voices use the existing effects/master buses and settings. Pause, mute, zero master/effects, freecam, hidden tabs and save loading stop/disconnect voices; normal state changes use a tiny release. One-shot count is bounded.

The assets manifest is DOM-free; playback loads after `audio.js` in `tools/city-manifest.json`. Rebuild `ascii-city.bundle.js` after source edits. The asset and browser tests verify levels/encoding, reload duration, real gun/cooking/flight actions, state cleanup, cache reuse, delayed loads, spatialization, indoor muffling and sample-exact loop repetition. Automated signal/playback checks are not subjective listening verification.
