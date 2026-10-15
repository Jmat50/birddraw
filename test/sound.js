// Voice checks: deterministic schedule and audio, seamless loop, sane
// acoustics per archetype, the singing beak (gape) and its rendering, channel
// independence, WAV bytes, and a render budget.
// usage: node test/sound.js [seeds=12] [--no-perf]
const assert = require('assert');
const bd = require('../birddraw.js');

let args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 12);
const PERF = !args.includes('--no-perf');
const BUDGET = 250;
const SR = 44100;

// one unmixed seed per archetype
const PURE = {
  finch: 'Saxlirhynchus pugaatus', sparrow: 'Hyops flaceata', warbler: 'Vies bigaens', thrush: 'Myornis pergaa',
  corvid: 'Chlocorhynchus auphanoonotus', raptor: 'Sturcodroax erylois', parrot: 'Neniola fuscaans',
  kingfisher: 'Anda viatus', owl: 'Picaca aloides', swallow: 'Tyrhynchus triens', wader: 'Phynaops canceps',
};
// spectral peak (kHz) bands, and which voices must read as tonal or noisy
const BAND = {
  finch: [2, 6], sparrow: [1.5, 5], warbler: [3, 8], thrush: [1.5, 5], corvid: [0.5, 2.5], raptor: [1.5, 4.5],
  parrot: [1, 4.5], kingfisher: [1.5, 6], owl: [0.2, 1.2], swallow: [1.5, 7], wader: [0.8, 3],
};
const TONAL = ['finch', 'warbler', 'thrush', 'owl', 'wader'], NOISY = ['corvid', 'raptor', 'kingfisher'];

function fft(re, im){
  let n = re.length;
  for (let i = 1, j = 0; i < n; i++){
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j){ [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1){
    let a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len){
      for (let j = 0; j < len / 2; j++){
        let wr = Math.cos(a * j), wi = Math.sin(a * j), k = i + j + len / 2;
        let vr = re[k] * wr - im[k] * wi, vi = re[k] * wi + im[k] * wr;
        re[k] = re[i + j] - vr; im[k] = im[i + j] - vi;
        re[i + j] += vr; im[i + j] += vi;
      }
    }
  }
}

// median spectral peak and Wiener entropy (log of geometric / arithmetic mean
// power, SAP convention) over frames that are sounding
function acoustics(x, sr){
  let W = 1024, peaks = [], wes = [], gmax = 0;
  for (let v of x) gmax = Math.max(gmax, Math.abs(v));
  for (let s = 0; s + W <= x.length; s += W / 2){
    let re = new Float64Array(W), im = new Float64Array(W), e = 0;
    for (let i = 0; i < W; i++){ re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / W)); e += re[i] * re[i]; }
    if (Math.sqrt(e / W) < gmax * 0.05) continue;
    fft(re, im);
    let lo = Math.ceil(300 * W / sr), hi = Math.floor(10000 * W / sr), pm = 0, pk = lo, sp = 0, lg = 0, n = 0;
    for (let b = lo; b <= hi; b++){
      let p = re[b] * re[b] + im[b] * im[b] + 1e-12;
      if (p > pm){ pm = p; pk = b; }
      sp += p; lg += Math.log(p); n++;
    }
    peaks.push(pk * sr / W);
    wes.push(lg / n - Math.log(sp / n));
  }
  let med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
  return {peak: med(peaks), we: med(wes)};
}

