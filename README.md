# LIMP3TZ // Neon Pixel Arcade Portfolio

An interactive neon-cyberpunk arcade portfolio for **Arshad Mohemed (LIMP3TZ)** —
Senior Specialist Trainer, Ad Ops @ MarketStar, ex-NVIDIA QA.

Instead of a static page it opens as a playable 2D platformer: a pixel character
you can walk, jump, and bump mystery blocks with, plus a synth-generated
chiptune soundtrack, a skill inventory, a quest log, and a live GitHub radar.

## Tech stack

| | |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build | Vite 8 (Rolldown) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Audio | Web Audio API synthesis (`src/utils/soundEngine.ts`) |
| Tests | Vitest (pure logic only — no DOM needed) |
| CI | GitHub Actions |

## Quick start

Requires **Node 22+**.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000, bound to `0.0.0.0` for LAN/phone testing |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run the Vitest suite once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run clean` | Delete `dist/` |

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `←` `→` or `A` `D` | On-screen D-pad |
| Jump | `Space`, `W`, or `↑` | `JUMP` button |
| Bump blocks | Jump into them from below | — |
| Interact | Click the character | Tap the character |
| Walk to a spot | Click the ground | Tap the ground |
| Turn around | Hold the opposite direction | Tap the opposite D-pad button |
| Cancel a walk or turn | `Esc` | — |

Holding jump bounces continuously — each bounce is gated on landing, so
mid-air double jumps are impossible. There's also a **Konami code**
(`↑ ↑ ↓ ↓ ← → ← → B A`) that triggers a coin shower and +5,000 points.

Score and coins persist to `localStorage` under `limp3tz_score` and
`limp3tz_coins`.

## Walk-cycle sprite sheet

The character animates with a 2-row sprite sheet,
`src/assets/images/sprite/walk/arshad-walk.png` (792×340, 88×170 cells): row 0
faces right (idle + 8 walk frames), row 1 mirrors it facing left. The sheet's
companion `arshad-walk.json` is the single source of truth — cell size, frame
rectangles, per-frame durations, animation index groups and the foot anchor all
live there, so `src/utils/walk.ts` hard-codes nothing.

- While moving, the physics loop advances a walk clock and `frameAtElapsed()`
  picks the frame; the renderer only updates a CSS `background-position`, so no
  React state churn per frame
- The clock advances only while actually moving, freezes on idle, and resets
  when a new walk starts
- The walk sheet is drawn ~25% smaller than the jump/turn art, so it is scaled
  up (1.25×) to land the standing character at the shared target height — see
  **Jump & 3D turning**. Scaling goes through `background-size`, never by
  resizing the frame element
- Click-to-walk: tapping the ground walks the character there at 100 px/s (the
  on-screen D-pad and keyboard move at full sprint speed). Clicking the
  character, hiding the tab or losing window focus cancels the walk

New game logic in `walk.ts` is pure and unit tested (`walk.test.ts`), like the
other helpers.

## Jump & 3D turning

Walking flips the character instantly; changing *direction* plays a proper 3D
rotation instead. `src/utils/jumpTurn.ts` owns this — a small
`AvatarAnimationController` state machine plus pure mapping helpers, all unit
tested in `jumpTurn.test.ts`.

Three further sheets sit in `src/assets/images/sprite/jump-turn/`:

| Sheet | Size | Cells | Use |
| --- | --- | --- | --- |
| `arshad-jump.png` | 1296×416 | 144×208, 9×2 | Jump lifecycle — row 0 faces right, row 1 left |
| `arshad-turn.png` | 1008×170 | 112×170, 9×1 | Grounded turn — left profile → front → right profile |
| `arshad-air-turn.png` | 1296×208 | 144×208, 9×1 | Tucked mid-air turn |

`animations.json` beside them is reference metadata (cell sizes, anchors and
nominal angles); `SPRITE_SPECS` in `jumpTurn.ts` is what the renderer actually
uses.

- **Turning** lasts `TURN_DURATION` (250ms) and eases linearly across the
  sheet's 3/4-left → front → 3/4-right columns. Rotating *on the ground* pauses
  horizontal movement, so the turn reads as a beat; in mid-air you keep full
  horizontal control and get the tucked air-turn frames instead
- **Reversal is free**: tapping the opposite key mid-turn continues from the
  current rotation rather than snapping back or restarting, and holding a
  direction never restarts an in-flight turn
- **Jumping** runs anticipation (0.12s) → airtime → landing (0.12s) → recovery
  (0.12s). The airborne frame is chosen from the physics vertical velocity, so
  a short hop, a full jump and a block bump each show the right pose;
  `JUMP_TIMINGS.AIRTIME` (0.8s) is only a fallback for callers that don't pass a
  progress value
- **One character size across every sheet**: each sheet normalises its art
  scale so the standing character is the same on-screen height
  (`TARGET_CONTENT_H`, 155px) and anchors its feet on the actor box bottom — so
  switching walk ↔ jump ↔ turn neither resizes nor shifts the character. The
  walk art is the odd one out and gets scaled up 1.25×
- While rotating, the squash/stretch and lean transforms are neutralised so the
  pixel art stays sharp instead of smearing through the rotation
- Each turn emits a short `sound.playTurn()` blip
- `prefers-reduced-motion` swaps directions instantly and skips the turn
  animation; `Esc` cancels a walk or turn and resets the controller

## Contact channels

The FINAL LEVEL section renders five pixel-art icon buttons — Email, LinkedIn,
GitHub, Discord and Steam. They are driven by `CONTACT_LINKS` in
`src/data/portfolioData.ts`: each entry carries its own icon, accent colour and
accessible label, so adding, removing or reordering a channel is a data edit
rather than a component change. The component passes the accent through a single
CSS custom property, which keeps the border, label and hover fill in sync
without per-link markup.

Profile URLs live in `PORTFOLIO_CONFIG` (`linkedin`, `github`, `discord`,
`steam`); the `mailto:` target is derived from `email` at module load. Discord
deep-links to the user profile (`discord.com/users/<id>`) and Steam uses the
vanity URL. Every channel except email opens in a new tab with
`rel="noopener noreferrer"`.

Icons are 128px WebP cuts of the full-size art — see the asset workflow above.

## Project structure

```
src/
  App.tsx                 # Page shell, score/coin state, section ErrorBoundaries
  main.tsx                # React entry point
  index.css               # Tailwind entry + retro theme tokens
  components/
    ArcadeStage.tsx       # The playable stage: physics loop, blocks, slideshow
    Hud.tsx               # Score / coin header
    BootScreen.tsx        # Retro boot sequence
    CharacterSheet.tsx    # Character stats panel
    SkillInventory.tsx    # 44-skill inventory grid
    QuestLog.tsx          # Career timeline as quests
    ProjectLibrary.tsx    # Project cartridges
    GitHubActivity.tsx    # Live GitHub REST API radar
    ArcadeContact.tsx     # Contact terminal
    ArcadeFooter.tsx
    ErrorBoundary.tsx     # Per-section crash recovery
  data/
    portfolioData.ts      # All copy, skills, quests, projects, config
    backgrounds.ts        # Hero slideshow discovery + helpers
  utils/
    physics.ts            # Pure physics/collision helpers
    input.ts              # Pure key mapping + jump decisions
    blocks.ts             # Pure block bump detection + collection scoring
    motion.ts             # Reduced-motion preference + helpers
    walk.ts               # Walk-cycle frame selection from the sprite-sheet JSON
    jumpTurn.ts           # Jump lifecycle + 3D turn state machine and anchors
    shadow.ts             # Ground shadow sizing helpers
    soundEngine.ts        # Web Audio chiptune synthesis
    particleSystem.ts     # Canvas particle effects
