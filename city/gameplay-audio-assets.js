// Original recordings are local inputs only; runtime copies are normalized, lossless and loop-safe.
const GAMEPLAY_AUDIO = {
  gunshot: { source: 'gunshot.mp3', file: 'gunshot.wav', gain: 1.2 },
  reload: { source: 'Revolver Reload (1.6 seconds).mp3', file: 'revolver-reload.wav', gain: .75 },
  sizzle: { source: 'cooking sizzle (seamless).mp3', file: 'cooking-sizzle.wav', gain: .45, loop: true },
  rotor: { source: 'helicopter-rotor-loop.mp3', file: 'helicopter-rotor.wav', gain: .85, loop: true }
};
