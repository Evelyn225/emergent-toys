# Recorded transit PA

`transit-assets.js` is the central manifest. `phrases` maps utterance IDs to exact original filenames and prepared upload paths; `stations` uses actual station labels (`3RD AVE`, `BLEECKER ST`, etc.). Both train systems resolve the same station entries. All 23 distinct current station labels and all ten supplied phrase/reminder recordings are present: **no missing recordings**.

Original recordings remain untouched in ignored `audio/ascii city/`. Prepared files live in `audio/ascii-city/transit/`: mono, 24 kHz, 16-bit PCM WAV avoids MP3 encoder padding at phrase seams. Inputs use explicit filenames/extensions, including the supplied “Please stand clear…” filename rather than an invented filename for its spoken wording.

Run `node tools/prepare-city-transit.cjs` to regenerate the 33 upload clips from originals. It uses the installed `ffmpeg-static`, accepts its supported input formats, and writes `levels.json` with source SHA-256 hashes, measured loudness/true peak and missing assets. Original sources are local prerequisites for regeneration, not runtime/deployment dependencies.

The current voice treatment follows the requested heavier, more femme PA sound: pitch ratio 1.12 (about two semitones above the original), shifted formants for brighter resonance, preserved tempo, 300–4800 Hz filtering, presence boost, 4:1 compression and soft saturation. Pre-leveling gives the saturation a consistent input; final two-pass normalization targets −20 LUFS with a −3 dBTP ceiling. Only outer silence is trimmed, with consonant margins and tiny fades. The shared runtime PA bus adds a 380–3800 Hz speaker range, 2200 Hz presence and a quiet 22 ms reflection. The profile is a processing choice; perceived voice/gender and intelligibility still merit listening review.

Runtime PA gain is 0.855, a 10% reduction from the previous 0.95 level, before the effects/master controls.

## Triggers and timing

- Subway: boarding preserves the station train's existing cycle while the player chooses a destination. Selection triggers “The next stop is…” plus exactly that destination, without east/west direction messages. The unchanged nine-second journey calls the existing arrival action, which requests “This is…” plus the destination, followed by a belongings reminder when the reminder cooldown permits.
- El: boarding joins “This is an eastbound/westbound train”, “The next stop is”, and the upcoming station into one announcement, using the same short 75 ms seams throughout. It uses `elTrain(...).dir` and `next`, independently of track index, so the player hears the destination on boarding. Departure requests “The next stop is…” plus `next`; arrival requests “This is…” plus `station`. At endpoint arrivals the change in actual direction requests the supplied “This train will now return…” recording. Riders remain aboard through reversals.
- Doors: simulation updates cross a warning threshold four seconds before the existing el departure or subway platform departure. Only the rider or the relevant platform hears it. Boarding inside that window also requests the warning, before the direction phrase. The subway's direct destination selection still begins immediately; speech never adds a waiting period to its nine-second journey.
- Platform arrival can request the supplied passenger-alighting reminder. Reminders share a 60-second simulation cooldown and expire quickly rather than delaying essential speech. The platform-edge recording is mapped and available, without a repetitive automatic loop.
- Platform labels now identify their north/south side rather than promising a permanent direction on a reversing route.

## Playback and cancellation

`transit-audio.js` is a classic DOM script after `audio.js`; the DOM-free asset manifest is in the pure list. Rebuild `ascii-city.bundle.js` with `node tools/build-city.cjs` after source edits.

Existing `clipBuffer()` promises cache fetches, decodes and failures. Transit warms the small voice library on entry after audio unlock. An entire utterance must resolve before any clip starts; unknown, null or unavailable assets skip the complete utterance. The same AudioContext clock schedules connected direction, next-stop and station sources with the existing 75 ms gap and edge envelopes. Complete announcements have a separate two-second pause, including when the queue briefly empties. Ordinary announcements may wait up to eight simulation seconds to accommodate that spacing; warning/reminder expiry and relevance checks still discard stale speech. Cancellation clears the pending pause timer as well as audio sources. A bounded serial queue prevents overlapping utterances. All sources use the shared PA bus into the existing effects bus, master volume, mute and browser audio-unlock behavior.

Location identity and an epoch protect pending async decodes and scheduled sources. Stepping off a stopped el train onto its own platform lets the currently scheduled announcement finish; queued train speech is discarded. Leaving transit, changing to another train/platform/room, loading a save, muting, zeroing master/effects, pause, hidden tabs or freecam cancels speech. Time jumps reset the observation baseline. Resume/unlock starts from current state rather than replaying missed events; a departure occurring on the first resumed frame is still observed. Relevance predicates discard old warnings and next-stop requests. Cancellation stops/disconnects all scheduled clips; only the speaker's tiny reflection tail can remain for at most 22 ms.

## Validation

`test/city-transit-assets.test.cjs` checks exact label coverage, missing-asset behavior, prepared formats and measured levels. `test/browser/city-transit-audio.browser.test.cjs` uses real browser AudioContexts and decoded recordings to check actual actions/frame transitions, east/west boarding, departures, arrivals, both finite-route reversals, resumed departures, relevant platform sides, repeated updates/rendering, ordered precise scheduling, serialization, single fetches, missing HTTP responses, obsolete async loads, mute/volume, pause/freecam/time jumps and save loading. An OfflineAudioContext renders the actual shared PA graph and checks both halves produce finite, unclipped signal.

Automated rendering/signal checks are not listening verification. No subjective listening claim is made. PR validation records the executed checks and results.
