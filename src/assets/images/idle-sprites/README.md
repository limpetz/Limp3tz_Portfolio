# Arshad Pixel Character Animation Pack

Seven transparent horizontal sprite strips for a small website character. Every animation cell is **88 × 170 px**; the strips are sized to their frame counts and use transparent backgrounds.

Shipped as **lossless WebP** (bit-exact vs the PNG originals, which live in the git-ignored `images/.originals/idle-sprites/` folder — see the asset workflow in the root README).

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

Use the same element for a one-shot action by replacing its animation class, for example `arshad-sprite--breathing` with `arshad-sprite--wave`. When the animation ends, remove the action class and restore the idle class. The sprite element stays 88 × 170 px; scale the whole element with CSS `transform: scale(...)` if you need a smaller display while retaining crisp pixel edges.

`character-sprites.css` includes a `prefers-reduced-motion` rule. It also leaves each one-shot on its final pose while its action class remains active.
