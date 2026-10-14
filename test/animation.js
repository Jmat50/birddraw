// Idle-animation checks: determinism, seamless loop, finite and in-frame
// output, a fold-free breath field, rest pose == static drawing, painter ==
// exact, and per-frame time budgets.
// usage: node test/animation.js [seeds=12] [--no-perf]
const assert = require('assert');
const bd = require('../birddraw.js');

let args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 12);
const PERF = !args.includes('--no-perf');
const BUDGET = {build: 400, exact: 60, ops: 4};
const SCALE = 1;

let seeds = [];
for (let i = 0; i < N; i++) seeds.push(bd.seed_name('anim' + i));
// pure owl, parrot, raptor, wader: pan style, upper lid, teeter paths
seeds.push('Geolonanis rucaica', 'Geolola ruurus', 'Polaphaga auosus', 'Motiornis cancephata', 'Turdus merula');

function inside(poly, p){
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    let [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) != (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Fraction of inked pixels in a that have no ink in b within 1 pixel.
function raster_diff(a, b, w, h, thr = 0.3){
  let n = 0, miss = 0;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      if (a[y*w+x] < thr) continue;
      n++;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++){
        for (let dx = -1; dx <= 1 && !hit; dx++){
          let xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && b[yy*w+xx] >= thr * 0.5) hit = true;
        }
      }
      if (!hit) miss++;
    }
  }
  return n ? miss / n : 0;
}
function sym_diff(a, b){
  let r = bd.raster(a, bd.FRAME_W, bd.FRAME_H, SCALE), s = bd.raster(b, bd.FRAME_W, bd.FRAME_H, SCALE);
  return Math.max(raster_diff(r.ink, s.ink, r.w, r.h), raster_diff(s.ink, r.ink, r.w, r.h));
}

function check_lines(seed, t, ls){
  for (let l of ls){
    for (let p of l){
      assert(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${seed} t=${t}: non-finite point`);
      assert(p[0] >= -1 && p[0] <= bd.FRAME_W + 1 && p[1] >= -1 && p[1] <= bd.FRAME_H + 1,
        `${seed} t=${t}: point ${p} outside the frame`);
    }
  }
}

let worst = {build: 0, exact: 0, ops: 0, rest: 0, painter: 0, jac: Infinity};
let styles = {};
for (let seed of seeds){
  let t0 = Date.now();
  let an = bd.animator(seed);
  let build = Date.now() - t0;
  worst.build = Math.max(worst.build, build);
  let T = an.T;
  styles[an.ap.style + '/' + an.ap.tail_style] = (styles[an.ap.style + '/' + an.ap.tail_style] || 0) + 1;

  // determinism across independent builds
  let an2 = bd.animator(seed);
  for (let t of [0, 1.7, T * 0.61]){
    assert.strictEqual(JSON.stringify(an.frame(t)), JSON.stringify(an2.frame(t)), `${seed}: frame ${t} not deterministic`);
  }

  // seamless loop: same drawing at 0 and T, pose continuous across the seam
  assert.strictEqual(JSON.stringify(an.frame(0)), JSON.stringify(an.frame(T)), `${seed}: frame(0) != frame(T)`);
  let pa = an.pose_at(T - 1e-3), pb = an.pose_at(1e-3);
  for (let k of ['breath', 'yaw', 'pitch', 'roll', 'crest', 'tail', 'teeter']){
    assert(Math.abs(pa[k] - pb[k]) < 0.02, `${seed}: pose.${k} jumps across the loop seam (${pa[k]} vs ${pb[k]})`);
  }

  // finite and inside the frame over a sweep of the loop
  for (let i = 0; i < 8; i++){
    let t = i * T / 8;
    check_lines(seed, t, an.frame(t));
    for (let op of an.ops(t)) check_lines(seed, t, op.fill || op.stroke);
  }

  // breath warp has no folds: det(J) of q -> q + d(q) stays well above 0
  let m = an.A.meta, amp = 0.05, h = 0.05, bo = an.A.body_outline;
  let bb = bd.get_bbox(bo);
  for (let i = 0; i <= 24; i++){
    for (let j = 0; j <= 24; j++){
      let q = [bb.x + bb.w * i / 24, bb.y + bb.h * j / 24];
      if (!inside(bo, q)) continue;
      let dx0 = bd.breath_disp(m, [q[0] - h, q[1]], amp), dx1 = bd.breath_disp(m, [q[0] + h, q[1]], amp);
      let dy0 = bd.breath_disp(m, [q[0], q[1] - h], amp), dy1 = bd.breath_disp(m, [q[0], q[1] + h], amp);
      let jxx = 1 + (dx1[0] - dx0[0]) / (2*h), jxy = (dy1[0] - dy0[0]) / (2*h);
      let jyx = (dx1[1] - dx0[1]) / (2*h), jyy = 1 + (dy1[1] - dy0[1]) / (2*h);
      let det = jxx * jyy - jxy * jyx;
      worst.jac = Math.min(worst.jac, det);
      assert(det > 0.5, `${seed}: breath field Jacobian ${det.toFixed(3)} at ${q}`);
    }
  }

  // rest pose with no margin and open eyes reproduces the static drawing
  let an0 = bd.animator(seed, {margin: 0});
  let rest = Object.assign(an0.rest_pose(), {lid: 0});
  let still = bd.main(seed);
  let d_rest = sym_diff(an0.frame_pose(rest), still);
  worst.rest = Math.max(worst.rest, d_rest);
  assert(d_rest < 0.005, `${seed}: rest pose differs from static drawing by ${(d_rest*100).toFixed(2)}%`);

  // painter's algorithm draws what exact hidden-line removal draws
  for (let t of [0.4, T * 0.5]){
    let d = sym_diff(an.frame(t), an.ops(t));
    worst.painter = Math.max(worst.painter, d);
    assert(d < 0.005, `${seed} t=${t}: painter differs from exact by ${(d*100).toFixed(2)}%`);
  }

  if (PERF){
    let n = 6, te = Date.now();
    for (let i = 0; i < n; i++) an.frame(i * T / n);
    let exact = (Date.now() - te) / n;
    let to = Date.now();
    for (let i = 0; i < n * 4; i++) an.ops(i * T / (n * 4));
    let ops = (Date.now() - to) / (n * 4);
    worst.exact = Math.max(worst.exact, exact);
    worst.ops = Math.max(worst.ops, ops);
  }
}

console.log(`ok: ${seeds.length} seeds; deterministic, seamless, finite, in frame`);
console.log(`breath Jacobian min ${worst.jac.toFixed(3)}; rest-vs-static ${(worst.rest*100).toFixed(2)}%; painter-vs-exact ${(worst.painter*100).toFixed(2)}%`);
console.log('motion styles:', styles);
if (PERF){
  console.log(`worst: build ${worst.build} ms, exact frame ${worst.exact.toFixed(1)} ms, ops frame ${worst.ops.toFixed(1)} ms`);
  for (let k in BUDGET){
    assert(worst[k] < BUDGET[k], `${k} took ${worst[k]} ms (budget ${BUDGET[k]} ms)`);
  }
}
