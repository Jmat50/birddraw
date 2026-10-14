# Idle animation ("alive" mode)

birddraw can animate any seed with subtle idle motion: breathing, the folded wing riding on the flank, head saccades and tilts, blinks, tail pumps and flicks, wader teetering, and crest follow-through. The loop is seamless (default 6 s). It is made of the same polylines as the static drawing, so every frame can still be plotted.

The static drawing is unchanged: `main(seed)` is byte-identical to before (guarded by `test/static_golden.js`), and the animation draws its randomness from separate streams (`seed + '#anim'`, `seed + '#timeline'`).

## 1. Anatomy and behaviour

### Breathing

Birds have no diaphragm. They ventilate their air sacs by swinging the **sternum ventrally and cranially**, down and forward. The vertebral and sternal ribs act like a pump handle, helped by the uncinate processes and the appendicostalis muscles. The dorsal spine, synsacrum and hip stay essentially still.

- Claessens 2009, *J Exp Zool A* 311A: cineradiography of emu, tinamou and guinea fowl.
- Codd et al. 2005, *J Exp Biol* 208: the uncinate muscles.

**What you see** is the belly and lower breast moving while the back line, hip and legs stay put.

**Rate.** Resting breathing frequency scales with body mass (Lasiewski & Calder 1971):

\[ f\,[\text{breaths/min}] = 17.2\, M^{-0.31}, \quad M \text{ in kg} \]

A 20 g finch breathes about 58 times a minute and a 1 kg raptor about 17. Each archetype carries a typical mass in `TEMPERAMENT`, jittered ±20%; `tools/build_tables.js` can refresh it from AVONET medians (`mass_g`). Both inspiration and expiration are active; at rest expiration is slightly longer, so the waveform is a raised-cosine rise over 45% of the cycle and a fall over 55%.

**Amplitude.** Belly displacement is small, about 1.5–3% of body depth. The default is `0.025 × intensity × BH`. This value is a judgement call and can be tuned.

### The folded wing

At rest the folded wing is held against the flank by its own muscles. It does not flap or flex; it only rides on the ribcage as the ribcage expands. In side view that is a tiny downward and forward translation plus a fraction of a degree of rotation about the shoulder. It is a **rigid** motion: feathers do not stretch. So the wing is its own motion group, coupled to the breathing signal at the shoulder. Comfort movements (wing flicks, droops, stretches) are out of scope, but the group and shoulder pivot are in place to add them.

### Head

Birds have little eye movement, so they shift gaze with **head saccades**: a fast rotation followed by a hold. Between saccades head stabilisation keeps the head almost perfectly still, and breathing is not transmitted to it.

- Land 2015, *J Comp Physiol A* 201.
- Eckmeier et al. 2008, *PLoS ONE* 3:e3956: the zebra finch gaze strategy.

**Profile.** Each saccade follows the minimum-jerk profile (Flash & Hogan 1985):

\[ s(\tau) = 10\tau^3 - 15\tau^4 + 6\tau^5 \]

Its duration grows with amplitude, `D = 0.05 s + 0.003 s/deg × |amp|`, similar to the "main sequence" of primate eye movements.

**Head tilts (roll)** are frequent, because a laterally placed eye looks up or down by rolling the head. Thrushes and corvids cock the head the most, and parrots up to ±25°.

**Owls** cannot move their eyes in the sockets. Instead of twitchy saccades they make slow, smooth, large pans of 0.6–1.5 s, with yaw up to ±35°. Every loop gets at least one look away and back, even when the Poisson draw produces no event.

**The rotation pivot** is the atlanto-occipital joint, which lies posterior and ventral to the skull centre. Rotating about it also translates the head slightly, which is correct.

### Blinks

All birds have a **nictitating membrane**, a translucent third eyelid that sweeps across the eye from the anterior corner backward and slightly downward.

- **Most birds** close the eyelids with the **lower** lid, and rarely.
- **Owls** close with the **upper** lid and often rest with the eyes half-closed: `lid_rest` is drawn from 0.15–0.5.
- **Coupling to gaze shifts:** in peafowl, blinks cluster at gaze shifts (Yorzinski 2016, *Sci Rep* 6:32471). Each saccade carries a blink with probability `couple` (0.2–0.5), and there is a low spontaneous rate on top.
- **Timing:** a nictitans blink lasts 0.12–0.2 s, 40% of it closing and 60% opening. An owl's lid blink lasts 0.3–0.5 s.

### Tail

The tail pivots at the **pygostyle** through the levator and depressor caudae muscles; the rectricial bulbs spread the fan. Tail pumping and wagging are documented signals, for example the Black Phoebe (Avellis 2011, *Wilson J Ornithol* 123) and the White Wagtail (Randler 2006, *Anim Behav* 71).

