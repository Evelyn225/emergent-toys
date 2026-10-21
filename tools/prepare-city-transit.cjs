'use strict';
// Rebuild only the prepared transit copies; never write to the source recording directory.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ffmpeg = require('ffmpeg-static');
const root = path.resolve(__dirname, '..');
const manifest = vm.runInNewContext(fs.readFileSync(path.join(root, 'city/transit-assets.js'), 'utf8') + '\nTRANSIT_ASSETS');
const report = { targetLUFS: -20, maxTruePeakDB: -3,
  treatment: 'Pitch ratio 1.12 (about +2 semitones) with shifted formants for brighter resonance, 300-4800 Hz, presence, 4:1 compression and soft saturation; final shared PA bus adds narrower speaker colour and a 22 ms reflection.',
  clips: [], missing: [] };
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 8e6 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stderr;
}
function meter(log) {
  return JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
}
for (const [key, asset] of Object.entries({ ...manifest.phrases, ...manifest.stations })) {
  if (!asset.source || !asset.file) { report.missing.push(key); continue; }
  const input = path.join(root, 'audio/ascii city', asset.source);
  if (!fs.existsSync(input)) { report.missing.push(key + ': ' + asset.source); continue; }
  const output = path.join(root, 'audio/ascii-city', asset.file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Trim only leading/trailing room silence, retain consonant margins and all internal pauses.
  // A raised pitch and brighter resonance (original tempo), narrow band, compression and speaker grit are baked
  // into upload copies. The shared in-game bus colours both halves of each utterance together.
  // Trim before compression/saturation raises room tone into the speech detection band.
  const trim = 'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB:start_silence=0.04,' +
    'areverse,silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB:start_silence=0.06,areverse';
  const treatment = 'aformat=channel_layouts=mono,highpass=f=160,' + trim + ',' +
    'rubberband=pitch=1.12:formant=shifted,highpass=f=300,lowpass=f=4800,' +
    'equalizer=f=2200:t=q:w=0.9:g=3,acompressor=threshold=0.035:ratio=4:attack=3:release=90,' +
    'loudnorm=I=-16:TP=-3:LRA=5,volume=6,asoftclip=type=tanh:threshold=0.45:output=0.65';
  const measured = meter(run(['-i', input, '-af', treatment + ',loudnorm=I=-20:TP=-3:LRA=7:print_format=json', '-f', 'null', '-']));
  const norm = `loudnorm=I=-20:TP=-3:LRA=7:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  run(['-y', '-i', input, '-af', treatment + ',' + norm + ',afade=t=in:d=0.008,areverse,afade=t=in:d=0.012,areverse', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', output]);
  const checked = meter(run(['-i', output, '-af', 'loudnorm=I=-20:TP=-3:LRA=7:print_format=json', '-f', 'null', '-']));
  const sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  report.clips.push({ key, ...asset, sourceSha256, lufs: +checked.input_i, truePeakDB: +checked.input_tp });
  console.log(key + ': ' + checked.input_i + ' LUFS, peak ' + checked.input_tp + ' dBTP');
}
fs.writeFileSync(path.join(root, 'audio/ascii-city/transit/levels.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Missing recordings: ' + report.missing.join(', '));
