// Same seed -> byte-identical SVG; no NaN coordinates; each bird under 3 s.
const assert = require('assert');
const bd = require('../birddraw.js');

const N = Number(process.argv[2] || 50);
const LIMIT_MS = 3000;

let worst = 0, total = 0;
let archetypes = {};
for (let i = 0; i < N; i++){
  let seed = bd.seed_name('test' + i);

  let t0 = Date.now();
  let a = bd.main(seed);
  let ms = Date.now() - t0;
  worst = Math.max(worst, ms);
  total += ms;

  let b = bd.main(seed);
  assert.strictEqual(bd.draw_svg(a), bd.draw_svg(b), `seed "${seed}" is not deterministic`);

  assert(a.length > 50, `seed "${seed}" produced only ${a.length} polylines`);
  for (let l of a){
    for (let p of l){
      assert(Number.isFinite(p[0]) && Number.isFinite(p[1]), `seed "${seed}" has a non-finite point`);
      assert(p[0] >= -1 && p[0] <= bd.FRAME_W + 1 && p[1] >= -1 && p[1] <= bd.FRAME_H + 1, `seed "${seed}" draws outside the frame`);
    }
  }
  assert(ms < LIMIT_MS, `seed "${seed}" took ${ms} ms`);

  let arch = bd.main.last_params ? bd.main.last_params.archetype : null;
  if (arch) archetypes[arch] = (archetypes[arch] || 0) + 1;
}

console.log(`ok: ${N} seeds, deterministic, finite, in frame; mean ${Math.round(total/N)} ms, worst ${worst} ms`);
if (Object.keys(archetypes).length) console.log('archetypes:', archetypes);