Each event is a quick excursion with an elastic return, modelled as an alpha function:

\[ K(t) = A\,\frac{t}{\tau_k}\,e^{1 - t/\tau_k}, \qquad \tau_k \approx 0.1\text{–}0.15\text{ s} \]

There are three tail styles:
- `pump` goes down first.
- `flick` goes up first.
- `none` keeps the tail still.

Each rectrix rotates by `tau + i × 0.045 × spread`, so the fan opens slightly at the peak. The upper coverts follow at 35% and the under coverts at 25%.

**Teetering** waders, such as the Spotted Sandpiper, bob the whole rear body. This is a small pitch of the body, wing, tail and head about the hip, with the legs and perch fixed. It comes in bouts of a 2–4 Hz sinusoid under a Hann envelope.

### Wing flicks (optional)

Many small birds briefly flick the folded wing; kinglets and flycatchers do it constantly. The wing stays folded and rigid. It rotates about the shoulder so the tip lifts clear of the tail (up to about 9° at full intensity) and drops back, in bouts of 1–3 flicks at 5–7.5 Hz with a \(\sin^2\) profile. Each archetype has its own rate (`wflick`), and the flicks come from a separate random stream (`seed#wing`), so turning them on leaves every other channel unchanged.

### Wing flaps (optional)

A flap is a short takeoff: the bird crouches, spreads its wings, beats them a few times to lift off the perch, then lands and folds.

The static drawing only has a folded wing, so the flap uses a separate, **articulated** open wing:
- **Skeleton:** three bones (humerus, ulna, manus), with lengths 0.22, 0.30 and 0.18 of the folded wing length.
- **Joints:** their angles interpolate between the folded Z-shape and the spread wing with an extension `e` in [0, 1].
- **Feathers:** every feather is a rigid shape from the same `feather()` primitive and style rules as the folded wing.
  - Primaries attach to the manus and fan from pointing backward (inner) to nearly spanwise (outer).
  - Secondaries hang off the ulna.
  - Tertials sit on the humerus.
  - Lesser, median, greater and primary coverts are laid on top in rows, with the feather nearer the body on top, as on a real wing.
- **Stroke:** the planform (span `u`, chord `v`) is projected through the stroke angle \(\varphi\): the span vector is \(\sin\varphi\) times a stroke plane leaning 15° back, so at the top of the stroke the wing reaches up and back and at the bottom it sweeps down and forward. With orthographic projection the wing goes edge-on as it passes horizontal, and the far wing lines up exactly behind the near one.
- **Wrist flexion:** in small birds the downstroke is fully extended and the upstroke flexes the wrist to cut drag, so \(e = 1 - 0.35\max(0, -\sin\psi)\) over the beat phase \(\psi\).

Timing of one flap:
1. **Crouch and spread** (0.18 s): the body dips by 4% of its length while the wing opens and rises to the top of the stroke.
2. **2–4 beats:** \(\varphi = 15° + 60°\cos\psi\), from 75° down to −45°. The hop height follows a minimum-jerk rise and fall that peaks at about 0.34 body lengths at default intensity. The body pitches nose-up by up to 8° about the hip. The feet leave the perch with the body, but stay planted during the crouch and landing so they never sink into the branch.
3. **Land and fold** (0.25 s): the wing folds back to the static folded drawing and the body absorbs the landing with a 3% dip.

**Beat rate.** Real takeoff wingbeats are 10–25 Hz in small birds, which would alias badly at 12–20 fps. The beat is slowed to \(5\,(M/20\,\text{g})^{-0.15}\) Hz, clamped to 2.5–5 Hz, so it still reads as a wingbeat and larger birds still beat more slowly.

**Framing.** The fixed framing covers the whole flap (wings at both ends of the stroke at full height), so the bird is drawn about 15–30% smaller when flaps are on.

**Occlusion.** During a flap the folded wing is hidden and the open wing is drawn in front of everything. The body plumage that was always generated under the folded wing shows through. The legs move to their own motion group and are clipped against the perch every frame.

### Follow-through

The crest lags head motion. It is a damped spring driven by the head's angular acceleration (Lasseter 1987, "secondary action"):

\[ \ddot{x} = -\omega^2 x - 2\zeta\omega\dot{x} - g\,\ddot{\theta}_\text{pitch}, \qquad \omega = 2\pi \cdot 4\text{ Hz},\ \zeta = 0.35 \]

It is integrated with semi-implicit Euler at 480 Hz over two loops, and only the second loop is kept, which makes it periodic.

### Temporal coherence