public/
  background_music.mp3    # Looping chiptune track
  og-image.jpg            # Social preview card (og:image / twitter:image)
```

## Hero background slideshow

Images in `src/assets/images/backgrounds/` are **auto-discovered** — drop a file
in and it joins the rotation, no code change required.

- Slides hold for **4 seconds**, then crossfade over 1 second
  (`SLIDESHOW_INTERVAL_MS` / `SLIDESHOW_FADE_MS` in `src/data/backgrounds.ts`)
- Files cycle in **filename order**, so prefix them `01-`, `02-`, … to control it
- Prev/next chevrons on the stage step through manually; clicking one restarts
  the auto-advance timer instead of fighting it
- The slideshow pauses when the stage is scrolled out of view or the tab is hidden
- A neon progress bar runs along the base of the stage, sweeping across as the
  current background's 4-second hold elapses; it restarts on every change (auto
  or manual) and is hidden from assistive tech, since the chevrons are the
  accessible control
- Under `prefers-reduced-motion` the crossfade becomes instant. Auto-advance
  deliberately keeps running so the backdrop still rotates — a product call,
  not an oversight (see `shouldAutoAdvance` in `src/utils/motion.ts`)
- The artwork is drawn inset from the stage edges (`BACKGROUND_ZOOM`) so the
  world reads smaller next to the character; lower it to zoom further out
- Supported formats: `.jpg` `.jpeg` `.png` `.webp` `.avif`
- If the folder is empty, the single fallback backdrop is used

See `src/assets/images/backgrounds/README.md` for image specs and the
compression command.

## Asset workflow

Full-resolution sources are **not committed** — they live in `git`-ignored
`.originals/` folders next to the optimized versions:

| Original | Shipped |
| --- | --- |
| `backgrounds/.originals/*.png` (~15 MB) | `backgrounds/*.webp` (1.9 MB) + fallback `cyberpunk…webp` (242 KB) |
| `images/.originals/pixel_arshad_sprite.png` (949 KB) | `images/pixel_arshad_sprite.webp` (42 KB) |
| `images/.originals/Contact_*.png` (~3.4 MB) | `images/Contact_*.webp` (21 KB total, 128px) |

Regenerate any of them with `sharp-cli`:

```bash
# Hero backgrounds
npx sharp-cli -i src/assets/images/backgrounds/*.png -o tmp -f webp -q 82

# Contact-channel icons. Source art is 1254px (email 512px); the buttons render
# them at 40–48px, so a 128px cut covers 2× displays with room to spare.
npx sharp-cli -i src/assets/images/.originals/Contact_*.png \
  -o src/assets/images -f webp -q 88 resize 128

# Character sprite. It renders 77x190 in the stage and 135x333 in the
# character sheet, so a 284x699 export leaves ~2x headroom for retina.
npx sharp-cli -i src/assets/images/.originals/pixel_arshad_sprite.png \
  -o tmp -f webp -q 88 resize 284
```

Quality 82 is deliberate for the backgrounds — they're neon gradients that band
badly below ~75. Once you're happy, the `.originals/` folders can be deleted.

### Sprite framing

The static portrait sprite (`pixel_arshad_sprite.webp`, shown in the character
sheet) is a **portrait** canvas surrounded by transparent margin, and that
margin is what makes sizing easy to get wrong. The shipped sprite measures
799×1967 with the character only occupying 769×1778 of it (padding: 14 left / 93
top / 16 right / 96 bottom). Scaling the *canvas* to the 72px collision width
renders the character at the wrong size, so every consumer sizes him by the
*visible* content instead.

The measured metrics and the maths live in `src/data/sprite.ts` — two pure
helpers, both driven by the same metrics:

| Helper | Used by | Result |
| --- | --- | --- |
| `spritePlacement(72, 172)` | `ArcadeStage` | collision box centring + feet-on-ground-line offsets for the walk-sheet frame |
| `spriteCanvasSize(301)` | `CharacterSheet` | portrait canvas renders at **135×333**, matching the original portrait's visible height |

On the stage the character is animated by the **walk-cycle sheet** (see above);
this portrait only appears in the character sheet. The `height` matters as much
as the `width`: the canvas is **not** square, so pinning both dimensions to one
number would letterbox or distort him. The collision box (`ACTOR_W` = 72px) is
deliberately left alone, so gameplay is untouched, and the ground shadow is
derived from the visible width rather than the collision box.

If you swap the artwork, re-measure its alpha bounding box and update
`CHARACTER_SPRITE`. Trimming reports the visible size and the canvas size you
need the padding from:

```bash
npx sharp-cli -i new-sprite.png -o tmp -f png trim   # visible size vs canvas
```

## Social preview

`index.html` carries the Open Graph, Twitter card (`og:image`, `og:url`) and
JSON-LD `ProfilePage` metadata for
**https://limpetz.github.io/Limp3tz_Portfolio/**. All of it uses absolute URLs,
which is what Facebook, LinkedIn and Slack require. If the site ever moves to a
different origin, update the four absolute URLs in `index.html` (two metas plus
`url` and the person's `image` in the JSON-LD block).

## Testing

Logic that isn't tied to React or the DOM is extracted into pure modules
(`src/utils/physics.ts`, `src/utils/input.ts`, `src/utils/blocks.ts`,
`src/utils/motion.ts`, `src/data/backgrounds.ts`) and covered by Vitest:

```bash
npm test
```

Add tests next to the module as `*.test.ts`. Keep new game logic in those pure
helpers where practical — it's much easier to test than code inside the
animation loop.

## Accessibility

- **Reduced motion** — when the OS asks for less motion, the decorative loops
  stop (glitch text, score pops, Konami rainbow, idle breathing, twinkling
  stars, pixel rain) and the hero slideshow swaps without a crossfade. It keeps
  its auto-advance by design, so the backdrop still rotates. Feedback that only
  moves in response to input — walking, jumping, landing squash, footstep dust
  — is deliberately kept, since suppressing it would remove the response to the
  player's own action.
- **Keyboard** — the stage is fully playable without a mouse (`←` `→` `A` `D`,
  `Space` `W` `↑`), and the on-screen control hints are real `<kbd>` elements
  rather than styled divs. Note the character itself is click/tap-only for the
  jump-and-award interaction.
- **Contrast** — a radial overlay sits between the hero image and the HUD text
  so headings stay readable over any background.

## CI and deployment

Both workflows share the same gate — `npm ci` → `npm run typecheck` →
`npm test` → `npm run build`:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push to `main`, every pull request | verify only |
| `.github/workflows/deploy.yml` | push to `main`, or manual dispatch | verify, then publish `dist/` to GitHub Pages |

> `package-lock.json` must stay committed, otherwise `npm ci` fails.

**One-time setup:** in the repo's *Settings → Pages*, set **Source** to
*GitHub Actions*. `public/.nojekyll` ships with the build so Pages serves it
verbatim.

## Deployment

The build is a fully static `dist/` folder. This repo targets a **GitHub Pages
project site**, so `vite.config.ts` sets:

```ts
base: '/Limp3tz_Portfolio/'
```

Without it every asset 404s on Pages. Dev mirrors the sub-path on purpose, so
base-path mistakes show up locally instead of only after deploying —
`npm run dev` still works from `http://localhost:3000`, which **302-redirects**
to `http://localhost:3000/Limp3tz_Portfolio/`.

Deployment is automatic — pushing to `main` publishes `dist/` via
`deploy.yml`. If you later move to a **user** site (`https://user.github.io/`)
or a custom domain, change `base` back to `'/'` and update the absolute URLs in
`index.html`.

Anything you add that references a public asset by URL must go through
`import.meta.env.BASE_URL` — see `soundEngine.ts`, where the chiptune track is
loaded. A root-relative `/background_music.mp3` silently fails under a
sub-path.
