# Arshad — native 240px sprite pack

New pixel artwork based on your main-character reference. Render at scale **1.0**: the standing figure occupies **240 pixels**, not the entire 330px cell. Main character and directional idle frames share the exact same pixels across sheets.

## Assets

| File in `assets/` | Columns × rows | Cell | Sheet | anchorX | footY |
| --- | --- | --- | --- | --- | --- |
| arshad-walk.png | 9 × 2 | 172 × 330 | 1548 × 660 | 86 | 318 |
| arshad-jump.png | 9 × 2 | 224 × 330 | 2016 × 660 | 112 | 318 |
| arshad-turn.png | 9 × 1 | 176 × 330 | 1584 × 330 | 88 | 318 |
| arshad-air-turn.png | 9 × 1 | 224 × 330 | 2016 × 330 | 112 | 318 |

All four are indexed **PNG-8** with a shared palette and transparent background. Equivalent **lossless WebP** files are in `webp/`. Use either format; do not load both. Individual cells are in `frames/`.

`arshad-main.png` is the tightly cropped, right-facing main character: **102 × 240px**. `arshad-main-frame.png` is the same artwork on the **172 × 330px** walk cell. `arshad-main-left-frame.png` supplies the matching left-facing idle. `animations.json` records both tight and framed anchors.

The upright silhouette runs from **y=78 through y=317**. The foot baseline is the lower edge at **y=318**; rows 318–329 are the 12 transparent padding rows. Every occupied cell has its lowest sole at that baseline. The silhouette is centered horizontally to within the unavoidable half-pixel rounding for odd widths.

240px is the reference **standing height**. Knee bend, crouch and tuck change the occupied height; those poses are not stretched to 240px. Raised hands can use the headroom. Apply jump height to the character's world position separately from sheet coordinates.

## Frame mapping — zero-based

- **Walk:** row 0 right; row 1 left. Column 0 idle; columns 1–8 alternating walk cycle.
- **Jump:** row 0 right; row 1 left. Columns 0–8: idle, anticipation, takeoff, rising, apex, falling, pre-landing, landing, recovery.
- **Turn and air-turn:** only columns **2,3,4,5,6** contain artwork: three-quarter left, slight left, front, slight right, three-quarter right. Columns **0,1,7,8 are fully transparent**.
- **Left to right:** play `2 → 3 → 4 → 5 → 6`. **Right to left:** play `6 → 5 → 4 → 3 → 2`.

`assets/arshad-walk.json` preserves the earlier top-level `frameWidth`, `frameHeight`, `anchor`, `animation`, and `frames` structure with regenerated dimensions, coordinates and frame paths. Frame file paths are relative to this package root; `image` is relative to the JSON file. `assets/animations.json` describes the complete pack.

## Website integration

Replace all four old sheets together and load the new metadata. Remove old per-animation scale multipliers, background sizing overrides, or CSS enlargement. Do not infer character size from the differently sized source cells.

For canvas, draw one source cell into an equally sized destination rectangle:

```js
ctx.imageSmoothingEnabled = false;
ctx.drawImage(
  image,
  column * frameWidth, row * frameHeight, frameWidth, frameHeight,
  Math.round(characterX - anchorX),
  Math.round(groundY + jumpOffsetY - footY),
  frameWidth, frameHeight
);
```

The main character can be displayed directly with `<img src="assets/arshad-main.png" width="102" height="240" alt="Arshad">`. Keep its CSS dimensions at those native values. A high-DPI canvas may use device-pixel-ratio backing storage; the logical destination still stays at scale 1.0.

For smooth turning, play the actual five directional drawings over approximately **400ms**, using an eased continuous angle to choose columns 2–6. Keep the world anchor fixed. Preserve the current angle when reversing an in-progress turn. Use the air-turn sheet during flight. Do not apply `rotateY`, `scaleX(-1)`, or shrink width through zero to animate the direction change. These are 2D sprites showing a 3D turn, not a rigged 3D mesh.

## Included interactive example

Extract the ZIP and open `index.html`. It loads local assets without a build step. If your environment blocks local scripts/images, serve the extracted folder using your normal development server.

- A/D or left/right arrows: walk and turn.
- Space/W/up: jump; change movement direction while airborne to turn.
- Click/tap the stage: walk to that point.
- Buttons: walk, jump, turn, jump + turn.
- Escape or leaving the scene: stop; reduced-motion preferences are respected.

`motion.js` contains the state machine. `demo.js` draws at native logical size with the exact new sheet dimensions. Walk defaults to 10 frames/second at 150px/second; turn defaults to 400ms. The example is optional; the sheets retain your requested existing column mapping.

## Build and verification

The source poses were made with the built-in image-generation tool, then cropped and nearest-neighbour sampled offline into the final pixel canvases. This is fresh source art; no old low-resolution sprites are enlarged by website CSS. Generation prompts and normalization measurements are in `source-artwork/`.

`validation.json` records the final decoded-image checks: dimensions, indexed encoding, transparency, anchor alignment, baseline, upright height, unused columns, canonical idle equivalence, frame/manifest agreement and PNG/WebP pixel equivalence. Controller checks cover both turn directions, reversals, walking and jump transitions. Animated previews are rendered from that same controller. Browser interaction has not been manually tested here.
