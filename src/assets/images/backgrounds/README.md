# Hero background slideshow

Drop your background images in **this folder** — they are picked up
automatically, no code changes required.

- **Supported formats:** `.jpg` `.jpeg` `.png` `.webp` `.avif`
- **Order:** files cycle in filename order, so prefix them for a set order
  (e.g. `01-neon-city.jpg`, `02-rain.jpg`, `03-arcade.jpg`)
- **Interval:** each background holds for 4 seconds, then crossfades
- **Fallback:** if this folder has no images, the original single backdrop
  is used instead

## Recommended specs

Keep them light — five 1 MB images means ~5 MB of downloads.

| Property | Recommendation |
| --- | --- |
| Format | `.webp` or `.jpg` |
| Width | 1920px (2560px max) |
| Quality | 70–80% |
| Target size | **under ~250 KB each** |
| Aspect | Wide/landscape (16:9 area, centre-cropped) |

Images are displayed with `background-size: cover`, so the centre of each
image is what stays visible on small screens — keep the subject centred.

## Shrinking full-size PNGs

The six shipped backgrounds started as ~15 MB of PNG and were converted to
WebP (~1.9 MB total) with:

```bash
npx sharp-cli -i src/assets/images/backgrounds/*.png -o tmp-bg -f webp -q 82
```

Quality 82 is deliberate — these are neon gradients, which band badly below
~75. The original PNGs are kept in `.originals/` (git-ignored) so you can
re-export with different settings; delete that folder once you're happy.

## Example

```
backgrounds/
  01-neon-city.webp
  02-rainy-street.webp
  03-arcade-alley.webp
  04-rooftop.webp
  05-subway.webp
```
