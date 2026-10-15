# Playground research: a generated treescape full of interactive birds

Status: research and design proposal. Nothing here is implemented yet.

Goal: use the generative approach of
[shan-shui-inf](https://github.com/LingDong-/shan-shui-inf) (MIT, © 2018
Lingdong Huang) to generate an endless random treescape. Perch
birddraw-generated birds in its trees, and let the user interact with
them: look, approach, flush, follow, identify, collect.

The document has four parts:

1. How shan-shui-inf works, read from its source, and what to keep and fix.
2. The domain research that should drive the behaviour (bird ecology,
   biomechanics, tree architecture), with citations.
3. Measurements of birddraw's own costs, which set the performance budget.
4. A proposed architecture, an interaction design, a roadmap and open
   decisions.

---

## 1. How shan-shui-inf works

The whole program is one 130 KB `index.html` with no dependencies apart
from an inlined copy of p5.js's Perlin noise. Everything below was read
from that file.

### 1.1 Randomness

- **PRNG.** It uses a Blum-Blum-Shub-style generator: `s = s² mod (p·q)` with
  `p = 999979` and `q = 999983`. Both are ≡ 3 (mod 4), as BBS requires.
  The seed comes from the URL query string (or the time) and goes through
  a small string hash.
- **It replaces `Math.random` globally.** The source has 154 `Math.random()`
  call sites and all of them share one stream.
- **Noise.** It uses p5.js Perlin (`Noise.noise(x, y, z)`, 43 call sites).
  This provides the low-frequency structure: mountain silhouettes, stroke
  widths, tree bends and the layout planner.

**Consequence:** the world depends on the order in which things are
generated. Scrolling right and then left produces a different landscape
than scrolling left and then right, because chunks consume the shared
stream in a different order. That is acceptable for an art piece. It is
wrong for a playground where a seed should name a place.

### 1.2 Drawing primitives (all return SVG strings)

| primitive | what it does |
|---|---|
| `poly(pts, {fil, str, wid})` | SVG `<polyline>` with an rgba fill and stroke |
| `stroke(pts, {wid, col, noi, out, fun})` | Variable-width ribbon: offsets the centre line on both sides by `wid·fun(t)·(1−noi + noi·noise)` and emits a filled polygon. This is the "brush". |
| `blob(x, y, {len, wid, ang, fun})` | Leaf or petal shape: a closed polygon whose half-width follows `fun` (by default `sin` with a pointed tip) |
| `div(pts, n)` | Resamples a polyline by subdividing every segment n times |
| `texture(ptlist, {tex, sha, dis, len})` | Hatching between contour layers: picks layer points and draws short `stroke`s. Used for mountain shading. |
| `bezmh(P)` | Smooth polyline through control points (a Bézier-like midpoint scheme) |

