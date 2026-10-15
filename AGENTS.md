# AGENTS.md

Procedural perched-bird line drawings for pen plotters, adapted from fishdraw, with an optional idle animation.

## Layout
- `birddraw.js`: everything (single file, zero dependencies, runs in Node and as a browser `<script>`). Sections: vendored fishdraw kernel → bird parts → `build_rig`/`render_static` → output (`reframe`, `draw_svg`…) → idle animation (`anim_rig`, `anim_maps`, `make_timeline`, voice (`VOICE`/`VOX`, `make_song`, `render_song`, `wav_encode`), `animator`, flipbook/raster/GIF) → `module.exports` + CLI.
- `index.html`: browser demo (static, draw-on, live "alive" canvas, exports).
- `tools/`: `gallery.js` (static + `--anim`), `frames.js` (PNG/GIF/SVG frames), `build_tables.js`/`build_names.js` (AVONET/AviList derivation).
- `test/`: `determinism.js`, `static_golden.js` + `golden.json`, `animation.js`, `sound.js`.
- `docs/research.md` (generator design), `docs/animation.md` (animation anatomy, maths, sources), `docs/sound.md` (voice research, synthesis, gape).
- `vendor/`: original fishdraw + licence; do not edit.

## Rules
- No dependencies, no build step. Keep `birddraw.js` loadable as a plain browser script: no top-level `return`, guard Node-only code behind `typeof module != "undefined"`.
- Static output must stay byte-identical: never add, remove or reorder global `rand()`/`jsr` calls in the drawing path. If a static change is intentional, re-record with `npm run test:golden:record` and say so in the commit.
- Animation randomness uses local streams only (`make_rng(seed+'#anim')`, `seed+'#timeline'`). Don't regenerate geometry or re-sample noise per frame; only transform cached lines (prevents shimmer).
- Loops must stay seamless: any new time signal must be periodic in `T` (`t mod T`, wrapped kernels).
- New movement channels go in `ANIM_MOVES` with their own RNG stream (`seed+'#name'`), so toggling one never changes the others. Keep `pose_at` and `rest_pose` building pose objects with the same field order, or the per-point maps slow down.
- The voice uses `seed+'#song'` (schedule) and `seed+'#songnoise'` (samples only), and is scheduled for every animator; the `sing` move only adds the `gape` pose. Don't golden-hash PCM (engine `Math.sin` etc. may differ in the last bits); compare within one process.
- Match the existing terse style (2-space indent, short names, sparse comments).

## Commands
- `npm test`: determinism (50 seeds), static golden hashes, animation checks (determinism, seamless loop, Jacobian, rest≈static, painter≈exact, perf budgets), voice checks (schedule/audio determinism, seam, per-archetype bands, gape, WAV). Run before committing.
- `npm run gallery` / `npm run anim`: sample renders into `samples/`.
- `node birddraw.js --seed "X" --format svg|json|smil|csv|ps|anim|gif|frames|wav [--out path] [--fps] [--duration] [--intensity] [--rate] [--moves +flap,+sing,-tail]`.
- On Windows PowerShell 5, `>` writes UTF-16; use `--out` or `Out-File -Encoding utf8`.