function check_lines(seed, ls){
  for (let l of ls) for (let p of l){
    assert(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${seed}: non-finite point`);
    assert(p[0] >= -1 && p[0] <= bd.FRAME_W + 1 && p[1] >= -1 && p[1] <= bd.FRAME_H + 1, `${seed}: point ${p} outside the frame`);
  }
}

function raster_diff(a, b, w, h, thr = 0.3){
  let n = 0, miss = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    if (a[y*w+x] < thr) continue;
    n++;
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++){
      let xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && b[yy*w+xx] >= thr * 0.5) hit = true;
    }
    if (!hit) miss++;
  }
  return n ? miss / n : 0;
}
function sym_diff(a, b){
  let r = bd.raster(a, bd.FRAME_W, bd.FRAME_H, 1), s = bd.raster(b, bd.FRAME_W, bd.FRAME_H, 1);
  return Math.max(raster_diff(r.ink, s.ink, r.w, r.h), raster_diff(s.ink, r.ink, r.w, r.h));
}

let seeds = Object.values(PURE);
for (let i = 0; i < N; i++) seeds.push(bd.seed_name('song' + i));

let worst = {render: 0, rest: 0, painter: 0}, gapes = {};
let sing = bd.parse_moves('+sing');
for (let seed of seeds){
  let an = bd.animator(seed, {moves: sing}), T = an.T, song = an.song;

  // schedule: deterministic, in the loop, never overlapping itself across the seam
  let an2 = bd.animator(seed);
  assert.strictEqual(JSON.stringify(song.notes), JSON.stringify(an2.song.notes), `${seed}: song schedule not deterministic`);
  assert(song.utts.length >= 1 && song.notes.length >= 1, `${seed}: no utterance in the loop`);
  let u = song.utts;
  for (let i = 0; i < u.length; i++){
    assert(u[i].t0 >= 0 && u[i].t0 < T, `${seed}: utterance onset ${u[i].t0} outside [0, T)`);
    let next = i + 1 < u.length ? u[i + 1].t0 : u[0].t0 + T;
    assert(u[i].t1 <= next, `${seed}: utterance ${i} overlaps the next one`);
  }
  let busy = u.reduce((a, v) => a + v.t1 - v.t0, 0);
  assert(busy <= 0.6 * T, `${seed}: voice sounds for ${(busy/T*100).toFixed(0)}% of the loop`);

  // audio: deterministic, finite, normalised, seamless
  let t0 = process.hrtime.bigint();
  let x = an.audio(SR);
  worst.render = Math.max(worst.render, Number(process.hrtime.bigint() - t0) / 1e6);
  assert.strictEqual(x.length, Math.round(T * SR), `${seed}: audio length`);
  let y = an2.audio(SR);
  assert(x.every((v, i) => v === y[i]), `${seed}: audio not deterministic`);
  let pk = 0, step = 0;
  for (let i = 0; i < x.length; i++){
    assert(Number.isFinite(x[i]), `${seed}: non-finite sample`);
    pk = Math.max(pk, Math.abs(x[i]));
    if (i) step = Math.max(step, Math.abs(x[i] - x[i - 1]));
  }
  assert(pk > 0.1 && pk <= 0.81, `${seed}: peak ${pk}`);
  assert(Math.abs(x[0] - x[x.length - 1]) <= step, `${seed}: click at the loop seam`);

  // acoustics of the unmixed archetypes
  let arch = Object.keys(PURE).find(k => PURE[k] == seed);
  if (arch){
    let ac = acoustics(x, SR), [lo, hi] = BAND[arch];
    assert(ac.peak >= lo * 1000 && ac.peak <= hi * 1000, `${seed} (${arch}): spectral peak ${(ac.peak/1000).toFixed(2)} kHz outside ${lo}-${hi}`);
    if (TONAL.includes(arch)) assert(ac.we < -9, `${seed} (${arch}): Wiener entropy ${ac.we.toFixed(1)}, expected tonal`);
    if (NOISY.includes(arch)) assert(ac.we > -8, `${seed} (${arch}): Wiener entropy ${ac.we.toFixed(1)}, expected noisy`);
  }

  // the sing channel only adds the gape; every other channel is unchanged
  let pa = an2.pose_at(0.5), pr = an2.rest_pose();
  assert.deepStrictEqual(Object.keys(an.pose_at(0.5)), Object.keys(pr), `${seed}: pose_at and rest_pose field order differ`);
  for (let t of [0.3, 1.9, T * 0.71]){
    let a = an.pose_at(t), b = an2.pose_at(t);
    assert.strictEqual(b.gape, 0, `${seed}: gape without the sing channel`);
    for (let k in b) if (k != 'gape') assert.strictEqual(a[k], b[k], `${seed}: sing changes pose.${k}`);
  }

  // gape: opens on notes, continuous across the seam, shut between utterances
  let gm = 0, tm = 0;
  for (let k = 0; k < 1500; k++){
    let g = an.pose_at(k * T / 1500).gape;
    if (g > gm){ gm = g; tm = k * T / 1500; }
  }
  assert(gm > 2 * Math.PI / 180, `${seed}: beak barely opens (${(gm*180/Math.PI).toFixed(1)} deg)`);
  assert(gm < 40 * Math.PI / 180, `${seed}: beak opens ${(gm*180/Math.PI).toFixed(1)} deg`);
  assert(Math.abs(an.pose_at(T - 1e-4).gape - an.pose_at(1e-4).gape) < 0.02, `${seed}: gape jumps across the seam`);
  if (u.length > 1){
    let tq = (u[0].t1 + u[1].t0) / 2;
    if (u[1].t0 - u[0].t1 > 0.3) assert.strictEqual(an.pose_at(tq).gape, 0, `${seed}: beak open between utterances`);
  }
  // voice() without the rig gives the same song; the one-shot clip is the first utterance
  let vo = bd.voice(seed);
  assert.strictEqual(JSON.stringify(vo.song.notes), JSON.stringify(song.notes), `${seed}: voice() differs from animator`);
  let clip = vo.clip(SR), span = u[0].t1 - u[0].t0;
  assert.strictEqual(clip.length, Math.round((span + 0.35) * SR), `${seed}: clip length`);
  let cpk = 0;
  for (let v of clip){ assert(Number.isFinite(v), `${seed}: non-finite clip sample`); cpk = Math.max(cpk, Math.abs(v)); }
  assert(cpk > 0.1 && cpk <= 0.81, `${seed}: clip peak ${cpk}`);
  assert(Math.abs(clip[0]) < 1e-3, `${seed}: clip starts mid-sound`);

  let ar = Object.keys(PURE).find(k => PURE[k] == seed);
  if (ar) gapes[ar] = Math.round(gm * 180 / Math.PI);

  // open beak: in frame, painter matches exact; closed sing rig matches the static drawing
  check_lines(seed, an.frame(tm));
  let d = sym_diff(an.frame(tm), an.ops(tm));
  worst.painter = Math.max(worst.painter, d);
  assert(d < 0.005, `${seed}: painter differs from exact at full gape by ${(d*100).toFixed(2)}%`);
  let an0 = bd.animator(seed, {moves: sing, margin: 0});
  let dr = sym_diff(an0.frame_pose(Object.assign(an0.rest_pose(), {lid: 0})), bd.main(seed));
  worst.rest = Math.max(worst.rest, dr);
  assert(dr < 0.005, `${seed}: closed singing rig differs from static drawing by ${(dr*100).toFixed(2)}%`);
}

// WAV bytes
let pcm = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
let wav = bd.wav_encode(pcm, 8000), dv = new DataView(wav.buffer);
let tag = o => String.fromCharCode(...wav.slice(o, o + 4));
assert(tag(0) == 'RIFF' && tag(8) == 'WAVE' && tag(12) == 'fmt ' && tag(36) == 'data', 'WAV chunk tags');
assert.strictEqual(wav.length, 44 + pcm.length * 2);
assert.strictEqual(dv.getUint32(24, true), 8000);
assert.deepStrictEqual([1, 2, 3, 4, 5].map(i => dv.getInt16(44 + i*2, true)), [16384, -16383, 32767, -32767, 32767]);

console.log(`ok: ${seeds.length} seeds; deterministic, seamless, in-band, channel-independent`);
console.log(`max gape (deg):`, gapes);
console.log(`closed-rig-vs-static ${(worst.rest*100).toFixed(2)}%; painter-vs-exact at full gape ${(worst.painter*100).toFixed(2)}%`);
if (PERF){
  console.log(`worst audio render ${worst.render.toFixed(0)} ms for 6 s at ${SR} Hz`);
  assert(worst.render < BUDGET, `audio render took ${worst.render} ms (budget ${BUDGET} ms)`);
}