Hatching and texture must stick to the surface rather than swim through it (Praun et al. 2001, "Real-time hatching"; Bénard, Bousseau & Thollot 2011, a survey of temporal coherence in stylised rendering). All geometry is generated once in each part's own frame and only **transformed** per frame, so hatching, the plumage mesh and feather barbs stick automatically. Nothing random or noise-based is re-evaluated per frame, and Douglas–Peucker simplification is never run per frame because it would pick different vertices each frame and shimmer.

## 2. Pipeline

```
seed ─ generate_params (unchanged RNG) ─ build_rig ─┬─ render_static ─ main()   (byte-identical)
                                                    └─ anim_rig (cache)
seed#anim ─ anim_params ─ make_timeline ─ pose_at(t) ─ anim_maps ─┬─ render_exact → flipbook SVG, PNG, GIF
                                                                  └─ render_ops   → live canvas
```

- `build_rig(arg)` keeps the exact part list the static `compose()` uses, plus metadata: body frame, head geometry, tail feathers before occlusion, crest, shoulder and pygostyle.
- `anim_rig(rig)` builds the cache once, in about 200 ms:
  - resamples every line to at most 2 units and chunks it to at most 24 units
  - assigns motion groups
  - pre-clips each part by the front masks of its own group
  - records which other-group masks can ever overlap each part (rest bounding boxes grown by `0.2 × BL`)

### Why clipping can be cached

If lines `L` and masks `M` are moved by the same continuous bijection `f`, then clipping commutes with it:

\[ \text{clip}(f(L), f(M)) = f(\text{clip}(L, M)) \]

The error is only the polyline sampling error, kept small by the 2-unit resampling. Clipping by masks A and then B is the same as clipping by \(A \cup B\). So a part's lines are pre-clipped once against front parts that move with it, and per frame they are clipped only by masks of front parts in **other** groups.

The live renderer skips clipping altogether. It paints back to front, filling each mask with the paper colour and then stroking its lines, which gives the same visible result.

### Motion groups

| group | parts | motion |
|---|---|---|
| `static` | perch, legs, toes | none |
| `body` | body plumage and outline | breath field |
| `wing` | folded wing | rigid, coupled at the shoulder |
| `tail` | rectrices and coverts | per-feather rotation about the pygostyle, re-occluded per frame |
| `head` | head, eye, beak | 2.5D ellipsoid rotation |
| `crest` | crest | head map plus a lag rotation about the crest base |

Teeter rotates every non-static group about the hip.

## 3. Motion maps

### Breath field

The field is defined in body coordinates (\(q\) = point rotated by \(-\theta\), the posture angle), with \(u\) running head to tail and \(v\) running back to belly between the cached top and bottom body curves:

\[ u = \frac{q_x + BL/2}{BL}, \quad v = \frac{q_y - \text{top}(q_x)}{\text{bot}(q_x) - \text{top}(q_x)} \]
\[ w = \text{smoothstep}(0.15, 1, v)^{1.3}\, e^{-((u - 0.48)/0.3)^2}, \qquad d = A_b\, BH\, b(t)\, w\, (-0.25,\ 1) \]

The back (\(v \le 0.15\)) and both ends of the body do not move; the lower breast and belly move most. The test suite checks that the field never folds: the numeric Jacobian determinant over the body stays above 0.5 at twice the default amplitude. In practice its minimum is about 0.99.

### Wing

The wing translates by `0.3 × d(shoulder)` and rotates by `-0.3° × b(t)` about the shoulder.

### Ellipsoid head (2.5D)