The "ink" look comes from translucent fills, `rgba(100,100,100,0.3)` and
similar, stacked on top of each other. Occlusion is done by painting a
white-filled polygon behind each object (the painter's algorithm).

### 1.3 Trees, the part we care about most

There are eight generators, `Tree.tree01` to `Tree.tree08`. All of them
take `(x, y, args)` with `x, y` at the base of the trunk and `hei` and
`wid` arguments, and all return SVG strings.

| gen | construction | role in shan-shui | birdability |
|---|---|---|---|
| tree01 | two noisy trunk lines plus translucent leaf `blob`s scattered over the top three quarters | small trees on the middle of mountain flanks | low; no real branches |
| tree02 | a cluster of `blob`s, no trunk | rim and top of mountains, scattered bushes | none (bush) |
| tree03 | white-filled tapering trunk polygon with a bend function; leaf blobs on both sides that get shorter with height | foot of mountains, conifer-like | low |
| tree04 | `branch()` trunk (3 bends, noise width) plus `barkify` (bark marks, knots); side branches at 30–70% of the height, each with `twig()` recursion and leaf blobs | big broadleaf trees in foreground groves, 1–3 per grove | **high**: real limbs and twigs |
| tree05 | like tree04, but branches appear every few nodes with short twigs and small leaf clusters | rows of tall trees 30 units apart, conifer-like | **high**: layered whorls like spruce |
| tree06 | `fracTree`, a recursive fractal of depth 3, plus `barkify`, twigs without leaves | gnarled bare trees, 1–3 per grove | **highest**: clear perches |
| tree07 | triangulated leaf mass with noise-shaded fills | dense dark rows 20 units apart (willow or hedge) | low; foliage hides birds |
| tree08 | thin trunk plus fine `fracTree` line twigs, 3–4 levels | bare winter thickets, 2–5 stems per clump | **high** for small birds |

How they are placed:

- **Mountains.** `Mount.mountain` builds 10 × 50 contour layers of
  `cos × noise`. `vegetate(treeFunc, growthRule, proofRule)` then places
  trees on contour points. `growthRule` is a noise threshold per point;
  `proofRule` rejects trees that are too close to one already placed. The
  results are tree02 on the rim and top, tree01 in the middle and tree03
  at the foot. Buildings, towers and rocks are placed the same way.
- **Foreground groves.** These are the ones that matter here.
  `Mount.flatMount` creates flat land and `flatDec` decorates it. It
  picks one grove type at random from `[0, 0, 1, 2, 3, 4]` and adds:
  - type 1: a row of tree05 every 30 units
  - type 2: 1–3 tree04
  - type 3: 1–3 tree06
  - type 4: a row of tree07 every 20 units
  - every type: 0–2 tree08 thickets of 2–5 stems, 0–50 tree02 bushes,
    rocks, and sometimes an `Arch.arch01` hut

### 1.4 Other content

- `Mount.distMount`: distant mountains drawn as filled tones.
- `Mount.rock`.
- `Arch.*`: houses, pagodas, a transmission tower, `boat01`.
- `Man.man`: a hierarchical skeleton made of a tree of bone vectors
  (`gpar`, `grot`, `gpos` give global parent, rotation and position).
  Body parts are clothed with width functions through `expand`. This is
  the same rig idea as birddraw's, at a much simpler scale.
- `water()`: horizontal ripple strokes.

### 1.5 World layout and streaming

- **Planning.** `mountplanner(xmin, xmax)` walks x in steps of 5 and finds
  local maxima (`locmax`) of 1D Perlin noise. Mountains go where the
  noise is above a threshold. An occupancy count `planmtx` keeps any one
  stretch from getting crowded, and `chadd` enforces a minimum spacing.
  It also adds distant mountains, flat mountains and boats.
- **Chunks.** `chunkloader` generates 512-unit chunks on demand as the
  view moves left or right. Each chunk's SVG string goes into
  `MEM.chunks`, which is kept sorted by `y` so it renders in painter's
  order.
- **Rendering.** `chunkrender(xmin, xmax)` concatenates the strings of the
  visible chunks. `update()` assigns the result to an SVG's `innerHTML`.
  **The whole DOM is rebuilt on every update.** Scrolling changes the
  `viewBox`. The paper texture is a separate noise-filled canvas.

### 1.6 What to keep and what to fix

Keep:

- The *grammar*: noise-planned layout, then grove types, then tree
  generators with noise-modulated widths and bends. It reads as
  hand-made, and the code is short.
- Placement by threshold and proof rule (`vegetate`). It is a perfect fit
  for placing birds on perches as well (§4.4).
- Chunked infinite scrolling with painter's ordering by depth.
- The MIT licence lets us vendor or port it, the same way birddraw
  vendors fishdraw.

Fix:

1. **Order-dependent randomness.** Seed every chunk, grove, tree and bird
   from a hash of `(world_seed, chunk_index, local_index)`. Use a local
   PRNG and never patch `Math.random`. This matches the rule in
   `AGENTS.md`: each subsystem gets its own stream.
2. **Output as strings throws away geometry.** We need the tree
   *skeleton* (nodes, radii, angles) to find perches, test hits and
   attach birds. Generators must return structured data:
   `{skeleton, lines, masks, foliage}`.
3. **Translucent fills are not plotter-friendly.** birddraw draws
   monoline polylines with hidden-line removal, so the two styles clash.
   §4.3 resolves this.
4. **Full DOM rebuild.** Use a canvas with cached tiles instead (§4.7).

---

## 2. Domain research

These findings set the defaults and the shape of the behaviour. Numbers
are given as published and adapted in §4–§5.

### 2.1 How close you can get: flight initiation distance (FID)

- **Blumstein 2006** (150 species): FID increases with body mass. The
  distance at which the observer starts approaching is the strongest
  single predictor of FID: approaches that start further away produce
  earlier flight. Carnivorous, omnivorous and social species are flightier.
- **Weston et al. 2012** (review of Australian birds): log FID rises with
  log mass at a slope of about **0.29** (R² ≈ 0.48), so
  \(FID \propto M^{0.29}\). *Alert distance* (when the bird first reacts)
  correlates very strongly with FID (r ≈ 0.96). In practice, alert
  distance is a near-constant multiple of FID.
- **Stankowich & Blumstein 2005** (meta-analysis of risk assessment):
  faster and more direct approaches cause flight at greater distances.
- **Ydenberg & Dill 1986** (economic escape theory): a bird flees when the
  cost of staying (risk) exceeds the cost of leaving (lost foraging).
  Birds that are feeding tolerate a closer approach.

### 2.2 Group vigilance and contagious escape

- **Lima 1995** (collective detection): one bird leaving is ambiguous
  because birds leave for many reasons. Flock-mates tend to ignore single
  departures.
- **Cresswell, Hilton & Ruxton 2000** (redshank, *Proc. R. Soc. B*): a
  rule that avoids "superfluous" escape flights. The flock responds when
  **several birds leave at once**, and the response is faster when more
  birds have detected the threat.
- FID tends to increase with flock size ("contagious fear"). Larger
  groups detect earlier and the first departure propagates.
- **Reynolds 1987** (boids): separation, alignment and cohesion. Enough
  for the short group flights after a flush; no full flocking simulation
  is needed.

### 2.3 Spacing on perches

- **Conder 1949** introduced *individual distance*: the minimum spacing a
  bird keeps from its neighbours. It is species-specific and ranges from
  near-contact (swallows and many finches, about 10 cm, under one body
  length) to several body lengths (territorial birds).
- Birds on a wire space themselves roughly evenly at about that distance,
  which simple "birds on a wire" exclusion models reproduce.

### 2.4 Which part of the tree: niche partitioning

- **MacArthur 1958** divided spruces into 16 zones: height bands crossed
  with base (near trunk), middle and terminal (outer twigs) along each
  branch. Five warbler species that looked like competitors used
  different zones. Cape May warblers used the outer top; bay-breasted
  warblers used the middle interior; myrtle (yellow-rumped) warblers were
  generalists lower down.
- The general pattern holds across guilds. Raptors and corvids use
  exposed tops and dead snags. Flycatcher and kingfisher types use
  exposed perches with open space in front. Owls use thick limbs near the
  trunk under cover. Warblers use terminal twigs. Thrushes and sparrows
  use low, inner branches.

### 2.5 What a perch must be: grip mechanics

- **Backus et al. 2015** (*R. Soc. Open Sci.*, mechanical analysis of
  avian feet): grasp quality is best for perch diameters around
  **20–30% of foot span**. Much thinner and the toes overwrap; much
  thicker and the toes cannot close.
- Grip force studies on parrots (*JEB* 2023) peak at small diameters, and
  husbandry studies report preferred diameters near the
  foot-span-matched size. Doves choose stiffer perches near a fulcrum.

### 2.6 Takeoff

- **Earls 2000** (starling and quail): the **legs supply 80–90%** of
  takeoff velocity through a countermovement jump (a crouch, then
  extension). The wings start flapping around leaving the perch.
- **Provini et al. 2012** (zebra finch and diamond dove): legs give
  **93.6%** (finch) and **95.2%** (dove) of the initial flight velocity.
  The first downstroke produces only about 58–62% of the lift of later
  beats. Takeoff is a jump, then wings.

### 2.7 Flight style

- **Tobalske, Peacock & Dial 1999** (zebra finch) and
  **Tobalske 2001** (review):
  - small birds **flap-bound**: bursts of flapping alternate with
    wings-folded ballistic bounds, giving an undulating path
  - birds of about 35–150 g flap-*glide* at slow speeds and flap-bound at
    fast speeds
  - birds above about 300 g do not bound; they flap continuously or
    flap-glide
  - large raptors soar and glide
  - woodpeckers are near the upper mass limit for bounding
- **Pennycuick 1996**: cruising wingbeat frequency
  \(f \approx m^{3/8}\, g^{1/2}\, b^{-23/24}\, S^{-1/3}\, \rho^{-3/8}\).
  For our purposes, frequency falls steeply with size: about 20 Hz for a
  warbler, 8–10 Hz for a thrush, 4–5 Hz for a crow and 2–3 Hz for a
  buzzard. On-screen beats can be slowed down (birddraw's flap already
  clamps to 2.5–5 Hz for legibility).

### 2.8 Landing

- **Provini et al. 2014** (finch and dove): the last wingbeats *brake*.
  Touchdown is about 1 m/s and landing forces are about half those of
  takeoff, because the wings absorb most of the energy. Zebra finch body
  angle is about **56–65° at touchdown**, then settles to about 24° on the
  perch.
- **Roderick et al. 2019** (parrotlets, *eLife*): a stereotyped approach
  no matter what the surface is. The feet then *squeeze, then relax* on
  contact, and the claws drag and catch. The visual cue to copy: legs
  swing forward, body tilts up steeply, wings flare, toes close, a small
  bounce on the branch, then wings fold.

### 2.9 Tree architecture

- **Leonardo's rule** (Eloy 2011, *PRL*): at a branching point,
  \(d^{\Delta} = \sum_i d_i^{\Delta}\) with \(\Delta \approx 2\)
  (observed range 1.8–2.3). Given twig diameters, every limb's diameter
  follows from the topology. This gives each perch a physically plausible
  thickness at no extra cost.
- **Space colonization** (Runions, Lane & Prusinkiewicz 2007): scatter
  attraction points inside a crown envelope and grow nodes toward the
  points within an influence radius, killing points within the kill
  distance. It produces convincing, non-intersecting branching for many
  crown shapes, is fast in 2D, and is controlled by the envelope shape.
- **Self-organizing trees** (Palubicki et al. 2009): competition for light
  and space, bud fate. Richer, but heavier than we need. Worth borrowing
  only the idea that shaded inner branches die back, which creates bare
  inner perches. That is where owls and thrushes sit.

### 2.10 Vigilance behaviour

- Vigilant birds increase **head-movement rate** and orient the head
  toward the threat (Fernández-Juricic 2012, review of the sensory basis
  of vigilance). birddraw already has head saccades (`sacc`), so the alert
  state is a change of parameters: a higher saccade rate, yaw aimed at
  the cursor, body sleeked (smaller breath amplitude), crest raised.

---

## 3. birddraw's costs: measured

Averages over 12 random seeds on this machine (Node, single thread):

| operation | cost |
|---|---|
| `main(seed)`: generate one static bird | **152 ms** |
| `animator(seed)`: build the rig after generation | **107 ms** |
| `frame(t)`: exact hidden-line frame | **6.9 ms** |
| `ops(t)`: painter's frame (screen use) | **1.9 ms** |
| size of a bird | 824 polylines, about 3,100 points |

Share of a bird's polylines that are at least 2 px long at different
on-screen bird heights (8 seeds):

| bird height on screen | lines kept | points kept |
|---|---|---|
| 24 px | 12% | 37% |
| 48 px | 25% | 51% |
| 96 px | 57% | 75% |
| 192 px | 85% | 91% |

What follows from this:

- **Generation cost dominates.** 30 birds cost about 7.8 s of CPU time to
  build. It has to happen in Web Workers, in the background and
  progressively. A good way to hide that latency is to have birds *fly
  in* as they become ready, rather than appear.
- **Animating every bird at full detail does not fit a frame.** 30 birds ×
  1.9 ms = 57 ms. But at typical playground sizes (24–48 px) 75–88% of the
  lines are sub-pixel. A simple length-based cull, computed once per zoom
  level, cuts per-frame work several-fold with no visible change.
- **Exact hidden-line rendering (6.9 ms) is for export only.** The screen
  uses the painter's path, exactly as birddraw's alive mode already does.

---

## 4. Proposed architecture

### 4.1 Module layout

birddraw stays a single-file library. The playground is a separate,
dependency-free browser app that imports it:

```
playground/
  index.html      UI shell, canvas, input
  world.js        seeds, chunk planner, grove types, depth bands
  trees.js        tree generators -> {skeleton, lines, masks, foliage}
  perch.js        perch extraction, scoring, spacing
  birds.js        species community, birddraw adapter, LOD
  behave.js       per-bird state machine, alarm contagion, flight paths
  render.js       layer compositor, tile cache, painter ops, export
  worker.js       generation worker (trees and birds)
vendor/shan-shui/ LICENSE plus any verbatim snippets
```

### 4.2 Deterministic world

- `world_seed` comes from the URL, like shan-shui.
- Chunk *k* covers `[k·W, (k+1)·W)` with W = 512 units. Its RNG is
  `hash(world_seed, k)`. Each grove, tree and bird inside derives its own
  sub-seed: `hash(chunk_seed, kind, i)`.
- Large-scale structure (grove density, ground height, species pool,
  season) comes from **noise in world coordinates**, so it is continuous
  across chunk edges and needs no neighbour state.
- Objects belong to the chunk that contains their root x. To keep spacing
  across an edge, a chunk regenerates its *neighbours' anchor points only*
  (cheap, deterministic) and rejects candidates that conflict with them.
- **Dynamic state is a delta layer.** The world is a pure function of the
  seed. Birds that have moved, the life list and any seed scattered are
  stored as overrides keyed by chunk. Leaving and coming back keeps them;
  a "reset" clears them.

### 4.3 Visual style: unify on birddraw's pen

shan-shui is an ink-wash painter: variable-width filled ribbons with
translucent tones. birddraw is a pen plotter: monoline polylines with
hatching and true hidden-line removal. Mixing them unchanged would look
like two programs pasted together.

The recommendation is to **port shan-shui's tree grammar into birddraw's
pen idiom**:

- `stroke()` ribbons become *outline polylines* (left and right edges)
  plus a *mask polygon* (the ribbon itself) for occlusion. This is exactly
  the `{lines, masks}` pair birddraw's painter path already uses: fill the
  mask with paper colour, then stroke the lines.
- Translucent tone becomes **hatching density**. birddraw's vendored
  fishdraw kernel already has hatch and shade helpers (`shade_shape`).
- `barkify` marks and knots become short polylines on the trunk, clipped
  to the trunk mask.
- Leaf `blob`s become outlined blobs, optionally with one centre vein.
  Distant foliage becomes stipple or contour hatching instead of tone.
- **Atmospheric perspective**: far bands get thinner pens, sparser hatching
  and lighter strokes. On screen that is line alpha; on a plotter, a
  lighter pen or skipped hatching.

An optional "brush" render mode can fill the same masks with grey tones
for a shan-shui look on screen. The geometry is identical, so plotter
export is unaffected.

### 4.4 Trees as data

Every generator returns:

```js
{
  skeleton: [{id, parent, p:[x,y], r, depth, kind:'trunk'|'limb'|'twig'}],
  lines:   [...polylines],          // outlines, bark, hatching
  masks:   [...polygons],           // trunk/limb ribbons, foliage masses
  foliage: [{poly, z:'back'|'front'}],
  bbox, base:[x,y], height
}
```

Generators to build, in order of value for birds:

1. **Bare or gnarled** (port of tree06 `fracTree` plus tree08 twigs): the
   best for showing birds, and the simplest. The default for a "winter"
   season.
2. **Broadleaf** (port of tree04): trunk, limbs at 30–70% of the height,
   twigs, leaf clusters. Use space colonization inside an ellipse or cloud
   envelope for richer, non-overlapping crowns. Leaf density follows the
   season, so birds become visible as leaves fall.
3. **Conifer or spruce** (port of tree05): whorls of near-horizontal
   branches. This is literally MacArthur's tree, which makes zone
   preferences easy to see.
4. **Pine, ink-style** (tree06 with flat-topped foliage pads): the
   classic shan-shui silhouette, with perches under the pads.
5. **Shrubs and hedges** (tree02 and tree07): low cover for sparrows and
   thrushes.
6. **Snags** (dead trunk with broken limbs): raptor and woodpecker perches.

**Branch diameter:** assign twig diameters from the species of tree, then
compute every parent diameter bottom-up with Leonardo's rule
\(d_{parent} = (\sum d_i^2)^{1/2}\) (Δ = 2). Store `r` on each skeleton
node. Perch suitability then follows directly from that radius.

### 4.5 Perch extraction

Sample every skeleton segment at even intervals. A sample is a candidate
perch when all of these hold:

- **Near-horizontal:** segment angle within ±25° of horizontal. birddraw
  supports branch tilt through `perch_tilt`, but large tilts look wrong.
- **Diameter fits the foot.** Foot span scales with body length, so accept
  \(d \in [0.5, 2.5] \times d^*\) with \(d^* \approx 0.25\,\text{foot span}\)
  (Backus et al. 2015). Score highest near \(d^*\). Small birds take
  twigs, large birds take limbs.
- **Clearance:** the bird's bounding box, placed on the branch, must not
  intersect other branch masks. It may intersect `foliage.z='front'`
  masks; the bird is then partly hidden behind leaves, which is realistic
  and makes spotting birds a game.
- **Zone:** each candidate is tagged with MacArthur-style coordinates:
  - height band: bottom, middle or top third of the crown
  - branch position: base (near trunk), middle or terminal (outer twigs)
  - exposure: the fraction of a small sky-ward cone that is free of
    masks

Each archetype has a preference table over (band, position, exposure,
diameter). Proposed defaults, from §2.4:

| archetype | band | position | exposure | notes |
|---|---|---|---|---|
| warbler | top/mid | terminal | medium | many small twigs |
| finch, sparrow | low/mid | middle | low/medium | flocks, short spacing |
| thrush | low | base/middle | low | inner branches |
| corvid | top | middle | high | thick limbs, snags |
| raptor | top | base/middle | **very high** | snags, the tallest tree |
| owl | mid | **base** | **very low** | thick limb against the trunk |
| kingfisher | low/mid | terminal | high, open space in front | over water if any |
| swallow | top | terminal, bare | high | lines of birds |
| parrot | mid/top | middle | medium | pairs or flocks |
| wader | ground or water edge | n/a | n/a | not in trees (§4.6) |

**Placement:** for each bird (§4.6), sample candidates with weights equal
to the preference score. Reject any within the archetype's individual
distance of already-placed birds: about 0.6 body lengths for swallows and
finches, 2–4 for territorial species (Conder 1949). This is shan-shui's
`vegetate` proof rule, reused.

### 4.6 Species community

- Each chunk draws a *species pool* from world-coordinate noise, so
  neighbouring chunks share species and the world has regions.
- Abundance is skewed: a few common species and many rare ones (a
  log-series or Zipf-like draw), which makes rare finds feel rare.
- Each species is a fixed birddraw seed (a generated binomial name).
  Individuals are the *same species seed* with small per-individual
  variation: facing, pose, and sex or age variants later.
- Social archetypes (finch, sparrow, swallow, parrot) spawn in groups of
  3–12 on nearby perches. Solitary ones (raptor, owl, kingfisher) are
  rarer and come alone or in pairs.
- **Size.** Real proportions make birds tiny next to a 15 m tree: a
  sparrow would be about 12 px on an 800 px-tall scene. Use body length
  \(BL \approx 5\,\text{cm} \times M^{1/3}\) (mass M in g; a 30 g sparrow
  is about 15 cm, a 400 g crow about 37 cm), times a global
  **bird-scale exaggeration** k ≈ 2–3 (user-adjustable). shan-shui
  exaggerates its figures and houses the same way. Relative sizes between
  species stay true.
- **Waders and ground birds** use a ground or water-edge strip at the front
  of the scene rather than trees.

### 4.7 Integrating birddraw birds

What birddraw already gives us:

- The perch is a **separate part** in the rig, layered *between* the near
  tarsus and the near hind toe, with the far leg behind it (`legacy[7]`,
  `P('perch', ...)` in `anim_rig`). The toes are shaped around a perch of
  thickness `PT = BL · perch_ratio`, and `perch_tilt` sets its slope.
- `TEMPERAMENT` already gives each archetype a mass, saccade rate, yaw and
  roll ranges, and tail habits.

Adapter, per bird:

1. Set `perch_ratio = branch_diameter / BL` and
   `perch_tilt = tan(branch_angle)` (and `facing` as chosen) before
   building the rig, so the toes wrap the real branch. These are
   parameter overrides, so they do not affect birddraw's static golden
   output.
2. **Splice the perch.** Remove birddraw's own perch part and put in a
   *clipped copy of the real branch*: the tree's lines and mask between
   `x0` and `x1` around the foot. The near toes then draw in front of the
   real branch and the far leg behind it, the way they do now. The tree
   layer underneath stays unchanged; the spliced copy covers it exactly.
3. **Transform:** world placement = translate so the foot point `meta.F`
   lands on the branch top surface, then scale by `BL_world / BL`.
4. **Depth:** the bird is drawn after its own tree's back foliage and
   branches and before the tree's `front` foliage. Trees in nearer depth
   bands draw after it.

### 4.8 Rendering and level of detail

**Layers, back to front:**

1. sky and paper texture
2. far band (distant hills, small trees), cached tiles
3. middle band of trees, cached tiles
4. near band, split into back-tree tiles, then birds, then front foliage
   tiles
5. ground strip
6. UI (lens, cursor, cards)

Tiles are drawn once per chunk per zoom into `OffscreenCanvas` and
`ImageBitmap` objects. Horizontal parallax between bands is just an x
offset per band.

**Bird detail tiers:**

| tier | when | how | cost |
|---|---|---|---|
| sprite | far away, off-focus, or more than N birds active | cached bitmap of the rest pose; only blinks and head turns are shown as swapped sprites | ~0 |
| idle | on screen, normal | `ops(t)` with lines culled to at least 1.5–2 px at the current zoom | ~0.3–0.6 ms (estimate from the cull table) |
| focus | hovered, in the binocular lens, or flying | full `ops(t)` | ~2 ms |
| export | plotter output | `frame(t)` exact, plus tree polylines through the occluders | offline |

**Budget:** about 30 idle birds plus 3–5 focus birds stays under 16 ms on
the main thread.

**Workers:** a pool of `navigator.hardwareConcurrency − 1` workers runs
`main()` and `animator()` for birds and the tree generators, and returns
typed arrays (Float32Array polylines plus offsets) as transferables. Only
the animation needs the rig's closures. Option A rebuilds the rig in the
render thread from transferred data. Option B renders each bird's frames
in its worker into a transferred `ImageBitmap`. Option B is simpler and
keeps the main thread free. `OffscreenCanvas` and worker
`requestAnimationFrame` are Baseline since 2023; feature-detect them.
Re-use `Path2D` objects for static parts.

**birddraw changes this implies** (small and opt-in):

- Tag polylines with a kind (outline, barb, hatch, scale) so the cull can
  drop barbs before outlines, not purely by length.
- A cheap `ops_lod(t, minLen)` entry point.
- A rig flag that skips the built-in perch, to support the splice.

**Plotter export:** select a region, gather tree polylines and masks plus
the birds' exact frames at the current time, run them through the existing
occluder clip from front to back, and write SVG. This is the same
pipeline as birddraw's static output, so results are pen-ready.

---

## 5. Interaction design

### 5.1 The cursor is an observer

The pointer is a person in the scene. Each bird computes:

- `d`: the distance from the cursor to the bird, in world units at the
  bird's depth (nearer bands are "closer")
- `v`: the cursor's approach speed toward the bird (the component of
  velocity along the line to the bird)
