# Arshad Pixel Character Animation Pack

Seven transparent horizontal sprite strips for a small website character. Every animation cell is **176 × 340 px** (nearest-neighbour 2× of the approved 88×170 art; frame order, alpha and per-frame placement preserved); the strips are sized to their frame counts and use transparent backgrounds.

Shipped as **lossless WebP** (bit-exact vs the PNG originals, which live in the git-ignored `images/.originals/idle-sprites/` folder — see the asset workflow in the root README). `character-sprites.css` references the WebP strips directly: the repo ships WebP-only, so a PNG fallback URL would 404.

| Animation | Frames | Suggested use |
|---|---:|---|
| `breathing-idle.webp` | 4 | Gentle looping idle |
| `blink-glasses-glint.webp` | 3 | Brief one-shot; trigger occasionally |
| `look-around.webp` | 4 | One-shot glance |
| `check-smartwatch.webp` | 6 | One-shot watch check |
| `weight-shift.webp` | 6 | Slow looping stance shift |
| `greeting-wave.webp` | 6 | One-shot on load or hover |
| `quest-complete.webp` | 8 | One-shot for a game event |

## Quick start

Keep `character-sprites.css` beside the PNG files and include it on your page:

```html
<link rel="stylesheet" href="character-sprites.css">
<div class="arshad-sprite arshad-sprite--breathing" aria-label="Arshad standing"></div>
```

Use the same element for a one-shot action by replacing its animation class, for example `arshad-sprite--breathing` with `arshad-sprite--wave`. When the animation ends, remove the action class and restore the idle class. The sprite element stays 176 × 340 px at the stage's 0.96× scale (169 × 326.4 CSS px); adjust `.arshad-sprite-stage` / the `transform` in the CSS to change the display size while retaining crisp pixel edges.

`character-sprites.css` includes a `prefers-reduced-motion` rule. It also leaves each one-shot on its final pose while its action class remains active.