- **Frame:** head-local, with radii `a = 1.04 HR`, `b = HR`, `c = 0.8 HR` (bird skulls are laterally narrow).
- **Lifting:** a point inside the head silhouette is lifted to \(z = c\sqrt{1 - (x/a)^2 - (y/b)^2}\).
- **Rotation:** by \(R = R_z(\text{pitch})\,R_x(\text{roll})\,R_y(\text{yaw})\) about the occipital pivot `K = (0.3a, 0.45b)`.
- **Projection and culling:** projected orthographically, and culled where the rotated normal faces away (\(n'_z \le 0\)).
- **Beak, crest and bristles** lie in the midsagittal plane \(z = 0\). They are culled by a closed-form ray–ellipsoid test, so the beak passes correctly behind the head when it turns away.
- **Silhouette:** the head outline is scaled by \(s_x = \sqrt{\cos^2\text{yaw} + (c/a)^2 \sin^2\text{yaw}}\) (and likewise for roll), then pitched.
- **Seam:** it is re-clipped each frame against the breath-mapped body outline.
- **Limits:** yaw and roll are clamped to ±25° (owls ±35° yaw). At those angles the area rotating in from behind the head would be blank, so the clamp keeps it out of view.

### Eye overlays

These are drawn in head-local 2D *before* the ellipsoid map, so they foreshorten with the eye.

- **Nictitating membrane:** a leading-edge arc sweeps from the anterior corner backward, drifting slightly down. The covered region gets sparse diagonal hatching so it reads as translucent, and the eye lines stay visible underneath.
- **Eyelid:** the lid edge is an arc. Eye lines on the covered side are removed, and the lid gets light hatching. Owls use the upper lid; other birds use the lower lid, for occasional long blinks.

## 4. Seamless loops

- **Breathing:** the cycle count is snapped to the loop, \(n = \max(1, \text{round}(f T))\).
- **Head:** the saccade sequence starts and ends at the same fixation \(g_0\).
- **Blinks and tail:** the kernels are wrapped, \(x(t) = \sum_k K((t - t_k) \bmod T)\).
- **Crest:** the spring's periodic steady state is used.

The tests check that `frame(0)` and `frame(T)` are identical and that every pose channel is continuous across the seam.

## 5. Outputs

| | API | CLI |
|---|---|---|
| live preview | `animator(seed).ops(t)`: painter ops; under 3 ms per frame | `index.html`, "alive" checkbox |
| exact frame | `animator(seed).frame(t)`: hidden-line polylines, plotter-ready; about 10–20 ms | `--format frames --out dir` |
| animated SVG | `draw_svg_flipbook(an.frames(12), an.T)` | `--format anim` |
| GIF | `anim_gif(an, fps, scale)` | `--format gif --out bird.gif` |
| PNG frames, strip | `tools/frames.js` | `node tools/frames.js "seed" --strip 8` |

**Framing** is computed once from the rest pose with a 4% margin, so frames do not jitter.

**Flipbook SVG.** Each polyline is written once per run of consecutive frames it appears in; lines present in every frame are not animated at all. Visibility is switched with discrete SMIL, and coordinates are quantised to 0.1 units. A 6 s, 12 fps loop is about 1.5–2.5 MB. Lower `--fps` or `--duration` gives a smaller file; the GIF (about 1 MB at 15 fps and 0.75 scale) is lighter.

**GIF.** A zero-dependency antialiased rasteriser (signed-distance coverage) feeds a GIF89a encoder: 16 grey levels, LZW, looping forever.

## 6. Tuning

| knob | where | effect |
|---|---|---|
| `intensity` (0–1, default 0.7) | `animator(seed, {intensity})`, `--intensity`, slider | scales every amplitude |
| `duration` (s, default 6) | `{duration}`, `--duration`, loop field | loop length; breathing snaps to it |
| `TEMPERAMENT[archetype]` | `birddraw.js` | mass, saccade rate and spread, blink rate and coupling, tail style weights, rate and amplitude |
| breath amplitude 0.025 | `anim_params` | belly excursion as a fraction of body depth |
| `moves` | `{moves}`, `--moves`, checkboxes | `breath`, `head`, `blink`, `tail` (with teeter), `crest` on by default; `wing` (flicks) and `flap` off |

Blended archetypes ("thrush+") interpolate numeric temperament values by the blend weight, and pick categorical ones (head style, lid, tail style) from one parent.

## References

- Avellis, G. F. 2011. Tail pumping by the Black Phoebe. *Wilson Journal of Ornithology* 123.
- Bénard, P., Bousseau, A., Thollot, J. 2011. State-of-the-art report on temporal coherence for stylized animations. *Computer Graphics Forum* 30(8).
- Claessens, L. P. A. M. 2009. The skeletal kinematics of lung ventilation in three basal bird taxa. *J Exp Zool A* 311A.
- Codd, J. R., Boggs, D. F., Perry, S. F., Carrier, D. R. 2005. Activity of three muscles associated with the uncinate processes of the giant Canada goose. *J Exp Biol* 208.
- Eckmeier, D., et al. 2008. Gaze strategy in the free flying zebra finch. *PLoS ONE* 3:e3956.
- Flash, T., Hogan, N. 1985. The coordination of arm movements: an experimentally confirmed mathematical model. *J Neurosci* 5(7).
- Land, M. F. 2015. Eye movements of vertebrates and their relation to eye form and function. *J Comp Physiol A* 201.
- Lasiewski, R. C., Calder, W. A. 1971. A preliminary allometric analysis of respiratory variables in resting birds. *Respiration Physiology* 11.
- Lasseter, J. 1987. Principles of traditional animation applied to 3D computer animation. *SIGGRAPH '87*.
- Praun, E., Hoppe, H., Webb, M., Finkelstein, A. 2001. Real-time hatching. *SIGGRAPH '01*.
- Randler, C. 2006. Is tail wagging in white wagtails an honest signal of vigilance? *Animal Behaviour* 71.
- Yorzinski, J. L. 2016. Eye blinking in an avian species is associated with gaze shifts. *Scientific Reports* 6:32471.