- `AD`: alert distance; `FID`: flight initiation distance

```text
FID  = FID0 · (M / 100 g)^0.29 · f_species · f_group · f_speed · f_start
AD   = 2.5 · FID                         (AD ~ FID, r≈0.96)
f_group = 1 + 0.15·log2(n_neighbours+1)  (contagious fear)
f_speed = 1 + clamp(v / v_ref, 0, 2)     (fast, direct approach -> earlier)
f_start = smoothstep on how far away the cursor was when the approach began
f_species: flighty (finch, warbler, corvid) 1.2; tame (sparrow, parrot) 0.8; owl 0.6
```

`FID0` is a scene constant chosen so that a slow cursor can get close
enough to see a sparrow in the lens.

**States:**

- **relaxed:** normal birddraw idle (all of `ANIM_MOVES`).
- **alert** (`d < AD`):
  - head yaw aimed at the cursor, with the eye on the cursor side
  - saccade rate ×2
  - breath amplitude ×0.6 (sleeked)
  - crest raised
  - tail flicks more often

  This is a parameter change on the existing channels. If the cursor
  stops or leaves, the bird decays back to relaxed after 2–5 s.
- **flush** (`d < FID`, or a click or "clap" nearby): takeoff (§5.3).
- **habituation:** a bird that was alerted repeatedly without being
  approached lowers its `f_species` slightly. Stillness is rewarded.

