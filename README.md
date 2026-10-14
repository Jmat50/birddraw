# birddraw

Procedurally generated drawings of perched birds, made only of polylines for pen plotters. It is a single file with zero dependencies, adapted from Lingdong Huang's [fishdraw](https://github.com/LingDong-/fishdraw).

Every seed is a fictional species with a generated binomial name. The same seed always gives the same drawing.

## Usage

```
node birddraw.js                                # random bird, SVG to stdout
node birddraw.js --seed "Fringilla coelebs"     # deterministic
node birddraw.js --format json|svg|smil|csv|ps  # output format
node birddraw.js --format smil --speed 2        # animated drawing
```

On Windows PowerShell 5, `>` writes UTF-16. Use `node birddraw.js | Out-File -Encoding utf8 bird.svg` instead, or the gallery script.

You can also call it from code:

```js
const bd = require('./birddraw.js');
const polylines = bd.main('Turdus merula');   // [[[x,y],...],...] in a 460x420 frame
const svg = bd.draw_svg(polylines);
const arg = bd.generate_params();             // or edit a parameter set by hand
const raw = bd.bird(Object.assign(bd.default_params(), {archetype: 'owl', posture: 1.3}));
```

To try it in a browser, open `index.html`. It has a seed box, random and SVG-download buttons, and a "draw-on" toggle for the SMIL drawing animation.

## Idle animation ("alive" mode)

Any seed can be brought to life with subtle, anatomically grounded idle motion:
- **breathing:** the sternum swings down and forward at a mass-scaled rate
- **folded wing:** rides passively on the flank
- **head:** minimum-jerk saccades and tilts on a 2.5D ellipsoid head; owls make slow pans instead
- **blinks:** nictitating-membrane blinks coupled to saccades; owls use the upper lid
- **tail:** pumps and flicks; some waders teeter
- **crest:** follows through after head movements

The loop is seamless, and every frame is still plain polylines, so it can be plotted. `main(seed)` is unaffected.

```
node birddraw.js --seed "Turdus merula" --format anim > alive.svg          # self-contained animated SVG
node birddraw.js --seed "Turdus merula" --format gif --out alive.gif       # looping GIF
node birddraw.js --seed "Turdus merula" --format frames --out frames/      # one SVG per frame
  options: --fps 12  --duration 6  --intensity 0.7  --scale 1 (gif)
node tools/frames.js "Turdus merula" --fps 12 --strip 8                    # SVG + PNG frames, GIF, flipbook, contact strip
```

```js
const an = bd.animator('Turdus merula', {duration: 6, intensity: 0.7});
an.frame(1.5);   // exact hidden-line polylines at t = 1.5 s
an.ops(1.5);     // painter ops [{fill:[poly]}, {stroke:[lines]}, ...] for fast canvas playback
an.pose_at(1.5); // {breath, yaw, pitch, roll, tail, nict, lid, ...}
```

In `index.html`, tick **alive** for live canvas playback. It has an intensity slider, a loop-length field, and an **exact** checkbox that shows the plotter-ready hidden-line frames. There are also buttons to download the animated SVG or the GIF.

Sizes: a 6 s flipbook SVG at 12 fps is about 1.5–2.5 MB, and a GIF at 15 fps and 0.75 scale is about 1 MB. Use a lower `--fps` or `--duration` for smaller files. [`docs/animation.md`](docs/animation.md) has the anatomy, maths and sources.

## Scripts

| command | what it does |
|---|---|
| `npm run gallery` | renders 24 birds to `samples/*.svg`, plus `samples/sheet.svg` (a contact sheet) and `samples/index.html` |
| `npm run anim` | renders 8 idle-animation GIFs to `samples/anim/` with an `index.html` |
| `npm test` | 50 seeds deterministic, finite and in frame; static golden hashes; animation checks (determinism, seamless loop, fold-free breath field, rest pose matches static, painter matches exact, time budgets) |
| `npm run test:golden:record` | re-records `test/golden.json` after an intentional change to the static drawing |
| `node tools/build_tables.js AVONET.csv` | derives archetype proportion ratios from AVONET morphometrics |
| `node tools/build_names.js AviList.csv` | rebuilds the binomen syllable tables from a real checklist |

## How it works

[`docs/research.md`](docs/research.md) has the full design notes. In short:

- **Kernel (vendored from fishdraw):**
  - xorshift PRNG and Perlin noise
  - polygon clipping, used for hidden-line removal
  - hatching: `shade_shape`, `fill_shape`, `patternshade_shape`
  - `fin_a` (reused for crests), `fish_eye_*` (bird eyes), `squama_mesh` (adapted into the contour-feather mesh)
  - Hershey `put_text`
- **Occluder:** parts are drawn front to back. Each new line is clipped by every already-placed mask whose bounding box overlaps it.
- **Body:** an asymmetric spindle with noise. It is covered by a staggered mesh of contour feathers that grow larger toward the tail. Optional body patterns are streaks, scallops, spots, bars, or a dark back (cape).
- **Head and beak:** a conic beak profile `g(x) = a x^2 + (1-a) x` with shear, decurvature and a hooked tip (after Campàs et al. 2010; Fritz et al. 2014). Face marks are a cap, eyestripe, supercilium, mask, bib, malar stripe and cheek patch.
- **Feather primitive:** a quadratic-Bézier rachis with an asymmetric vane width profile. Tips can be round, pointed or square, with optional emargination. Barbs are slanted toward the tip (after Streit & Heidrich 2002; Franco & Walter 2002).
- **Folded wing:** a roster of feather tracts: scapulars, lesser, median and greater coverts, alula, tertials, secondaries and primaries. The roster is laid out in a normalised wing frame, then warped into a tapering envelope. Primary projection is set by Kipp's distance (`kipp`). Wing styles are plain, wing bars, dark feather centres, dark flight feathers, or barred.
- **Tail:** rectrices fanned from the top central feather outward. Shapes are square, rounded, graduated, forked, pointed or wedge.
- **Legs and perch:** a scutellate tarsus with three forward toes and a hallux wrapping the branch. The branch has a sawn end, a twig, bark strokes and shading.
- **Parameters:** 11 archetypes (finch, sparrow, warbler, thrush, corvid, raptor, parrot, kingfisher, owl, swallow, wader). Each holds proportion centres; values are sampled with a triangular distribution around them. About 30% of seeds blend two archetypes (shown with a `+` suffix in `main.last_params.archetype`).

## Credits and licence

MIT; see `LICENSE`. The fishdraw kernel is © 2021 Lingdong Huang (MIT); `vendor/` has the original file and licence. The morphometric and name tooling is designed for AVONET (Tobias et al. 2022) and AviList (2025), both CC BY 4.0. Neither dataset is redistributed here.
