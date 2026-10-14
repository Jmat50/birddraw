# birddraw — research & design notes

How to take the techniques in LingDong Huang's
[fishdraw](https://github.com/LingDong-/fishdraw) (MIT, 2021) and adapt them to
procedurally generate drawings of random, non-existent perched birds.

Contents

1. [What fishdraw is](#1-what-fishdraw-is)
2. [Annotated walkthrough of fishdraw.js](#2-annotated-walkthrough-of-fishdrawjs)
3. [What transfers to birds, and what does not](#3-what-transfers-to-birds-and-what-does-not)
4. [Prior art, open-source code and data](#4-prior-art-open-source-code-and-data)
5. [Bird anatomy for a generator](#5-bird-anatomy-for-a-generator)
6. [Mathematical models used by birddraw](#6-mathematical-models-used-by-birddraw)
7. [Hidden-line strategy](#7-hidden-line-strategy)
8. [Parameter space and archetypes](#8-parameter-space-and-archetypes)
9. [Plotter considerations](#9-plotter-considerations)
10. [Performance notes](#10-performance-notes)
11. [Upgrade paths](#11-upgrade-paths)
12. [Sources and licences](#12-sources-and-licences)

---

## 1. What fishdraw is

fishdraw is a single, dependency-free JavaScript file (~2,600 lines, a copy is
kept in [`vendor/fishdraw.js`](../vendor/fishdraw.js)) that turns a seed string
into a drawing of a made-up fish. Its design goals are worth keeping verbatim:

- **Polylines only.** The output is `Array<Array<[x,y]>>`. There are no fills,
  no colours and no stroke widths. That makes it directly plottable on an
  AxiDraw or polargraph, trivially convertible to SVG, PostScript, CSV or JSON,
  and animatable (SMIL "draw-on" animation).
- **Seed = name.** A pseudo-Latin binomial (`binomen()`) is generated, used as
  the PRNG seed, and printed under the drawing in a Hershey single-stroke font.
- **Full procedural generation.** No assets. Every shape comes from noise,
  trigonometric profiles, and a handful of geometric primitives.
- **Variation through a flat parameter object.** `generate_params()` returns
  ~45 numbers/enums; `fish(params)` is a pure function of them (plus the PRNG
  stream).

## 2. Annotated walkthrough of fishdraw.js

Line numbers refer to `vendor/fishdraw.js` (upstream `main` as of 2026-10).

### 2.1 Randomness (L1–55, L2281–2313, L2550–2565)

| Function | Lines | Notes |
|---|---|---|
| `rand()` | 4–9 | xorshift32 on global `jsr`; returns `[0,1]`. |
| `noise(x,y,z)` | 17–54 | p5.js Perlin port, 4 octaves, falloff 0.5. Lazily fills a 4096-entry table **from `rand()` on first call**. |
| `choice(opts, percs)` | 2281 | weighted pick. |
| `rndtri(a,b,c)` | 2299 | triangular distribution with min `a`, mode `b`, max `c` — the main tool for "typical value with plausible spread". |
| `deviate(n)` | 1900 | uniform in `[-n, n]`. |
| `str_to_seed(str)` | 2550 | string hash → 32-bit seed. |

Gotcha: because the Perlin table is filled only once per process, the *second*
fish drawn in the same Node process uses the table from the *first* seed. The
CLI never notices (one fish per process), but a gallery renderer would. birddraw
resets `perlin = null` after seeding so every seed is fully reproducible.

### 2.2 Geometry kernel (L56–780, L881–947)

- `seg_isect` (83) — segment/segment (or ray) intersection returning `t`, `s`,
  side.
- `poly_bridge` (113) — joins two disjoint polygons by their closest vertex
  pair (used as the fallback when a union has no intersections).
- `poly_union` (136–331) — a Weiler–Atherton-like boundary tracer: computes all
  intersections between the two polygons (optionally self-intersections), then
  walks from the leftmost vertex, jumping polygons at each crossing. Fast for
  small inputs but **O(n·m)** per call and fragile on degenerate/collinear input.
- `clip(polyline, polygon)` (349) — splits an open polyline into `true`
  (inside) / `false` (outside) pieces using even–odd ray parity for the start
  point and parity flipping at every crossing. **This is the core of
  fishdraw's hidden-line removal.**
- `clip_multi(polylines, polygon, fn=clip)` (377) — vectorised clip.
- `binclip(polyline, f)` (390) — splits a polyline wherever predicate
  `f(x,y,t)` flips. Used for dashes, texture drop-out, and pattern masking.
- `resample(polyline, step)` (586) — arc-length resampling (also carries extra
  per-vertex dimensions).
- `approx_poly_dp` (691) — Douglas–Peucker simplification.
- `poissondisk(W,H,r,samples)` (723) — Bridson sampling.
- `trsl_poly / scl_poly / shr_poly / rot_poly` (925–947) — affine helpers.

### 2.3 Shading primitives (L426–560)

- `shade_shape(poly, step, dx, dy)` — 45° hatching clipped to `poly`, then
  **carved** by a translated copy of `poly`: only the crescent of `poly` not
  covered by `poly + (-dx,-dy)` keeps strokes. This fakes a terminator/shadow
  side with one boolean op. Random trimming (`s = rand()*0.5`) makes the hatch
  ends ragged.
- `fill_shape(poly, step)` — plain hatching.
- `patternshade_shape(poly, step, f)` — hatching resampled at 2px, then
  `binclip`ped by a pattern predicate. Any `f(x,y)` becomes a tone region.
- `vein_shape(poly, n)` — `n` short noise-flow strokes ("texture").
- `smalldot_shape(poly, scale)` — Poisson-disk stipple of tiny ellipses.
- `pattern_dot(scale)` — returns a predicate for Gaussian-blob spots.

### 2.4 Scales (L891–1044) — the key idea for feathers

`squama(w,h,m)` is a single scale: a half-ellipse arc (`a ∈ [π/2, 3π/2]`)
bulging toward +x (the tail), plus `m` interior strokes.
`squama_mask(w,h)` is the matching full silhouette.

`squama_mesh(m, n, uw, uh, squama_func, noise_x, noise_y, interclip)` lays out
an `m×n` grid (rows packed with a cosine so they bunch near the dorsal/ventral
edges), jitters it with Perlin noise, measures each cell's local width/height
from its neighbours, then **draws scales column by column, left (head) to right
(tail)**. Each scale's strokes are clipped by the union of the masks of
previously drawn scales (`clip_multi(p, clipper).false`, then
`clipper = poly_union(clipper, q)`). It also fills the gaps with a staggered
second set of scales placed at the centroid of each grid quad.

Because the earlier (head-side) scales are "on top", every later scale is
partially hidden, producing the shingled look. **Bird contour feathers overlap
in exactly the same direction** (each feather's free tip points posteriorly and
overlaps the base of the next one), so this algorithm transfers directly.

### 2.5 Body (L1072–1253, L1905–1950)

The body is two curves of 32 samples: dorsal `curve0` and ventral `curve1`,
each `y = 150 ∓ profile(t)·body_height` with `profile` either
`sin(πt)·noise` or the asymmetric `bean(x)` (L1896). The outline is
`curve0 ++ reverse(curve1)`. Four body textures (`fish_body_a..d`) fill it:
scale mesh with dropout, dense scales with vertical fade, noise-warped
cross-hatch, and "vein" texture.

Fins and head attach to **index ranges** of these curves (`dorsal_start`,
`pelvic_end` …), which makes attachments robust to any body shape.

### 2.6 Fins (L1254–1516)

`fin_a(curve, ang0, ang1, func, clip_root, curv0, curv1, softness)`:

1. compute the outward normal at each sample of `curve` (bisector of
   neighbours);
2. rotate by `lerp(ang0, ang1, t)`;
3. cast a ray of length `func(t)`, resample it, bend it by a `sin(πs)`
   curvature term, perturb by noise growing with `sqrt(s)` (`softness`);
4. the ray tips form the fin edge; rays are drawn partially (random start/end)
   to look like soft fin rays.

Returns `[outline_polygon, strokes]`. This is a general "fan of rays along a
curve" generator — reused by birddraw for crests.

`fin_b` builds spiny segmented fins; `finlet`/`fin_adipose` add small extras.

### 2.7 Head (L1517–1895)

`fish_head(x0,y0,x1,y1,x2,y2,arg)` builds the head from three anchor points
(nose, dorsal and ventral attachment), generates the operculum curve, lips
(`fish_lip`), jaw, teeth, barbels (`barbel`: a noise-steered tapered tube), and
eyes (`fish_eye_a`: concentric rings with a hatched pupil; `fish_eye_b`: rings
+ a carved specular triangle). Everything is clipped against everything in
front of it.

### 2.8 Composition and output (L1905–2226, L782–880)

`fish()` builds all parts, clips them pairwise (`clip_multi(x, c).false`) in a
manual front-to-back order, then concatenates.
`reframe` fits the result into a hard-coded 500×300 box and appends the
caption; `cleanup` simplifies (DP ε=0.1), rounds, and drops degenerate lines
(note: upstream has a small bug, `dist(...polylines[0],...polylines[1])`
should index `polylines[i]`; birddraw fixes it).

## 3. What transfers to birds, and what does not

| fishdraw piece | Bird use | Change needed |
|---|---|---|
| PRNG, noise, `rndtri`, `choice` | same | reset Perlin per seed |
| geometry kernel | same | none |
| `shade_shape`, `patternshade_shape`, `fill_shape`, `vein_shape` | belly shadow, plumage patterns, dark feather centres, bark | none |
| `squama_mesh` | body contour feathers | longer, pointed-rounded feather; size gradient (small on face/breast, large on mantle/flanks); **neighbour-only occlusion** instead of a growing union (see §10) |
| two-curve body | bird body | egg profile, front-heavy; then rotated by posture angle |
| `fin_a` | crest | angle range tilted backward |
| `barbel` | rictal bristles, toe tubes | tube width/taper |
| `fish_eye_a/b` | eye | add eye-ring |
| `binomen` | bird names | new syllable tables |
| hard-coded 500×300 frame | portrait frame | parameterise W, H |
| fins (dorsal/pelvic/anal) | — | replaced by wing / tail / legs (new code) |
| lips, jaw, teeth | — | replaced by conic beak (new code) |

New primitives needed: a **flight feather** with rachis and barbs, a **folded
wing layout**, a **tail fan**, a **conic beak**, **legs/feet** and a **perch**.

## 4. Prior art, open-source code and data

### 4.1 Direct relatives of fishdraw

- **fish-oxide** — Rust port, MIT — <https://github.com/ava-silver/fish-oxide>.
  Splits the file into `custom_rand`, `draw`, `hershey`, `params`; useful as a
  module map. SMIL/PS not ported.
- **polargraph** — Python port of fishdraw inside a polargraph plotter app,
  <https://github.com/Twarner491/polargraph> (`src/modules/generators/fishdraw/`:
  `curves.py`, `fish.py`, `geometry.py`, `names.py`, `perlin.py`). Shows the
  same polyline output driving a real plotter.
- **LingDong's other generators** (MIT): [shan-shui-inf](https://github.com/LingDong-/shan-shui-inf)
  (noise-built mountains/trees as SVG strokes — good vocabulary for branches and
  bark), [nonflowers](https://github.com/LingDong-/nonflowers) (Gongbi plants,
  Bézier leaves/petals), and the MIT Media Lab write-up
  [Filling Arbitrary Shapes with Non-Overlapping Procedural Floral Patterns](https://www.media.mit.edu/projects/non-overlapping-floral-patterns/overview/)
  (Poisson anchors + Voronoi cells + ray casting for petal placement — a
  candidate method for packing feathers into tracts in a future version).

### 4.2 Existing bird generators

- **Birds-of-a-Feather** (erdavids, Processing.py) —
  <https://github.com/erdavids/Birds-of-a-Feather>. ~200 lines: a quad body,
  circle head, triangle beak, stick legs, random filled triangles. Too simple
  to reuse, but a reminder that legs + beak + eye already read as "bird".
- **bird-generator** (michaelkolesidis, p5.js WebGL, AGPL-3.0) —
  <https://github.com/michaelkolesidis/bird-generator>. Slider-driven 3D
  primitives; AGPL makes code reuse unattractive.
- **coolbirds** (sambskn, Rust/Bevy/csgrs) — <https://github.com/sambskn/coolbirds>,
  port of MoonCactus's OpenSCAD **Bird-o-matic** (Thingiverse 139945). Text
  "bird seed" + "pick favourite, breed progeny" UX is worth copying later.
- **Houdini Feather system** (proprietary) — documents the feather group
  taxonomy used in VFX (primaries 9–10, secondaries 9–25, coverts) —
  <https://www.sidefx.com/docs/houdini/feathers/index.html>.

### 4.3 Feather modelling literature

- **Franco & Walter 2002**, *Modeling and Rendering of Individual Feathers*
  (SIBGRAPI). Three Bézier curves (rachis + two vane boundaries); barbs are
  Béziers whose first control point lies on the rachis and last on the vane
  boundary; random perturbation of inner control points gives the
  plumulaceous (fluffy) look.
- **Streit & Heidrich 2002**, *A Biologically-Parameterized Feather Model*
  (Computer Graphics Forum 21(3)). Parameters: calamus length `cl`, rachis
  length `rl`, base width, side-to-side and front-to-back curvatures `rlc`,
  `rvdc`; left/right vane barb base and tip angles `vlba, vlta, vrba, vrta`;
  barb spacing base/tip `spb, spt`; a set of **key barbs** at rachis positions
  `rp` interpolated linearly for all intermediate barbs; when the clamped
  base–tip distance of a key barb is < 1 the barbs scale non-linearly, which
  produces **vane splits**. Feather coats are generated by bilinearly
  interpolating key feathers.
- **Baron 2019** (Clemson MSc), *Procedurally Generating Biologically Driven
  Bird and Non-Avian Dinosaur Feathers*. Specimen-measured width functions per
  vane, NURBS shafts, barbs placed using the shaft's tangent/normal/bitangent
  frame.
- **FeathersGen** (patipocz, C++/NGL) — <https://github.com/patipocz/FeathersGen>,
  a small implementation of Franco & Walter.

### 4.4 Wing layout

- **Howard 2011**, Texas A&M thesis / *Wing Creator* (Falconsong Studios).
  Feather groups (primaries, secondaries, primary coverts, greater / median /
  lesser secondary coverts, alula) are each placed between a start and end
  locator on the wing skeleton with three per-group functions over the feather
  index: *start-to-end distribution*, *fanning* (rotation) and *scaling*.
- **Algorythmic Explorations — The Eagle** — a feather is a width profile
  along a shaft (round tip for secondaries, pointed for primaries, square for
  rectrices) with an **emargination step** past ~60% length on outer primaries;
  a wing is "a roster": one table row per feather (bone, position along it,
  length, width, folded/spread fan angle), and coats are drawn as stacked
  instances with a lift so neighbours layer correctly.

### 4.5 Beak shape

- **Campàs et al. 2010**, *Scaling and shear transformations capture beak
  shape variation in Darwin's finches*, PNAS 107:3356. Within groups, beak
  profiles differ only by **length and depth scaling**; across groups, adding a
  **shear** along the depth axis collapses all shapes onto one.
- **Fritz et al. 2014**, *Shared developmental programme strongly constrains
  beak shape diversity in songbirds*, Nat. Commun. 5:3700. The collapsed shape
  is a **parabola `y = ax² + bx`**, so songbird beak profiles are **conic
  sections**: a 3-parameter family (length, depth, shear).
- **Mark My Bird** (Cooney et al. 2017, Nature 542:344) — 3D bill scans and
  landmarks for 2,028 species, CC BY 4.0 — <https://data.nhm.ac.uk/dataset/markmybird>.
  Could be used to fit the conic parameters per family.

### 4.6 Body proportions and names

- **AVONET** (Tobias et al. 2022, Ecol. Lett. 25:581), CC BY 4.0 —
  <https://opentraits.org/datasets/avonet.html>. 90,020 individuals, 11,009
  species. Traits: `Beak.Length_Culmen`, `Beak.Length_Nares`, `Beak.Width`,
  `Beak.Depth`, `Tarsus.Length`, `Wing.Length`, `Kipps.Distance`,
  `Secondary1`, `Hand-Wing.Index`, `Tail.Length`, `Mass`, plus habitat,
  trophic level, primary lifestyle. `tools/build_tables.js` reduces it to
  per-family ratio medians.
- **AviList v2025b**, CC BY 4.0 — <https://www.avilist.org/checklist/v2025b/>.
  Successor to the IOC list. Scientific names feed `tools/build_names.js`.

### 4.7 Non-photorealistic rendering

- **Winkenbach & Salesin 1994**, *Computer-Generated Pen-and-Ink
  Illustration*, SIGGRAPH. *Prioritized stroke textures*: draw the highest
  priority strokes first (outlines), then add lower-priority ones (detail,
  hatching) only until the target tone is reached. birddraw applies this as
  per-region keep-probabilities: outlines always, feather edges by tone,
  barbs only on flight feathers, hatching last.

### 4.8 Libraries considered (not used at runtime)

| Library | What for | Why not (yet) |
|---|---|---|
| [clipper2-ts](https://github.com/countertype/clipper2-ts) | robust booleans, offsets | dependency; open-path clipping on coincident edges is undefined ([Clipper2 #554](https://github.com/AngusJohnson/Clipper2/issues/554)) |
| [@velipso/polybool](https://www.npmjs.com/package/@velipso/polybool) | booleans incl. Béziers | dependency |
| [@thi.ng/geom-clip-line](https://docs.thi.ng/umbrella/geom-clip-line/) | polyline × polygon clip | dependency; same job as fishdraw `clip` |
| [simplex-noise](https://github.com/jwagner/simplex-noise.js) + [alea](https://www.npmjs.com/package/alea) | faster noise, seeded | fishdraw noise is adequate |
| [d3-delaunay](https://github.com/d3/d3-delaunay) | Voronoi feather packing | future |
| [vpype](https://vpype.readthedocs.io/) + [occult](https://pypi.org/project/vpype-occult/) | plot optimisation | external post-processing only |
| [@thi.ng/axidraw](https://docs.thi.ng/umbrella/axidraw/) | drive an AxiDraw from Node | optional consumer |

## 5. Bird anatomy for a generator

Side view of a perched passerine, from front to back:

- **Bill**: upper mandible (culmen ridge on top, tomium = cutting edge), lower
  mandible, gape at the base, nostril (naris) near the base of the upper
  mandible.
- **Head**: crown, forehead, lores (between eye and bill), eye with eye-ring,
  ear coverts (auriculars), nape, chin, throat. Common field marks: cap,
  supercilium (eyebrow), eyestripe, mask, malar stripe, bib.
- **Body**: breast, belly, flanks, vent, undertail coverts; mantle/back,
  rump, uppertail coverts. Feathers grow in tracts (*pterylae*) separated by
  bare skin (*apteria*); the dorsal and ventral tracts show **chevron-shaped
  rows** pointing forward (Clench 1970, *Auk*), but in a side view the body
  reads as overlapping shingles that grow larger toward the back and flanks.
- **Folded wing** (outermost/topmost layer first): scapulars over the
  wing–body junction; lesser coverts (tiny, near the leading edge); median
  coverts (one row); greater coverts (one row — their pale tips form the
  classic **wing bars**); alula and primary coverts at the wrist; tertials
  (broad, rounded, often dark-centred, covering the secondaries); secondaries
  (stacked, tips forming the trailing edge); primaries, whose visible tips
  beyond the tertials form the **primary projection**. Projection is long in
  migrants and aerial feeders (high hand-wing index) and short in sedentary
  birds.
- **Tail** (rectrices, usually 12): seen from the side as a stack. Shapes:
  square, rounded, graduated, forked, pointed (elongated central pair), wedge.
- **Legs**: feathered thigh ("trousers"), scaled tarsus (scutellate front
  plates), **anisodactyl** foot (three toes forward, hallux backward) gripping
  the perch, claws.

## 6. Mathematical models used by birddraw

All lengths are in drawing units; the body length is ~150–220 units before
`reframe`. Coordinates are SVG-style (y down). The bird faces **left**.

### 6.1 Frames

- **Body frame**: origin at body centre, +x toward the tail, body axis
  horizontal. Body, wing, tail and their patterns are built here.
- **World frame**: body-frame geometry is rotated by `−posture` (head up)
  about the origin. Head, beak, legs and perch are built directly in world
  coordinates so they stay upright regardless of posture.

### 6.2 Body profile

For `t ∈ [0,1]` (0 = breast, 1 = tail base), `N = 32` samples:

```
x(t)      = (t − 0.5) · BL
top(t)    = BH · sin(π(0.04 + 0.92t))^0.7 · (1 − 0.35t) · lerp(0.85, 1.05, noise)
bottom(t) = BH · sin(π(0.04 + 0.92t))^0.6 · (1 − 0.25t) · belly(t)
belly(t)  = 1 + 0.15 · plump · sin(πt)            (pot-belly)
curve0    = (x, −top),  curve1 = (x, +bottom)
```

`BH = BL · plumpness`. The exponents < 1 make the front blunt and the back
full; the `(1 − k t)` factor tapers toward the tail base.

### 6.3 Conic beak (Campàs 2010, Fritz 2014)

Beak-local frame: `u` from base (0) to tip (`L`), `v` downward. With
`x = 1 − u/L` (distance from the tip, normalised):

```
g(x)        = a·x² + (1 − a)·x          conic profile, g(0)=0, g(1)=1, a∈[−0.9, 0.3]
midline(x)  = shear·D·(1 − x) + decurve·L·(1 − x)²
upper(x)    = midline(x) − D_u · g(x)^0.85
lower(x)    = midline(x) + D_l · g(x)
hook        : upper tip extended by h·D and bent down by h·D·max(0,(u/L − 0.75)/0.25)²
              lower mandible shortened to L·(1 − 0.12h)
```

`D_u ≈ 0.55·D`, `D_l ≈ 0.45·D`. Scaling `(L, D)` reproduces Campàs' scaling
groups; `shear` is the across-group transform; `hook` and `decurve` extend the
family to raptors/parrots and curlews/sunbirds, which are outside the songbird
conic family. The midline doubles as the tomium/gape line; the naris is a small
ellipse at `u ≈ 0.18 L` between culmen and midline.

### 6.4 Flight feather (Streit & Heidrich, Franco & Walter)

Inputs: base `P0`, tip `P1`, max vane width `W`, leading-vane fraction `α`
(0.3–0.5; flight feathers are asymmetric), tip shape, rachis bend `κ`,
emargination position `e`, barb density `ρ`, barb slant `δ`.

```
rachis(s)  = quadratic Bézier P0 → P1 with control point midpoint + κ·|P1−P0|·n̂
w(s)       = W · smoothstep(0.04, 0.22, s) · tip(s)
tip(s)     = round:   sqrt(1 − ((s − 0.6)/0.4)²)   for s > 0.6
             pointed: (1 − s)/0.45                 for s > 0.55
             square:  1 − smoothstep(0.93, 1, s)
lead(s)    = α·w(s) · (e > 0 && s > e ? 0.55 : 1)       emargination step
trail(s)   = (1 − α)·w(s)
edgeL(s)   = rachis(s) − lead(s)·n̂(s),  edgeR(s) = rachis(s) + trail(s)·n̂(s)
barb_k     = rachis(s_k) → edge(s_k + δ)    every 1/ρ units of arc length
```

Barbs end on the vane outline at a point further toward the tip, which is
equivalent to Streit's barb tip angle. Noise on the barb midpoint gives the
plumulaceous base; randomly dropping a run of barbs and drawing a longer barb
gives the vane splits.

### 6.5 Folded-wing roster (Howard 2011)

The wing is built in a normalised frame `(u, v)`, `u ∈ [0,1]` from the wrist to
the wingtip and `v ∈ [−½, ½]` across (negative is up, toward the back). Each
group is a row of a roster:

| group | n | base u | tip u | v range | width | tip |
|---|---|---|---|---|---|---|
| scapulars | 3–4 | 0.05–0.35 | 0.25–0.55 | −0.55 | 0.22 | round |
| lesser coverts | mesh | u < 0.22 | | v < 0.1 | 0.05 | round |
| median coverts | 4–6 | 0.08 | 0.26–0.30 | −0.35..0.10 | 0.13 | round |
| greater coverts | 6–9 | 0.12 | 0.42–0.50 | −0.30..0.35 | 0.15 | round |
| alula + primary coverts | 3 | 0.02 | 0.22–0.30 | 0.20..0.42 | 0.11 | pointed |
| tertials | 2–3 | 0.30 | `u_s` + 0.02 | −0.35..−0.05 | 0.26 | round |
| secondaries | 5–8 | 0.25 | `u_s` − 0.06t | −0.20..0.35 | 0.20 | round |
| primaries | 6–9 | 0.18 | `u_s`→1 | 0.05..0.20 | 0.16 | pointed, emarginated |

`u_s = 1 − kipp`, where `kipp` is Kipp's distance / wing length (derivable from
the AVONET hand-wing index: HWI = 100·kipp). Feathers are listed and drawn
**front-most first**; inside a group the topmost/innermost first. The normalised
layout is then warped into the wing envelope:

```
taper(u) = smoothstep(0, 0.18, u)^0.5 · (1 − smoothstep(0.35, 1.02, u))^0.8 + 0.03
X = u · WL,   Y = v · WH · taper(u)
```

followed by rotating by the wing angle `β` and translating to the wrist anchor
in the body frame. Warping the resampled feather polygons bends the feathers
naturally as the wing narrows toward the tip.

### 6.6 Tail fan

`k` rectrices (4–6 visible), `r = i/(k−1)` from outer (bottom) to central
(top). Lengths `TL·f(r)`:

| shape | f(r) |
|---|---|
| square | 0.97 + 0.03r |
| rounded | 0.80 + 0.20r |
| graduated | 0.45 + 0.55r^1.2 |
| forked | 1.0 − 0.32r |
| pointed | 0.72 + 0.28r + (r = 1 ? 0.45 : 0) |
| wedge | 0.60 + 0.40r |

The fan angle spreads ±0.06·k radians around the tail direction (body axis
plus a cock angle). Uppertail coverts are three contour feathers drawn on top
of the base.

### 6.7 Plumage mesh

Columns are stepped along x with a variable feather size
`s(x) = s0 · lerp(0.65, 1.35, (x − xmin)/w)`. Rows are offset by half a step on
odd columns (staggered) and shifted by `0.25 s · |y|/BH` toward the tail to
mimic chevrons. Each feather is the bird `contour_feather` (a U-shaped arc
pointing toward +x, with optional rachis/streak strokes). Each feather's mask
is added to a **spatially-filtered occluder** (see §7). The keep probability is
a Winkenbach-style tone function: high on the back and flanks, low on the
breast and belly.

### 6.8 Legs and perch

Hip `H` = rotated body point `(0.1·BL, 0.85·bottom)`. Heel `J = H + (2, 4)`
(hidden by belly plumage). The foot is
`F = J + TaL·(−sin φ, cos φ)` with `φ ≈ 0.2` (tarsus leaning forward). The
perch's top is at `F.y`. Each toe is a polyline over the perch top and down its
front face; it is turned into an outline by a tapered tube (`tube()`, derived
from `barbel`). The hallux goes backward and is clipped by the perch. Scutes
are short ticks every ~3 units along the front edge of the tarsus.

## 7. Hidden-line strategy

fishdraw clips a part against the union of everything in front of it. birddraw
keeps that idea but replaces the growing union with an **Occluder list**:

```
occ.clip(lines): for each mask m whose bbox overlaps the line's bbox:
                     lines = clip_multi(lines, m).false
occ.add(mask):   push mask with its bbox
```

Clipping an open polyline by masks one after another is equivalent to clipping
it by their union (a point is visible iff it is outside every mask), but it
never builds a union polygon. That avoids `poly_union`'s O(n·m) growth and its
degenerate-input failures. The bbox prefilter keeps the cost close to linear.

Global front-to-back order:

1. forward toes
2. beak
3. head (with eye, crest, face patterns)
4. wing (scapulars → … → primaries)
5. body (outline, plumage, patterns, shading)
6. near tarsus
7. perch
8. hallux
9. tail
10. far leg

## 8. Parameter space and archetypes

`generate_params()` picks an **archetype** (finch, sparrow, warbler, thrush,
corvid, raptor, parrot, kingfisher, owl, swallow, wader). With probability
0.3 it blends two archetypes with a random weight. It then samples each
parameter with `rndtri(lo, centre, hi)` around the archetype centre. Enum-like
features (tail shape, body pattern, face marks) come from archetype-weighted
`choice`s. The archetype ratios are hand-seeded to match typical AVONET
values:

- beak culmen ÷ wing length: ~0.15 for finches, ~0.4 for kingfishers.
- tarsus ÷ wing: ~0.25 for passerines, ~0.15 for swallows and parrots,
  ~0.6 for waders.
- tail ÷ wing: 0.4–1.3.
- HWI: ~10 for sedentary birds, 40+ for swallows.

`tools/build_tables.js` regenerates these centres from the real AVONET species
averages if the CSV is present.

## 9. Plotter considerations

- Output units equal SVG px in a `W×H` box (default 400×500 plus a 10px
  margin). For millimetres, scale on import or use vpype:
  `vpype read bird.svg scaleto 180mm 225mm linemerge linesort reloop linesimplify write out.svg`.
- `cleanup` removes sub-0.9-unit two-point lines, which would be invisible
  pen-down/pen-up blips on a plotter.
- The SMIL output (`--format smil`) animates strokes in generation order. Since
  that order is front-to-back, the bird "draws itself" from beak to tail.

## 10. Performance notes

- fishdraw's `squama_mesh` performs one `poly_union` per scale, so the cost is
  quadratic in the number of scales. birddraw's Occluder with bbox prefilter
  replaces it. Typical cost is ~200–400 small masks and ~3–6k polylines per
  bird, at about 0.3–1.5 s in Node.
- `clip` is O(segments × polygon edges); masks are kept small (≈ 12–30
  vertices) and the big silhouettes (body, wing envelope) are resampled
  coarsely (≈ 3–4 units).

## 11. Upgrade paths

- Swap `clip`/`poly_union` for clipper2-ts if robustness ever matters more than
  zero dependencies (closed-subject ops only; keep fishdraw `clip` for open
  polylines).
- Voronoi-based feather packing per pterylae (d3-delaunay), following
  LingDong's floral-pattern cell assignment.
- Fit beak `(a, shear)` per family from Mark My Bird landmarks.
- Flying pose: reuse the wing roster with spread fan angles (Howard's
  folded/spread interpolation).
- Interactive "breed your bird" UI (coolbirds/Bird-o-matic style).

## 12. Sources and licences

| Source | Licence | Used as |
|---|---|---|
| fishdraw, L. Huang | MIT | code vendored into birddraw.js |
| fish-oxide, A. Silver | MIT | reference |
| shan-shui-inf, nonflowers, L. Huang | MIT | reference |
| Birds-of-a-Feather, E. Davidson | none stated | reference only |
| bird-generator, M. Kolesidis | AGPL-3.0 | reference only |
| coolbirds / Bird-o-matic | see repo | reference only |
| AVONET, Tobias et al. 2022 | CC BY 4.0 | optional table builder |
| AviList v2025b | CC BY 4.0 | optional name builder |
| Mark My Bird | CC BY 4.0 | future |
| Franco & Walter 2002; Streit & Heidrich 2002; Baron 2019; Howard 2011; Campàs et al. 2010; Fritz et al. 2014; Winkenbach & Salesin 1994; Clench 1970 | papers | models only |