### 5.2 Alarm contagion

When a bird flushes, every bird in the same tree and every bird within
radius R checks the following:

- **One** departure within 0.6 s: become alert, with a 20–30% chance of
  flushing (higher for flock species).
- **Two or more** departures within 0.6 s: flush with a small random
  delay, 50–250 ms, shorter when more birds have left (Cresswell et al.
  2000; Lima 1995).
- Solitary species (owl, raptor) ignore contagion unless the cursor is
  inside their own AD.

This produces ripples through a flock without everything leaving at
once.

### 5.3 Takeoff, flight, landing

**Takeoff** builds on the existing flap sequence:

1. **Crouch** (countermovement), about 0.1–0.2 s. birddraw already has
   the −0.04·BL crouch.
2. **Leg thrust:** most of the initial velocity, up and away from the
   cursor, with the legs still extended for the first ~60 ms.
3. **First downstroke** as the feet leave, weaker than later ones.
4. **Branch recoil:** the perch tip springs down then oscillates.
   Leonardo radii give stiffness, so thin twigs bounce more.

**Flight** picks a destination perch scored like §4.5, but *away from the
cursor* and outside the new FID, preferring the same tree for small
disturbances and another tree or offscreen for big ones. The path depends
on mass (Tobalske 1999/2001):

- **under 35 g: flap-bound.** Bursts of 3–6 beats, then 0.1–0.2 s with
  wings folded on a ballistic arc. The path undulates visibly.
