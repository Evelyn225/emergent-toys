'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ffmpeg = require('ffmpeg-static');
const root = path.resolve(__dirname, '..'), rate = 24000;
const assets = vm.runInNewContext(fs.readFileSync(path.join(root, 'city/gameplay-audio-assets.js'), 'utf8') + '\nGAMEPLAY_AUDIO');
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 20e6 });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result;
}
function meter(args) {
  const log = run([...args, '-af', 'loudnorm=I=-20:TP=-3:LRA=7:print_format=json', '-f', 'null', '-']).stderr.toString();
  return JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
}
function wav(samples) {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  return out;
}
const report = { targetLUFS: -20, sampleRate: rate, clips: [] };
for (const [key, asset] of Object.entries(assets)) {
  const input = path.join(root, 'audio/ascii city', asset.source), output = path.join(root, 'audio/ascii-city', asset.file);
  // Preserve the shot transient and reload timing; loops receive no fades at their wrap point.
  const treatment = key === 'reload' ? 'aformat=channel_layouts=mono,acompressor=threshold=0.035:ratio=3:attack=3:release=50,alimiter=limit=0.1:level=false:latency=true,apad=whole_dur=1.6,atrim=duration=1.6' : 'aformat=channel_layouts=mono';
  const peak = asset.loop ? -6 : -3;
  const log = run(['-i', input, '-af', treatment + `,loudnorm=I=-20:TP=${peak}:LRA=7:print_format=json`, '-f', 'null', '-']).stderr.toString();
  const measured = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const norm = `loudnorm=I=-20:TP=${peak}:LRA=7:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  const raw = run(['-i', input, '-af', treatment + ',' + norm, '-ar', String(rate), '-ac', '1', '-f', 'f32le', '-']).stdout;
  const samples = Float32Array.from({ length: raw.length / 4 }, (_, i) => raw.readFloatLE(i * 4));
  let prepared = samples, seamSamples = 0;
  if (asset.loop) {
    seamSamples = Math.round(.12 * rate);
    // Body followed by an equal-power tail/head crossfade. The wrap returns to the
    // sample immediately after this head, preserving continuity without MP3 padding.
    prepared = new Float32Array(samples.length - seamSamples);
    prepared.set(samples.subarray(seamSamples, samples.length - seamSamples));
    for (let i = 0; i < seamSamples; i++) {
      const phase = i / seamSamples * Math.PI / 2;
      prepared[prepared.length - seamSamples + i] = samples[samples.length - seamSamples + i] * Math.cos(phase) + samples[i] * Math.sin(phase);
    }
  }
  fs.writeFileSync(output, wav(prepared));
  let checked = meter(['-i', output]);
  // Meter the actual stitched PCM too; reserve true-peak headroom over forcing a
  // highly percussive loop to the loudness target. This gain does not change its seam.
  const correction = Math.min(-20 - +checked.input_i, -3 - +checked.input_tp);
  if (Math.abs(correction) > .05) {
    const gain = 10 ** (correction / 20);
    fs.writeFileSync(output, wav(prepared.map(sample => sample * gain)));
    checked = meter(['-i', output]);
  }
  report.clips.push({ key, ...asset, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
    duration: prepared.length / rate, seamSamples, lufs: +checked.input_i, truePeakDB: +checked.input_tp });
  console.log(key + ': ' + checked.input_i + ' LUFS, ' + (prepared.length / rate).toFixed(3) + ' s');
}
fs.writeFileSync(path.join(root, 'audio/ascii-city/gameplay-levels.json'), JSON.stringify(report, null, 2) + '\n');