- **35–300 g: flap-glide** when slow and flap-bound when fast.
- **over 300 g: continuous flapping or flap-glide**, with longer glides on
  descent. Raptors circle and glide.
- **Beat rate:** mass-scaled (Pennycuick 1996), then slowed into the
  visible range. birddraw's `fb` is already a slowed mass law.

The trajectory is a smooth curve (cubic or Bézier) between perches with
arrival tangents matching the landing posture. Group flights add boids
separation and alignment so a flock moves as a loose cloud.

**Landing** (Provini 2014; Roderick 2019):

1. Approach slightly below the perch, then **pitch the body up to
   55–65°**.
2. Wings flare and give 2–3 **braking beats**; legs swing forward.
3. Touchdown: the toes close (birddraw toe shapes interpolate from open
   to wrapped) and the branch dips.
4. **Settle:** body angle eases to the archetype's posture over about
   0.3 s, the wings fold (the flap rig's fold), and a tail flick
   follows.

**birddraw work this needs** (the biggest technical item in the project):

- A **flight pose**: legs tucked (rotate the tarsus about the hip, toes
  curled), body horizontal, and a gliding "wings open, static" pose. The
  articulated open-wing rig from the flap feature covers most of it.
- **Facing changes in flight:** mirror the bird at mid-turn, hidden by a
  wingbeat, or by flying the turn edge-on.

### 5.4 Other interactions, ranked by value and cost

| interaction | description | value | cost |
|---|---|---|---|
| hover look | bird turns its head to the cursor (alert state) | high | low |
| approach and flush | §5.1–5.3 | **core** | high |
| click card | field-guide card: generated binomial name, archetype, length, mass, wingspan, habitat zone, and the full-detail static drawing | high | low |
| life list | species seen or identified, stored in `localStorage`; counts per world seed; "rare" badges | high | low |
| binoculars | hold Shift or right-click: a circular lens shows full-detail birds and lets you identify partly hidden ones | high | medium |
| scatter seed | click the ground: ground-foraging species (sparrow, finch, thrush) come down; birds that are feeding tolerate closer approach (Ydenberg & Dill) | medium | medium |
| shake a tree | drag a trunk: the tree sways and every bird in it flushes | medium | medium |
| whistle or clap | key press: every bird within radius goes alert; flighty ones flush | medium | low |
| sit still | not moving the cursor for 10 s lowers FIDs, and shy species (owl, kingfisher) can appear | medium | low |
| seasons and time | leaf density, light hatching tone, which species are present | medium | medium |
| photograph | frame a region: export the plotter SVG or PNG | medium | low (reuses export) |

Touch: tap equals click, long-press equals binoculars, and dragging moves
the observer (and pans).

---

## 6. Phased roadmap

Each phase is useful on its own.

1. **Static treescape.** Deterministic chunks, ports of bare, broadleaf
   and conifer trees with skeletons and Leonardo radii, perch extraction,
   species community, birds spliced onto real branches, a single static
   scene, and plotter SVG export. *Proves the aesthetic merge.*
2. **Living scene.** Workers, tile cache, bird LOD tiers, idle animation
   for every visible bird, horizontal scrolling with streamed chunks and
   parallax bands.
3. **Observer.** Hover alert and head tracking, the click card, the life
   list.
4. **Flight.** Flight pose in birddraw, takeoff, flap-bound or flap-glide
   paths, landing, branch recoil, alarm contagion, re-perching, plus
   tests for determinism and timing like the existing animation suite.
5. **Toys.** Binoculars, seed, tree shake, whistle, seasons.

---

## 7. Risks

- **Aesthetic merge.** shan-shui's charm is ink tone; a pen-only port could
  look sparse. Phase 1 should compare a hatching-only tree with a
  brush-mode tree side by side before committing.
- **Bird scale versus scene scale** (§4.6). Exaggeration is unavoidable.
  The lens hides some of the compromise.
- **Generation latency.** 0.25 s of CPU per bird. Needs workers, per-species
  caching (most individuals in a flock share a species seed, so build the
  rig once per species and re-pose it, but per-individual perch splices
  need their own leg part), and fly-in arrival.
- **Flight pose** is new rig work in birddraw and must not disturb the
  static golden hashes or alive mode. It belongs in its own `ANIM_MOVES`
  channel and RNG stream, per `AGENTS.md`.
- **Perch tilt beyond ±25°** looks wrong with birddraw's fixed leg
  geometry. Perch extraction must enforce the limit.
- **Depth.** All trees are flat 2D silhouettes. Birds can only perch on
  the visible side; there is no "around the trunk". This is consistent with
  shan-shui's 2.5D layers and fine for the style.

---

## 8. Decisions

1. **World shape:** infinite horizontal scroll, like shan-shui. The
   deterministic per-chunk seeding (§4.2) and streamed chunks with
   parallax bands therefore move into the first version.
2. **Style:** pen-only, plotter-consistent with birddraw (§4.3). There is
   no brush mode in the first version.
3. **First-version interactions:** observe only. That means hover alert
   with head tracking, the click field-guide card and the life list.
   Flushing, flight and landing (§5.2–5.3) wait for a later phase.
4. **Delivery:** a new `playground/` folder in this repo.

The first version is therefore roadmap phases 1–3: a static treescape,
then the living, scrolling scene, then the observer interactions.

---

## References

- Huang, L. (2018). *shan-shui-inf*. MIT licence.
  https://github.com/LingDong-/shan-shui-inf
- Backus, S. B., Sustaita, D., Odhner, L. U., & Dollar, A. M. (2015).
  Mechanical analysis of avian feet: multiarticular muscles in grasping
  and perching. *Royal Society Open Science* 2, 140350.
- Blumstein, D. T. (2006). Developing an evolutionary ecology of fear: how
  life history and natural history traits affect disturbance tolerance in
  birds. *Animal Behaviour* 71, 389–399.
- Conder, P. J. (1949). Individual distance. *Ibis* 91, 649–655.
- Cresswell, W., Hilton, G. M., & Ruxton, G. D. (2000). Evidence for a rule
  governing the avoidance of superfluous escape flights. *Proc. R. Soc. B*
  267, 733–737.
- Earls, K. D. (2000). Kinematics and mechanics of ground take-off in the
  starling *Sturnis vulgaris* and the quail *Coturnix coturnix*. *J. Exp.
  Biol.* 203, 725–739.
- Eloy, C. (2011). Leonardo's rule, self-similarity, and wind-induced
  stresses in trees. *Phys. Rev. Lett.* 107, 258101.
- Fernández-Juricic, E. (2012). Sensory basis of vigilance behavior in
  birds: synthesis and future prospects. *Behavioural Processes* 89,
  143–152.
- Lima, S. L. (1995). Collective detection of predatory attack by social
  foragers: fraught with ambiguity? *Animal Behaviour*.
- MacArthur, R. H. (1958). Population ecology of some warblers of
  northeastern coniferous forests. *Ecology* 39, 599–619.
- Palubicki, W., et al. (2009). Self-organizing tree models for image
  synthesis. *ACM Trans. Graph.* 28(3).
- Pennycuick, C. J. (1996). Wingbeat frequency of birds in steady cruising
  flight: new data and improved predictions. *J. Exp. Biol.* 199,
  1613–1618.
- Provini, P., Tobalske, B. W., Crandell, K. E., & Abourachid, A. (2012).
  Transition from leg to wing forces during take-off in birds. *J. Exp.
  Biol.* 215, 4115–4124.
- Provini, P., Tobalske, B. W., Crandell, K. E., & Abourachid, A. (2014).
  Transition from wing to leg forces during landing in birds. *J. Exp.
  Biol.* 217, 2659–2666.
- Reynolds, C. W. (1987). Flocks, herds and schools: a distributed
  behavioral model. *SIGGRAPH '87*.
- Roderick, W. R. T., Chin, D. D., Cutkosky, M. R., & Lentink, D. (2019).
  Birds land reliably on complex surfaces by adapting their foot-surface
  interactions upon contact. *eLife* 8, e46415.
- Runions, A., Lane, B., & Prusinkiewicz, P. (2007). Modeling trees with a
  space colonization algorithm. *Eurographics Workshop on Natural
  Phenomena*.
- Stankowich, T., & Blumstein, D. T. (2005). Fear in animals: a
  meta-analysis and review of risk assessment. *Proc. R. Soc. B* 272,
  2627–2634.
- Tobalske, B. W. (2001). Morphology, velocity, and intermittent flight in
  birds. *American Zoologist* 41, 177–187.
- Tobalske, B. W., Peacock, W. L., & Dial, K. P. (1999). Kinematics of
  flap-bounding flight in the zebra finch over a wide range of speeds.
  *J. Exp. Biol.* 202, 1725–1739.
- Weston, M. A., McLeod, E. M., Blumstein, D. T., & Guay, P.-J. (2012). A
  review of flight-initiation distances and their application to managing
  disturbance to Australian birds. *Emu* 112, 269–286.
- Ydenberg, R. C., & Dill, L. M. (1986). The economics of fleeing from
  predators. *Advances in the Study of Behavior* 16, 229–249.
