import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PORTFOLIO_CONFIG, MYSTERY_BLOCKS_DATA, IDLE_QUIPS } from '../data/portfolioData';
import {
  BLOCK_POSITIONS_KEY,
  loadBlockPositions,
  saveBlockPositions,
  withBlockPosition,
  clampDxPct,
  clampDyUpPct,
  type BlockPosition,
} from '../utils/blockLayout';
import { sound } from '../utils/soundEngine';
import { ArcadeParticleSystem } from '../utils/particleSystem';
import {
  STAGE_BACKGROUNDS,
  SLIDESHOW_INTERVAL_MS,
  SLIDESHOW_FADE_MS,
  stepBackgroundIndex,
} from '../data/backgrounds';
import {
  clampToStage,
  findOverlappingBlock,
  isInVerticalBand,
  applyFriction,
  jumpApexHeight,
  rampVelocity,
  resolveBlockCollision,
} from '../utils/physics';
import { isJumpKey, isLeftKey, isRightKey, moveDirection, shouldTriggerJump } from '../utils/input';
import {
  ALL_BLOCKS_BONUS,
  BLOCK_COIN,
  BLOCK_SCORE,
  BUMP_HINT_RANGE,
  HEAD_BUMP_BOUNCE,
  collectBlock,
  findHeadBumpedBlock,
  findOverlappingBlockInBand,
  nearestBumpTarget,
} from '../utils/blocks';
import { crossfadeMs, shouldAutoAdvance, usePrefersReducedMotion } from '../utils/motion';
import { spritePlacement } from '../data/sprite';
import { shadowForHeight } from '../utils/shadow';
import { WALK_SHEET, frameAtElapsed } from '../utils/walk';
import {
  AvatarAnimationController,
  CharacterRenderPose,
  SPRITE_SPECS,
  TARGET_CONTENT_H,
  getRenderPose,
} from '../utils/jumpTurn';
import moveControlsImg from '../assets/images/move.webp';
import jumpControlsImg from '../assets/images/jump.webp';
import bumpBlocksImg from '../assets/images/bump-blocks.webp';
import clickMeImg from '../assets/images/click-me.webp';
import { PixelHeart } from './PixelHeart';
import { SlimeMonster } from './SlimeMonster';
import {
  type SlimeColor,
  type SlimeSide,
  type SlimeSlot,
  type SlimeState,
  SLIME_ATTACK_RANGE,
  SLIME_IDLE_SECONDS,
  SLIME_RESPAWN_MS,
  SLIME_STATE_SECONDS,
  SPAWN_GRACE_MS,
  stompChainLabel,
  stompChainScore,
  playerSpawnX,
  resolveSlimeMotion,
  safeZoneBounds,
  slimeFrameIndex,
  slimeRoster,
  slimeSpawn,
} from '../utils/slime';

interface ArcadeStageProps {
  onAddScore: (amount: number) => void;
  onAddCoin: (amount: number) => void;
  onHeal?: (amount?: number) => void;
  onTakeDamage?: (amount?: number) => void;
  health?: number;
  spriteUrl: string;
  useProceduralBackground?: boolean;
}

interface FallingCoin {
  id: number;
  x: number;
  y: number;
  vy: number;
}

interface FallingHeart {
  id: number;
  x: number;
  y: number;
  vy: number;
}

interface SlimeHazard {
  id: number;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: SlimeState;
  frameIndex: number;
  animTimer: number;
  /** Seconds spent in the current animation state — drives state transitions. */
  stateTimer: number;
  width: number;
  height: number;
  color: SlimeColor;
  side: SlimeSide;
  slot: SlimeSlot;
}

/** Placeholder layout used before the stage has been measured; the sizing
 *  effect immediately repositions every slime from the real stage width. */
const PLACEHOLDER_SAFE_ZONE = { min: 300, max: 580 };

/** The four medium slimes — 2 launched from each wall, one colour per slot. */
function initialSlimeRoster(): SlimeHazard[] {
  return slimeRoster(1000, PLACEHOLDER_SAFE_ZONE).map((spawn, i) => ({ id: i + 1, ...spawn }));
}

/**
 * Automation hook. `scripts/playtest.mjs` sets `window.__ARCADE_NO_HAZARDS__`
 * before load so its walk/jump timing assertions can't be perturbed by a slime
 * knocking the character around (a hit also bounces the player, which would
 * read as a stomp and show jump frames mid-walk). There is no UI or URL surface
 * — only an injected script can set it.
 */
function hazardsSuppressed(): boolean {
  return typeof window !== 'undefined' && window.__ARCADE_NO_HAZARDS__ === true;
}

export const ArcadeStage: React.FC<ArcadeStageProps> = ({
  onAddScore,
  onAddCoin,
  onHeal,
  onTakeDamage,
  health = 4,
  spriteUrl,
  useProceduralBackground,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const facingDirRef = useRef<1 | -1>(1);

  const [posX, setPosX] = useState(200);
  const [posY, setPosY] = useState(0); // height above ground
  const [isWalking, setIsWalking] = useState(false);
  const [isAirborne, setIsAirborne] = useState(false);
  const [isLanding, setIsLanding] = useState(false);
  const [isCheering, setIsCheering] = useState(false);

  // Mystery block states
  const [collectedItems, setCollectedItems] = useState<Record<string, boolean>>({});
  const collectedItemsRef = useRef<Record<string, boolean>>({});
  const [bumpedBlockKey, setBumpedBlockKey] = useState<string | null>(null);

  // Speech bubble
  const [bubbleText, setBubbleText] = useState("HI, I'M ARSHAD! CLICK OR MOVE ME!");
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const typingTimerRef = useRef<number | null>(null);
  const bubbleHideTimerRef = useRef<number | null>(null);

  // Canvas Particle System Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSys = useRef<ArcadeParticleSystem>(new ArcadeParticleSystem());

  // Falling Coins & Hearts
  const [fallingCoins, setFallingCoins] = useState<FallingCoin[]>([]);
  const fallingCoinsRef = useRef<FallingCoin[]>([]);
  const [fallingHearts, setFallingHearts] = useState<FallingHeart[]>([]);
  const fallingHeartsRef = useRef<FallingHeart[]>([]);

  // Slime Hazards: four medium slimes, two pinned to each wall. The placeholder
  // positions can't overlap the default spawn; the sizing effect repositions
  // every slime from the real stage width and safe zone once layout exists.
  const [slimes, setSlimes] = useState<SlimeHazard[]>(() => initialSlimeRoster());
  const slimesRef = useRef<SlimeHazard[]>(initialSlimeRoster());
  /** Latched once per mount; only the headless playtest ever sets this. */
  const noHazards = useRef(hazardsSuppressed()).current;

  const [invulnerable, setInvulnerable] = useState(false);
  const invulnerableRef = useRef(false);
  const [partyMode, setPartyMode] = useState(false);

  // Pending respawn timers, tracked so they can be cleared on unmount instead
  // of firing setState into a dead component.
  const slimeRespawnTimeoutsRef = useRef<number[]>([]);
  /** Consecutive airborne slime stomps this flight — the stomp-chain combo. */
  const stompChainRef = useRef(0);
  /** Chain celebration: shake until this timestamp, at this power multiplier. */
  const shakeUntilRef = useRef(0);
  const shakePowerRef = useRef(1);
  // Contact damage is suppressed until this timestamp, so a hazard can't hit
  // the player during startup (and behind the boot screen).
  const spawnGraceUntilRef = useRef(0);

  // Renderable mirror of the derived safe zone, kept in sync by
  // applyStageLayout (the loop reads the refs, the floor panel reads this).
  const [safeZone, setSafeZone] = useState({ min: 60, max: 340 });

  // --- Off-screen pause -------------------------------------------------
  // The stage is a full-height section pinned to the top of the page, so once
  // a visitor scrolls into the chapters below we stop the physics loop, the
  // particle canvas, the slideshow and the coin spawner instead of animating
  // something nobody can see. Also pauses while the browser tab is hidden.
  const stageOnScreenRef = useRef(true);
  const stageVisibleRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const sync = () => {
      stageVisibleRef.current = stageOnScreenRef.current && document.visibilityState !== 'hidden';
      // Mirror the same signal onto the soundtrack: the arcade owns the
      // chiptune, so it stops when the stage leaves the viewport or the tab is
      // hidden instead of playing on over the chapters below.
      sound.setSceneActive(stageVisibleRef.current);
    };

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          stageOnScreenRef.current = entry.isIntersecting;
          sync();
        },
        { threshold: 0.05 },
      );
      observer.observe(el);
    }

    document.addEventListener('visibilitychange', sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  // Hero background slideshow (auto-discovers images in assets/images/backgrounds)
  const hasMultipleBackgrounds = STAGE_BACKGROUNDS.length > 1;
  const [bgIndex, setBgIndex] = useState(0);
  // Bumped on manual navigation so the auto-advance timer restarts
  const [slideEpoch, setSlideEpoch] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();

  // Whether the slideshow may advance on its own. It runs regardless of the
  // motion preference (only the crossfade reacts to that); the chevrons always
  // step through manually too.
  const autoAdvance = shouldAutoAdvance(STAGE_BACKGROUNDS.length);

  // Advance to the next background on an interval.
  useEffect(() => {
    if (!autoAdvance) return;
    const id = window.setInterval(() => {
      if (!stageVisibleRef.current) return;
      setBgIndex((i) => stepBackgroundIndex(i, 1, STAGE_BACKGROUNDS.length));
    }, SLIDESHOW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoAdvance, slideEpoch]);

  // Manual step through the backgrounds (wraps around) and restart the timer
  const stepBackground = useCallback(
    (dir: 1 | -1) => {
      setBgIndex((i) => stepBackgroundIndex(i, dir, STAGE_BACKGROUNDS.length));
      setSlideEpoch((e) => e + 1);
    },
    [],
  );

  // Preload the upcoming image so crossfades never flash an empty frame
  useEffect(() => {
    if (!hasMultipleBackgrounds) return;
    const nextUrl = STAGE_BACKGROUNDS[
      stepBackgroundIndex(bgIndex, 1, STAGE_BACKGROUNDS.length)
    ];
    const img = new Image();
    img.src = nextUrl;
  }, [bgIndex, hasMultipleBackgrounds]);

  // Keys state
  const keysRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({
    left: false,
    right: false,
    jump: false,
  });

  // Mystery-block arranger (toggle with 'L' or HUD button)
  const [arrangeMode, setArrangeMode] = useState(false);
  const [blockPositions, setBlockPositions] = useState<BlockPosition[]>(() =>
    loadBlockPositions(BLOCK_POSITIONS_KEY),
  );
  const dragBlockRef = useRef<string | null>(null);

  /** Stage-local x of a client-x (the container spans the viewport width). */
  const rectLeft = () => containerRef.current?.getBoundingClientRect().left ?? 0;

  /** Nudge a block by dirX/dirY (relocation arranger). */
  const nudgeBlock = (blockKey: string, dirX: number, dirY: number) => {
    const row = blocksRowRef.current;
    const btn = row?.querySelector<HTMLButtonElement>(`[data-block-key="${blockKey}"]`);
    const stageH = containerRef.current?.clientHeight ?? 0;
    if (!row || !btn || !stageH) return;
    const rowRect = row.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    const currentDx =
      (bRect.left + bRect.width / 2 - (rowRect.left + rowRect.width / 2)) / rowRect.width;
    const saved = blockPositions.find((p) => p.key === blockKey);
    const next = withBlockPosition(
      blockPositions,
      blockKey,
      clampDxPct(currentDx + dirX * 0.03, rowRect.width, BLOCK_SIZE),
      dirY !== 0
        ? clampDyUpPct((saved?.dyUpPct ?? 0) + (dirY * 16) / stageH, stageH, BLOCK_Y)
        : saved?.dyUpPct,
    );
    setBlockPositions(next);
    saveBlockPositions(BLOCK_POSITIONS_KEY, next);
  };

  // Konami code buffer
  const konamiBuffer = useRef<string[]>([]);
  const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];

  // Physics constants
  const GROUND_H = 92;
  // Cadence pair (STRIDE_REFERENCE_PX_S below) — FINAL as of v1.2.0, decided
  // from live cadence-probe measurements: 169 footfalls/min, 711ms loop,
  // contact frames reading 2x over lift frames. The zero-slide setting
  // (REF 165) was tried and reverted: at ~240 steps/min each frame shows
  // ~63ms and the second footfall reads as a blur — ground-probe data
  // confirmed the art plants both feet, but the beat was too fast to
  // register. Knob maths: travel per step = 0.4s × REF (~84px at 210; the
  // art's contact stride is ~66px — the stance-foot slide is the accepted
  // trade-off), footfalls/min = 150 × speed ÷ REF.
  const MAX_SPEED = 260; // px/sec
  const STRIDE_REFERENCE_PX_S = 210; // FINAL; [ / ] live-tunes it while the C overlay is open
  const ACCEL = 1800; // px/sec²
  const FRICTION = 2200; // px/sec²
  const SKID_DECEL = 3400; // px/sec²
  // Jump arc, tuned for the 240px character: the rise reads best when it
  // roughly matches his height, and the head still has to reach the block band
  // (BLOCK_Y above ground) — see the reach maths in the tests.
  const JUMP_V = 1250; // px/sec
  const GRAVITY = 2000; // px/sec²
  /** Chain-celebration screen shake: duration and peak amplitude at power 1. */
  const SHAKE_MS = 280;
  const SHAKE_MAX_PX = 5;
  
  // --- Turn / sprint kinematics ---
  const TURN_SPEED = 10;       // how quickly the sprite springs toward its target turn
  const TURN_DAMP = 0.96;      // per-frame damping on turn angle (reduces jitter)
  const STRIDE_HZ = 4.5;       // stride cycles per second at full speed
  // Maximum body lean, in degrees, when moving at full speed
  const MAX_TILT_DEG = 8;

  // --- Solid mystery blocks (hard collision) ---
  // Block positions are NOT computed here: the row is laid out by CSS, so its
  // centres are measured from the DOM (see measureBlocks below). Sizes below are
  // only needed for the vertical band and as a pre-measurement fallback.
  const BLOCK_SIZE = 56;        // rendered block size (w-14 = 56px)

  // Set to the hero's full jump reach: apex is ~391px (JUMP_V²/2G), and the
  // bump registers while the head is inside the block band + tolerance, i.e.
  // from y ≥ BLOCK_Y − 240. 380 puts the band's bottom just under the head's
  // highest reach, so a max-height jump is required to bump.
  const BLOCK_Y = 380;          // px above ground the blocks sit
  // A block's collision box is the measured block plus this grace, so it is
  // forgiving to hit without reaching far past its visible edges.
  const BLOCK_BUMP_GRACE = 4;
  // Downward speed after a head bump (px/sec). A firmer drop reads better on a
  // 240px body and keeps hold-to-jump bumps from double-triggering the same
  // block; the constant in blocks.ts carries the tested contract.
  const HEAD_BOUNCE_V = HEAD_BUMP_BOUNCE;

  // --- Character actor box ---
  const ACTOR_W = 72; // collision-box width (px)

  // The sprite canvas is mostly transparent margin, so it is sized by its
  // *visible* character rather than by the canvas — otherwise the character
  // renders far smaller than intended. Metrics and maths live in data/sprite.ts.
  //
  // This is deliberately the same number the sprite renderer targets: the box
  // is the visible character, so head-bump detection (`actorHeight`) and the
  // click target must track the art. Deriving it prevents the two drifting.
  const SPRITE_VISIBLE_H = TARGET_CONTENT_H;
  const SPRITE_PLACEMENT = spritePlacement(ACTOR_W, SPRITE_VISIBLE_H);

  // The ground shadow tracks the character's visible width, not the collision box.
  const SHADOW_W = Math.round(SPRITE_PLACEMENT.visibleWidth) - 12;
  const SHADOW_LEFT = (ACTOR_W - SHADOW_W) / 2;

  // --- Walk cycle ---
  // Frames come from the shared sprite poses (utils/jumpTurn.ts), which
  // normalise every sheet onto the same on-screen character height and place
  // the cell from its foot anchor — walk, jump and turn all read the same size.
  // The physics loop only pokes style properties on the sprite element, so
  // frames never touch React state.
  const IDLE_POSE = getRenderPose('walk', 0, 0, ACTOR_W);
  const WALK_SPEED = 100; // CSS px/s (spec: start at 100)

  // 3D Jump and Turn Animation Controller
  const animCtrlRef = useRef<AvatarAnimationController>(
    new AvatarAnimationController({ facingDir: 1, reducedMotion: prefersReducedMotion }),
  );

  // Sync reduced-motion preference live
  useEffect(() => {
    animCtrlRef.current.reducedMotion = prefersReducedMotion;
  }, [prefersReducedMotion]);

  // Refs the loop mutates without re-rendering.
  const walkElapsedRef = useRef(0);
  const currentRenderPoseRef = useRef<CharacterRenderPose | null>(null);
  // Click-to-move destination (centre X). Null = no destination.
  const clickDestRef = useRef<number | null>(null);

  // Hold-to-jump: holding the jump key bounces continuously while grounded.
  const HOLD_TO_JUMP = true;

  const blocksRowRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    x: 200,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: true,
    lastT: performance.now(),
    distSincePuff: 0,
    distSinceSkid: 0,
    runCycle: 0,
    turnAngle: 0,       // current smoothed lean angle, in degrees
    turnDamping: 0,     // damped turn velocity (prevents jitter/overshoot)
    blockCentres: [] as number[], // measured centres, in stage px
    blockBottoms: [] as number[], // per-block band bottoms above ground (relocation)
    blockHalfWidth: BLOCK_SIZE / 2, // measured, until the first DOM measure
    tilt: 0,
    landingTimer: 0,
    landingIntensity: 1,
    stageWidth: 1000,
    // Safe zone derived from the real spawn point (see applyStageLayout). The
    // zone is centred on the actor's initial x and clamped inside the walls.
    spawnX: 200,
    safeZoneMin: 60,
    safeZoneMax: 340,
    actorWidth: ACTOR_W,
    // Visible character height, which is what head-bump detection should use.
    actorHeight: SPRITE_VISIBLE_H,
    blocksLift: BLOCK_Y, // height of blocks above ground (positioned above speech bubble)
  });

  // --- Block geometry ------------------------------------------------------
  // The blocks are a CSS flex row whose size and gap change at the `sm`
  // breakpoint, so their real centres are measured from the DOM rather than
  // recomputed from a duplicated spacing constant. Those two had drifted apart:
  // the collision centres were 6/4/14/24px off the drawn blocks, which left the
  // right-hand edge of each block dead to head bumps and shoved the player out
  // at the wrong x on side collisions.
  const measureBlocks = useCallback(() => {
    const stage = containerRef.current;
    const row = blocksRowRef.current;
    if (!stage || !row) return;

    const stageLeft = stage.getBoundingClientRect().left;
    const centres: number[] = [];
    let halfWidth = 0;

    const groundTop = stage.getBoundingClientRect().bottom - GROUND_H;
    const bottoms: number[] = [];
    Array.from(row.children).forEach((child) => {
      const rect = child.getBoundingClientRect();
      if (rect.width <= 0) return;
      centres.push(rect.left - stageLeft + rect.width / 2);
      // Block bottom above the ground line (relocation-aware).
      bottoms.push(Math.max(0, groundTop - rect.bottom));
      halfWidth = Math.max(halfWidth, rect.width / 2);
    });

    // Only trust a complete measurement; otherwise keep whatever we had.
    if (centres.length === MYSTERY_BLOCKS_DATA.length) {
      stateRef.current.blockCentres = centres;
      stateRef.current.blockHalfWidth = halfWidth;
      stateRef.current.blockBottoms = bottoms;
    }
  }, []);

  /**
   * Recompute the stage width, the actor spawn point and the safe zone.
   *
   * The safe zone is *derived from the real spawn* — not hard-coded — and is
   * clamped so it can never butt against a stage wall. That matters because
   * the wall-bounce and the safe-zone repulsion are separate rules: if the
   * wall sits inside the zone they shove a monster back and forth every frame
   * and it gets stuck "vibrating" at the edge (which is exactly what happened
   * on phone-width stages before).
   *
   * `placePlayer` is only true on the first layout; later resizes keep the
   * player where they are and just move the zone around them.
   */
  const applyStageLayout = useCallback((placePlayer: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const spawnX = playerSpawnX(w);
    stateRef.current.stageWidth = w;
    stateRef.current.spawnX = spawnX;

    const { min: zoneMin, max: zoneMax } = safeZoneBounds(spawnX, w, ACTOR_W);
    stateRef.current.safeZoneMin = zoneMin;
    stateRef.current.safeZoneMax = zoneMax;
    setSafeZone((prev) =>
      prev.min === zoneMin && prev.max === zoneMax ? prev : { min: zoneMin, max: zoneMax },
    );

    if (placePlayer) {
      stateRef.current.x = spawnX;
      setPosX(spawnX);
    }
  }, []);

  // Say something in speech bubble
  const say = useCallback((text: string, durationMs: number = 2400) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (bubbleHideTimerRef.current) clearTimeout(bubbleHideTimerRef.current);

    setBubbleVisible(true);
    let i = 0;
    setBubbleText('');

    typingTimerRef.current = window.setInterval(() => {
      i++;
      setBubbleText(text.slice(0, i));
      if (i % 2 === 0) sound.playBlip(1100, 0.015, 0.02);
      if (i >= text.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      }
    }, 28);

    bubbleHideTimerRef.current = window.setTimeout(() => {
      setBubbleVisible(false);
    }, durationMs + text.length * 28);
  }, []);

  // Initialize and handle Canvas Particle System sizing. Doubles as the hook for
  // re-measuring block geometry whenever the stage or the block row resizes.
  useEffect(() => {
    if (canvasRef.current) {
      particleSys.current.attachCanvas(canvasRef.current);
    }

    const handleResize = () => {
      particleSys.current.resize();
      measureBlocks();
      // Keep the safe zone in step with the stage width (player stays put).
      applyStageLayout(false);
    };
    window.addEventListener('resize', handleResize);

    const ro = new ResizeObserver(() => {
      particleSys.current.resize();
      measureBlocks();
      applyStageLayout(false);
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    // The row's own size changes across the sm breakpoint (block and gap width).
    if (blocksRowRef.current) {
      ro.observe(blocksRowRef.current);
    }

    // Measure once the DOM exists so the first frame already has real centres.
    measureBlocks();

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [measureBlocks, applyStageLayout]);

  // Relocation edits move blocks without resizing anything, so the geometry
  // must be re-measured whenever the saved positions change.
  useEffect(() => {
    measureBlocks();
  }, [blockPositions, measureBlocks]);

  // Open mystery block
  const openBlock = useCallback((key: string, blockCenterX: number) => {
    const itemDef = MYSTERY_BLOCKS_DATA.find((x) => x.key === key);
    if (!itemDef) return;

    setBumpedBlockKey(key);
    setTimeout(() => setBumpedBlockKey(null), 400);

    const result = collectBlock(collectedItemsRef.current, key, MYSTERY_BLOCKS_DATA.length);
    if (!result.isNew) {
      sound.playBump();
      say(`ALREADY COLLECTED: ${itemDef.title}!`, 1500);
      return;
    }

    collectedItemsRef.current = result.collected;
    setCollectedItems(result.collected);

    sound.playPower();
    sound.playCoin();
    sound.playItemPickup();
    onAddScore(BLOCK_SCORE);
    onAddCoin(BLOCK_COIN);
    if (onHeal && health < 4) {
      onHeal(1);
    }

    // Burst golden sparkles and stars at block location
    const stageH = containerRef.current?.clientHeight || 800;
    const blockCenterCanvasY = stageH - (GROUND_H + stateRef.current.blocksLift) + 24;
    particleSys.current.triggerCoinSparkle(blockCenterX, blockCenterCanvasY, 26, true);

    setIsCheering(true);
    setTimeout(() => setIsCheering(false), 900);

    say(itemDef.getLine(), 2800);

    if (result.allCollected) {
      setTimeout(() => {
        onAddScore(ALL_BLOCKS_BONUS);
        sound.playTrophy();
        say('ALL 4 POWER ITEMS FOUND! +500 PTS!', 3500);
        // Coin rain
        for (let i = 0; i < 15; i++) {
          setTimeout(() => {
            const newCoin: FallingCoin = {
              id: Math.random() + Date.now() + i,
              x: 40 + Math.random() * (stateRef.current.stageWidth - 80),
              y: -20,
              vy: 200 + Math.random() * 150,
            };
            fallingCoinsRef.current = [...fallingCoinsRef.current, newCoin];
            setFallingCoins(fallingCoinsRef.current);
          }, i * 120);
        }
      }, 1200);
    }
  }, [onAddScore, onAddCoin, say]);

  // Jump trigger. `immediate` (held bounces) skips the anticipation crouch —
  // see startJump in utils/jumpTurn.ts.
  const doJump = useCallback((options?: { immediate?: boolean }) => {
    if (!stateRef.current.grounded) return;
    stateRef.current.grounded = false;
    stateRef.current.y = 2;
    stateRef.current.vy = JUMP_V;
    stateRef.current.landingTimer = 0;
    animCtrlRef.current.startJump(options);
    setIsAirborne(true);
    setIsLanding(false);
    sound.playJump();

    // Launch dust puff at feet
    const stageH = containerRef.current?.clientHeight || 800;
    const feetCanvasX = stateRef.current.x + stateRef.current.actorWidth / 2;
    const groundCanvasY = stageH - GROUND_H;
    particleSys.current.triggerFootstepDust(feetCanvasX, groundCanvasY, 0);
  }, [JUMP_V]);

  // Handle actor click
  const handleActorClick = () => {
    doJump();
    onAddScore(100);
    onAddCoin(1);
    sound.playCoin();
    // A click on the character itself also cancels any pending walk.
    clickDestRef.current = null;

    const stageH = containerRef.current?.clientHeight || 800;
    const actorCenterX = stateRef.current.x + stateRef.current.actorWidth / 2;
    const actorCenterCanvasY = stageH - (GROUND_H + stateRef.current.y + 60);
    particleSys.current.triggerCoinSparkle(actorCenterX, actorCenterCanvasY, 24, true);

    const quips = ['1UP!', 'WOOHOO!', 'SPEED UP!', 'KEEP GOING!', 'GG!'];
    say(quips[Math.floor(Math.random() * quips.length)], 1400);
  };

  // Konami trigger
  const triggerKonami = useCallback(() => {
    setPartyMode(true);
    onAddScore(5000);
    sound.playKonami();
    say('★ KONAMI CHEAT CODE ACTIVATED! +5,000 PTS! ★', 4000);

    // Massive coin shower
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const newCoin: FallingCoin = {
          id: Math.random() + Date.now() + i,
          x: 20 + Math.random() * (stateRef.current.stageWidth - 40),
          y: -20,
          vy: 220 + Math.random() * 180,
        };
        fallingCoinsRef.current = [...fallingCoinsRef.current, newCoin];
        setFallingCoins(fallingCoinsRef.current);
      }, i * 80);
    }

    setTimeout(() => {
      setPartyMode(false);
    }, 6000);
  }, [onAddScore, say]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Escape') {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        clickDestRef.current = null;
        animCtrlRef.current.reset();
        return;
      }

      if (e.code === 'KeyL' && !e.repeat) {
        setArrangeMode((prev) => !prev);
        sound.playBlip(780, 0.04, 0.07);
        return;
      }

      if (isLeftKey(e.code)) {
        keysRef.current.left = true;
      }
      if (isRightKey(e.code)) {
        keysRef.current.right = true;
      }
      if (isJumpKey(e.code)) {
        e.preventDefault();
        // See shouldTriggerJump(): in hold-to-jump mode every event passes and
        // doJump()'s grounded check prevents mid-air double jumps. Otherwise OS
        // key-repeat is ignored so holding the key can't re-trigger a bounce.
        const allow = shouldTriggerJump({
          repeat: e.repeat,
          heldJump: keysRef.current.jump,
          holdToJump: HOLD_TO_JUMP,
        });
        keysRef.current.jump = true;
        if (allow) doJump();
      }

      // Konami buffer
      konamiBuffer.current.push(e.code);
      if (konamiBuffer.current.length > 10) konamiBuffer.current.shift();
      if (konamiBuffer.current.join(',') === konamiSequence.join(',')) {
        konamiBuffer.current = [];
        triggerKonami();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isLeftKey(e.code)) {
        keysRef.current.left = false;
      }
      if (isRightKey(e.code)) {
        keysRef.current.right = false;
      }
      if (isJumpKey(e.code)) {
        // Clear the held flag so the next press can jump again.
        keysRef.current.jump = false;
        // Variable jump height: release cuts vertical speed
        if (!stateRef.current.grounded && stateRef.current.vy > 250) {
          stateRef.current.vy = 250;
        }
      }
    };

    // If the window loses focus while keys are held, keyup never fires and the
    // character would keep running/jumping. Clear all held keys on blur.
    const onBlur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.jump = false;
      clickDestRef.current = null;
      animCtrlRef.current.reset();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    // Tab hiding: clear movement and the click destination (per spec).
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        clickDestRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [doJump, triggerKonami]);

  // Which block (if any) the player is standing under, for the bump hint.
  const [hintedBlock, setHintedBlock] = useState<number | null>(null);

  // Periodic falling coins generator
  useEffect(() => {
    const coinInterval = setInterval(() => {
      if (!stageVisibleRef.current) return;
      if (fallingCoinsRef.current.length < 5 && Math.random() < 0.7) {
        const newCoin: FallingCoin = {
          id: Math.random() + Date.now(),
          x: 40 + Math.random() * (stateRef.current.stageWidth - 80),
          y: -20,
          vy: 140 + Math.random() * 80,
        };
        fallingCoinsRef.current = [...fallingCoinsRef.current, newCoin];
        setFallingCoins(fallingCoinsRef.current);
      }

      // Occasional falling 1UP heart pickup if player is not at max health
      if (health < 4 && fallingHeartsRef.current.length < 2 && Math.random() < 0.35) {
        const newHeart: FallingHeart = {
          id: Math.random() + Date.now(),
          x: 40 + Math.random() * (stateRef.current.stageWidth - 80),
          y: -20,
          vy: 110 + Math.random() * 60,
        };
        fallingHeartsRef.current = [...fallingHeartsRef.current, newHeart];
        setFallingHearts(fallingHeartsRef.current);
      }
    }, 3800);

    return () => clearInterval(coinInterval);
  }, [health]);

  // Periodic quip generator
  useEffect(() => {
    const quipInterval = setInterval(() => {
      if (!stageVisibleRef.current) return;
      if (Math.random() < 0.5) {
        const q = IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)];
        say(q, 2600);
      }
    }, 9000);

    return () => clearInterval(quipInterval);
  }, [say]);

  // Physics animation loop
  useEffect(() => {
    let animId: number;

    const loop = (time: number) => {
      // Idle while the stage is scrolled away or the tab is hidden: keep the
      // frame alive but skip all physics, collision and canvas work so the
      // character resumes exactly where it left off.
      if (!stageVisibleRef.current) {
        stateRef.current.lastT = time;
        animId = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min((time - stateRef.current.lastT) / 1000, 0.05);
      stateRef.current.lastT = time;

      if (containerRef.current) {
        stateRef.current.stageWidth = containerRef.current.clientWidth;
      }

      // --- Turn / lean kinematics ---
      // Horizontal input direction: -1 = left, 0 = idle, +1 = right.
      // Keyboard overrides a click destination (per the asset spec).
      const moveDir =
        moveDirection(keysRef.current.left, keysRef.current.right) ||
        (clickDestRef.current != null
          ? Math.sign(clickDestRef.current - (stateRef.current.x + stateRef.current.actorWidth / 2))
          : 0);

      // Cancel the click destination once arrived (stop precisely, no jitter).
      if (
        clickDestRef.current != null &&
        Math.abs(clickDestRef.current - (stateRef.current.x + stateRef.current.actorWidth / 2)) <
          Math.max(2, Math.abs(stateRef.current.vx) * dt)
      ) {
        stateRef.current.x =
          clickDestRef.current - stateRef.current.actorWidth / 2; // snap exactly
        clickDestRef.current = null;
        stateRef.current.vx = 0;
      }

      // Face the direction of travel via 3D turn poses.
      // Changing direction triggers the smooth 3D rotation sequence.
      if (moveDir !== 0) {
        const wasTurning = animCtrlRef.current.turnState.isTurning;
        const prevTarget = animCtrlRef.current.turnState.targetDir;
        animCtrlRef.current.requestDirection(moveDir as 1 | -1);
        if (
          animCtrlRef.current.turnState.isTurning &&
          (!wasTurning || prevTarget !== (moveDir as 1 | -1))
        ) {
          sound.playTurn();
        }
      }

      // Sync facingDirRef with the animation controller's current direction
      facingDirRef.current = animCtrlRef.current.facingDir;

      // Lean angle (degrees) springs toward the movement direction, so the
      // body rolls into a turn rather than snapping flat.
      const targetTurn = moveDir * MAX_TILT_DEG;
      stateRef.current.turnDamping *= TURN_DAMP;
      stateRef.current.turnAngle +=
        (targetTurn - stateRef.current.turnAngle) * Math.min(1, dt * TURN_SPEED);

      // Smooth speed ramp: accelerate toward the target velocity at ACCEL,
      // and decelerate with friction when there's no input.
      // When turning on the ground, pause horizontal movement per spec.
      // In mid-air, maintain horizontal control while turning.
      const isGroundTurning =
        stateRef.current.grounded && animCtrlRef.current.turnState.isTurning;
      const effectiveMoveDir = isGroundTurning ? 0 : moveDir;

      const targetVx =
        effectiveMoveDir *
        (clickDestRef.current != null && moveDirection(keysRef.current.left, keysRef.current.right) === 0
          ? WALK_SPEED
          : MAX_SPEED);
      stateRef.current.vx =
        effectiveMoveDir !== 0
          ? rampVelocity(stateRef.current.vx, targetVx, ACCEL, dt)
          : applyFriction(stateRef.current.vx, FRICTION, dt);

      // --- Solid block collision (hard objects) ---
      // The mystery blocks are hard physical objects. They occupy a horizontal
      // band (around each block center) and a vertical band at BLOCK_Y above
      // the ground. The player is only blocked when their body actually
      // overlaps a block's vertical band (e.g. while jumping up to it);
      // walking underneath them is unobstructed.
      const stageW = stateRef.current.stageWidth;
      const actorL = stateRef.current.x;
      const actorR = stateRef.current.x + stateRef.current.actorWidth;
      const actorBottom = GROUND_H + stateRef.current.y;
      const actorTop = actorBottom + stateRef.current.actorHeight;
      const blocks = stateRef.current.blockCentres;
      // Collision box = the measured block plus a little grace.
      const blockRadius = stateRef.current.blockHalfWidth + BLOCK_BUMP_GRACE;

      // Vertical band occupied by the overhead blocks. With relocation, each
      // block has its own band; the shared band is the union fallback.
      const blockBottoms = stateRef.current.blockBottoms;
      const perBlockBands =
        blockBottoms.length === blocks.length && blocks.length > 0;
      const blockBandBottom = perBlockBands
        ? Math.min(...blockBottoms)
        : GROUND_H + BLOCK_Y;
      const blockBandTop = blockBandBottom + BLOCK_SIZE;
      const inBlockBand = isInVerticalBand(actorBottom, actorTop, blockBandBottom, blockBandTop);

      // Distance from actor center to the nearest solid block (either side)
      const nextHint = nearestBumpTarget(
        stateRef.current.x + stateRef.current.actorWidth / 2,
        blocks,
        BUMP_HINT_RANGE,
      );
      if (nextHint !== hintedBlock) {
        setHintedBlock(nextHint);
      }

      // Only block horizontal movement when the player is actually moving
      // sideways into a block — OR rising through its band with the body
      // clipping its corner (residual walk velocity curls a "jump beside the
      // block" arc into it; without this the corner-clip either falls through
      // or, worse, reads as a head bump). A true under-block jump (centre
      // inside the block column) skips this and bumps from below instead.
      const rising = stateRef.current.vy > 0;
      if (inBlockBand && (Math.abs(stateRef.current.vx) > 1 || rising)) {
        // Prefer the per-block band test (relocation-aware); fall back to the
        // shared-band test when vertical measurements are not ready yet.
        const hitIndex = perBlockBands
          ? findOverlappingBlockInBand(
              actorL,
              actorR,
              actorBottom - GROUND_H,
              actorTop - GROUND_H,
              blocks,
              blockRadius,
              blockBottoms,
              blockBottoms.map((b) => b + BLOCK_SIZE),
            )
          : findOverlappingBlock(actorL, actorR, blocks, blockRadius);

        // A rising actor with no input has no movement direction to resolve
        // against — shove toward the side of the block they are on.
        const movingRight =
          Math.abs(stateRef.current.vx) > 1
            ? stateRef.current.vx > 0
            : stateRef.current.x + stateRef.current.actorWidth / 2 < blocks[hitIndex];

        if (hitIndex !== -1) {
          stateRef.current.x = clampToStage(
            resolveBlockCollision(
              stateRef.current.x,
              stateRef.current.actorWidth,
              blocks[hitIndex],
              blockRadius,
              movingRight
            ),
            stageW,
            stateRef.current.actorWidth
          );
          setPosX(stateRef.current.x);
          stateRef.current.vx = 0;
        }
      }

      // Position update (use the local vx for physics)
      const nextX = Math.max(
        12,
        Math.min(
          stateRef.current.stageWidth - stateRef.current.actorWidth - 12,
          stateRef.current.x + stateRef.current.vx * dt
        )
      );
      if ((nextX <= 12 && stateRef.current.vx < 0) || (nextX >= stateRef.current.stageWidth - stateRef.current.actorWidth - 12 && stateRef.current.vx > 0)) {
        stateRef.current.vx = 0;
      }
      stateRef.current.x = nextX;
      setPosX(nextX);

      // Footstep dust puffs while running
      if (Math.abs(stateRef.current.vx) > 25 && stateRef.current.grounded) {
        stateRef.current.distSincePuff += Math.abs(stateRef.current.vx) * dt;
        if (stateRef.current.distSincePuff > 65) {
          stateRef.current.distSincePuff = 0;
          const stageH = containerRef.current?.clientHeight || 800;
          const feetCanvasX = nextX + stateRef.current.actorWidth / 2;
          const groundCanvasY = stageH - GROUND_H;
          particleSys.current.triggerFootstepDust(feetCanvasX, groundCanvasY, Math.sign(stateRef.current.vx));
        }
      }

      // Vertical jumping & gravity
      if (!stateRef.current.grounded) {
        // Apex float: subtle gravity dampening near peak (window scales with
        // the heavier arc, roughly half a body-height of speed)
        const apexFactor = Math.abs(stateRef.current.vy) < 110 ? 0.75 : 1.0;
        stateRef.current.vy -= GRAVITY * apexFactor * dt;
        stateRef.current.y += stateRef.current.vy * dt;

        // Check head collision with mystery blocks while actually RISING.
        // A bump is an upward head contact: gating on vy > 0 keeps a falling
        // arc from phantom-bumping a block it is drifting past, and keeps the
        // bump from double-firing after HEAD_BOUNCE_V sends the player down.
        if (stateRef.current.vy > 0) {
          const hit = findHeadBumpedBlock({
            actorCenterX: stateRef.current.x + stateRef.current.actorWidth / 2,
            actorHead: stateRef.current.y + stateRef.current.actorHeight,
            blockCentres: stateRef.current.blockCentres,
            blockLift: stateRef.current.blocksLift,
            blockBottoms: stateRef.current.blockBottoms,
            // The block's TRUE half width, no grace: the bump box must sit
            // strictly inside the side-collision box (which adds
            // BLOCK_BUMP_GRACE), so a jump at the block's EDGE is a sideways
            // shove, never a head bump — and a residual-velocity drift that
            // curls the arc into the corner still shoves instead of bouncing.
            radius: stateRef.current.blockHalfWidth,
            tolerance: 50,
          });

          if (hit) {
            openBlock(MYSTERY_BLOCKS_DATA[hit.index].key, hit.centerX);
            stateRef.current.vy = HEAD_BOUNCE_V; // Firm downward bounce off the block
          }
        }

        // Hit ground (Landing effect)
        if (stateRef.current.y <= 0) {
          const fallSpeed = Math.abs(stateRef.current.vy);
          stateRef.current.y = 0;
          stateRef.current.vy = 0;
          stateRef.current.grounded = true;
          // Touching the ground ends the airborne stomp chain.
          stompChainRef.current = 0;
          animCtrlRef.current.mode = 'landing';
          animCtrlRef.current.elapsed = 0;
          setIsAirborne(false);
          setIsLanding(true);
          stateRef.current.landingTimer = 0.22;
          // Heavier body: full impact over a shorter fall, floored at 0.5 so
          // hop-landings still compress visibly.
          stateRef.current.landingIntensity = Math.min(1.0, Math.max(0.5, fallSpeed / 700));
          sound.playLand();

          // Authentic ground landing dust burst
          const stageH = containerRef.current?.clientHeight || 800;
          const feetCanvasX = stateRef.current.x + stateRef.current.actorWidth / 2;
          const groundCanvasY = stageH - GROUND_H;
          particleSys.current.triggerLandingDust(feetCanvasX, groundCanvasY);

          setTimeout(() => setIsLanding(false), 220);
        }
        setPosY(stateRef.current.y);
      }

      // Hold-to-jump: while the key is held, bounce again the instant we land.
      // Driving this from the loop instead of waiting on OS key-repeat makes
      // repeat bounces immediate (key-repeat has a ~500ms initial delay), and
      // doJump()'s grounded check still blocks mid-air double jumps.
      // `immediate` skips the anticipation crouch so held bounces loop
      // rising → apex → falling → pre-landing without snapping back to takeoff.
      if (HOLD_TO_JUMP && keysRef.current.jump && stateRef.current.grounded) {
        doJump({ immediate: true });
      }

      // Compute character dynamic squash, stretch, tilt, bob, and breathing
      let squashX = 1;
      let squashY = 1;
      let tilt = 0;
      let bobY = 0;
      let isIdle = false;

      if (!stateRef.current.grounded) {
        // Airborne: stretch on ascent, aerodynamic float/fall on descent.
        // Amplitudes were tuned at 172px and scale with body height (240px now),
        // so the deformation reads the same proportionally.
        const vy = stateRef.current.vy;
        if (vy > 60) {
          const stretch = Math.min(0.16, (vy / JUMP_V) * 0.20);
          squashY = 1 + stretch;
          squashX = 1 - stretch * 0.6;
          tilt = stateRef.current.turnAngle * 1.15;
        } else if (vy < -60) {
          const fallStretch = Math.min(0.11, (Math.abs(vy) / JUMP_V) * 0.14);
          squashY = 1 + fallStretch;
          squashX = 1 - fallStretch * 0.5;
          tilt = stateRef.current.turnAngle;
        } else {
          // Apex float
          squashY = 1;
          squashX = 1;
          tilt = stateRef.current.turnAngle * 0.6;
        }
      } else if (stateRef.current.landingTimer > 0) {
        // Landing compression & spring rebound
        stateRef.current.landingTimer -= dt;
        const progress = 1 - Math.max(0, stateRef.current.landingTimer / 0.22);
        const intensity = stateRef.current.landingIntensity;

        if (progress < 0.35) {
          // Impact squash — gentler per-pixel than at 172px (a 62px compression
          // read as a collapse), with a slightly longer, softer profile.
          const p = progress / 0.35;
          const s = Math.sin(p * Math.PI * 0.5);
          squashY = 1.0 - 0.19 * intensity * s;
          squashX = 1.0 + 0.17 * intensity * s;
          bobY = 3.5 * intensity * s;
        } else if (progress < 0.70) {
          // Elastic spring overshoot
          const p = (progress - 0.35) / 0.35;
          const r = Math.sin(p * Math.PI);
          squashY = 1.0 + 0.06 * intensity * r;
          squashX = 1.0 - 0.05 * intensity * r;
          bobY = -2.0 * intensity * r;
        } else {
          // Settle
          squashY = 1;
          squashX = 1;
          bobY = 0;
        }
      } else if (Math.abs(stateRef.current.vx) > 15) {
        // WALKING: advance the sheet's clock only while actually moving. The
        // cadence tracks ground speed relative to the STRIDE_REFERENCE rate the
        // art was authored for (210 px/s).
        // Pairing note: travel per step = 0.4s × this value ONLY (speed has no
        // effect on step length); footfalls/min = 150 × MAX_SPEED ÷ this value.
        walkElapsedRef.current += dt * 1000 * (Math.abs(stateRef.current.vx) / STRIDE_REFERENCE_PX_S);

        // Smooth turn lean toward movement direction
        const targetTilt = stateRef.current.turnAngle;
        stateRef.current.tilt += (targetTilt - stateRef.current.tilt) * Math.min(1, dt * 10);
        tilt = stateRef.current.tilt;
      } else {
        // Idle breathing on ground
        stateRef.current.tilt = 0;
        stateRef.current.runCycle = 0;
        walkElapsedRef.current = 0; // reset the cycle clock while standing
        isIdle = true;
      }

      // Update animation controller clock
      animCtrlRef.current.update(dt);

      // Update character sprite element with multi-phase jumping, 3D turning & walking.
      // Position and background-position are applied directly to avoid React state re-renders.
      if (spriteRef.current) {
        const walkingNow =
          !isIdle &&
          !isCheering &&
          Math.abs(stateRef.current.vx) > 15 &&
          stateRef.current.grounded &&
          !animCtrlRef.current.turnState.isTurning;

        const walkAnimName = animCtrlRef.current.facingDir === 1 ? 'walkRight' : 'walkLeft';
        const walkIndices = WALK_SHEET.animations[walkAnimName];
        const walkFrameIdx = walkingNow
          ? frameAtElapsed(walkElapsedRef.current, walkIndices, WALK_SHEET.frames, WALK_SHEET.defaultFps)
          : walkIndices[0];

        // Jump progress (0..1) estimated from vertical velocity / height when in air
        const jumpProgress = !stateRef.current.grounded
          ? (stateRef.current.vy > 0
              ? 0.5 * (1 - stateRef.current.vy / JUMP_V)
              : 0.5 + 0.5 * Math.min(1, Math.abs(stateRef.current.vy) / JUMP_V))
          : undefined;

        const pose = animCtrlRef.current.getCurrentPose({
          walking: walkingNow,
          walkFrame: walkFrameIdx,
          actorWidth: ACTOR_W,
          jumpProgress,
        });

        const prevPose = currentRenderPoseRef.current;
        if (
          !prevPose ||
          prevPose.sheet !== pose.sheet ||
          prevPose.column !== pose.column ||
          prevPose.row !== pose.row ||
          prevPose.flip !== pose.flip
        ) {
          currentRenderPoseRef.current = pose;
          const spec = SPRITE_SPECS[pose.sheet];

          // `pose` carries the *scaled* cell size — using the raw `spec.w/h`
          // here would clip the sprite against its own background-size.
          spriteRef.current.style.width = `${pose.width}px`;
          spriteRef.current.style.height = `${pose.height}px`;
          spriteRef.current.style.left = `${pose.offsetX}px`;
          spriteRef.current.style.bottom = `${pose.offsetY}px`;
          spriteRef.current.style.backgroundImage = `url(${spec.src})`;
          spriteRef.current.style.backgroundSize = pose.backgroundSize;
          spriteRef.current.style.backgroundPosition = pose.backgroundPosition;
          // Left-facing ground poses reuse the (far livelier) right-facing art,
          // mirrored about the cell's horizontal centre, which is the anchor.
          spriteRef.current.style.transform =
            `scaleX(${pose.flip ? -1 : 1}) ${spriteRef.current.style.transform || ''}`.trim();
        } else {
          // Keep the mirror in sync even when the pose cell didn't change (the
          // squash/tilt writer below overwrites `transform` every frame).
          const flipScale = pose.flip ? 'scaleX(-1)' : 'scaleX(1)';
          if (!spriteRef.current.style.transform.startsWith(flipScale)) {
            spriteRef.current.style.transform =
              `${flipScale} ${spriteRef.current.style.transform || ''}`.trim();
          }
        }

        // Apply idle breathing when fully standing idle, or physics squash/tilt otherwise
        const isTurning = animCtrlRef.current.turnState.isTurning;
        if (isIdle && !isCheering && !isTurning) {
          if (!spriteRef.current.classList.contains('animate-idle-breathe')) {
            spriteRef.current.classList.add('animate-idle-breathe');
          }
          spriteRef.current.style.transform = '';
        } else {
          if (spriteRef.current.classList.contains('animate-idle-breathe')) {
            spriteRef.current.classList.remove('animate-idle-breathe');
          }
          // Do not squash or tilt while rotating in 3D to keep true volume and sharp pixel rotation.
          // scaleX prefixes the mirror so squash/tilt compose on top of it.
          const appliedSquashX = isTurning ? 1 : squashX;
          const appliedSquashY = isTurning ? 1 : squashY;
          const appliedTilt = isTurning ? 0 : tilt;
          const appliedBobY = isTurning ? 0 : bobY;
          const flipScale = pose.flip ? 'scaleX(-1)' : 'scaleX(1)';
          spriteRef.current.style.transform = `${flipScale} scale(${appliedSquashX.toFixed(3)}, ${appliedSquashY.toFixed(3)}) rotate(${appliedTilt.toFixed(2)}deg) translateY(${appliedBobY.toFixed(2)}px)`;
        }
      }

      // Update falling coins & detect collisions with player
      const currentCoins = fallingCoinsRef.current;
      if (currentCoins.length > 0) {
        const remainingCoins: FallingCoin[] = [];
        let scoreToAdd = 0;
        let coinsToAdd = 0;
        const burstsToSpawn: { x: number; y: number }[] = [];

        const actorLeft = stateRef.current.x;
        const actorRight = stateRef.current.x + stateRef.current.actorWidth;
        const actorBottom = GROUND_H + stateRef.current.y;
        const actorTop = actorBottom + stateRef.current.actorHeight;
        const stageH = containerRef.current?.clientHeight || 800;

        for (let i = 0; i < currentCoins.length; i++) {
          const c = currentCoins[i];
          const nextY = c.y + c.vy * dt;
          const coinScreenY = stageH - nextY;

          if (
            c.x >= actorLeft &&
            c.x <= actorRight &&
            coinScreenY >= actorBottom &&
            coinScreenY <= actorTop
          ) {
            scoreToAdd += 100;
            coinsToAdd += 1;
            burstsToSpawn.push({ x: c.x + 10, y: nextY + 10 });
          } else if (nextY < stageH) {
            remainingCoins.push({ ...c, y: nextY });
          }
        }

        if (scoreToAdd > 0) {
          onAddScore(scoreToAdd);
          onAddCoin(coinsToAdd);
          sound.playCoin();
          for (const b of burstsToSpawn) {
            particleSys.current.triggerCoinSparkle(b.x, b.y, 24, true);
          }
        }

        fallingCoinsRef.current = remainingCoins;
        setFallingCoins(remainingCoins);
      }

      // Update falling hearts & detect collisions with player
      const currentHearts = fallingHeartsRef.current;
      if (currentHearts.length > 0) {
        const remainingHearts: FallingHeart[] = [];
        let heartsToHeal = 0;
        const burstsToSpawn: { x: number; y: number }[] = [];

        const actorLeft = stateRef.current.x;
        const actorRight = stateRef.current.x + stateRef.current.actorWidth;
        const actorBottom = GROUND_H + stateRef.current.y;
        const actorTop = actorBottom + stateRef.current.actorHeight;
        const stageH = containerRef.current?.clientHeight || 800;

        for (let i = 0; i < currentHearts.length; i++) {
          const h = currentHearts[i];
          const nextY = h.y + h.vy * dt;
          const heartScreenY = stageH - nextY;

          if (
            h.x >= actorLeft - 10 &&
            h.x <= actorRight + 10 &&
            heartScreenY >= actorBottom &&
            heartScreenY <= actorTop
          ) {
            heartsToHeal += 1;
            burstsToSpawn.push({ x: h.x + 8, y: nextY + 8 });
          } else if (nextY < stageH) {
            remainingHearts.push({ ...h, y: nextY });
          }
        }

        if (heartsToHeal > 0) {
          if (onHeal) onHeal(heartsToHeal);
          onAddScore(250 * heartsToHeal);
          for (const b of burstsToSpawn) {
            particleSys.current.triggerCoinSparkle(b.x, b.y, 28, true);
          }
        }

        fallingHeartsRef.current = remainingHearts;
        setFallingHearts(remainingHearts);
      }

      // Update Slime Hazards & collision detection (hazard damage or jump stomp)
      const currentSlimes = slimesRef.current;
      if (currentSlimes.length > 0 && !noHazards) {
        const stageW = stateRef.current.stageWidth || 1000;
        const actorLeft = stateRef.current.x + 12;
        const actorRight = stateRef.current.x + stateRef.current.actorWidth - 12;
        const actorBottom = GROUND_H + stateRef.current.y;
        const actorTop = actorBottom + stateRef.current.actorHeight;
        const stageH = containerRef.current?.clientHeight || 800;
        const playerCenter = stateRef.current.x + stateRef.current.actorWidth / 2;
        const zoneMin = stateRef.current.safeZoneMin;
        const zoneMax = stateRef.current.safeZoneMax;
        // Standing inside the zone is always safe, and the opening grace window
        // covers the frames before the first layout has run.
        const playerInSafeZone = playerCenter >= zoneMin - 8 && playerCenter <= zoneMax + 8;
        const spawnGrace = performance.now() < spawnGraceUntilRef.current;

        const nextSlimes: SlimeHazard[] = [];

        for (let i = 0; i < currentSlimes.length; i++) {
          const m = currentSlimes[i];
          const stateTimer = m.stateTimer + dt;

          // --- Death: play the sheet out, then despawn ------------------
          if (m.state === 'die') {
            if (stateTimer < SLIME_STATE_SECONDS.die) {
              nextSlimes.push({
                ...m,
                stateTimer,
                frameIndex: slimeFrameIndex('die', stateTimer),
              });
            }
            continue;
          }

          // --- Hit stagger: a stomp plays Hit before falling into Die ----
          if (m.state === 'hit') {
            if (stateTimer >= SLIME_STATE_SECONDS.hit) {
              nextSlimes.push({ ...m, state: 'die', stateTimer: 0, frameIndex: 0 });
            } else {
              nextSlimes.push({
                ...m,
                stateTimer,
                frameIndex: slimeFrameIndex('hit', stateTimer),
              });
            }
            continue;
          }

          // --- Spawn beat: idle for a moment, then start patrolling ------
          if (m.state === 'idle' && stateTimer < SLIME_IDLE_SECONDS) {
            nextSlimes.push({
              ...m,
              stateTimer,
              frameIndex: slimeFrameIndex('idle', stateTimer),
            });
            continue;
          }

          // `idle` falls through here once its beat elapses; the patrol starts
          // fresh from frame 0 instead of inheriting the idle clock.
          let nextState: SlimeState = 'run';
          let nextStateTimer = m.state === 'idle' ? 0 : stateTimer;

          // Advance + resolve safe-zone repulsion and wall bounces as one
          // tested step; `facing` always follows the resolved velocity, so the
          // patrol direction and the attack telegraph can never disagree.
          const motion = resolveSlimeMotion({
            x: m.x,
            vx: m.vx,
            width: m.width,
            dt,
            stageWidth: stageW,
            safeZone: { min: zoneMin, max: zoneMax },
            speed: Math.abs(m.vx),
          });
          const nextX = motion.x;
          const nextVx = motion.vx;
          const facing = motion.facing;

          // --- Attack telegraph -----------------------------------------
          // Lunge when the player is ahead and on the same level; the pose
          // holds its final frame for as long as the player stays in range.
          const monsterCenter = nextX + m.width / 2;
          const dxPlayer = playerCenter - monsterCenter;
          const inAttackRange =
            Math.abs(dxPlayer) <= SLIME_ATTACK_RANGE &&
            Math.sign(dxPlayer) === facing &&
            Math.abs(stateRef.current.y) < 140;
          if (inAttackRange) {
            nextState = 'attack';
            nextStateTimer = m.state === 'attack' ? stateTimer : 0;
          }

          const mLeft = nextX;
          const mRight = nextX + m.width;
          const mBottom = GROUND_H + m.y;
          const mTop = mBottom + m.height;

          const overlapsX = actorRight >= mLeft && actorLeft <= mRight;
          const overlapsY = actorBottom <= mTop + 14 && actorTop >= mBottom;

          if (overlapsX && overlapsY) {
            // Player stomped a slime from above while falling down
            if (stateRef.current.vy < -40 && actorBottom >= mTop - 24) {
              sound.playBump();
              sound.playPower();
              stateRef.current.vy = 880; // High bounce upward off slime stomp
              stateRef.current.grounded = false;
              // Stomp chain: each airborne stomp without landing pays more.
              stompChainRef.current += 1;
              const chain = stompChainRef.current;
              onAddScore(stompChainScore(chain));
              particleSys.current.triggerLandingDust(nextX + m.width / 2, stageH - mBottom);
              // Big combos celebrate: the deepest reachable chain is x2 —
              // the two slime pairs patrol zone-locked regions ~500px apart
              // while one stomp flight covers ~230px, so a third airborne
              // stomp is geometrically impossible for any player. x2 (both
              // slimes of one pair in one flight) is therefore the top of
              // real skill, and it earns the coin burst, chime and shake.
              // The sparkle carries no floating score — the chain shout
              // already announces the number.
              if (chain >= 2) {
                sound.playCoin();
                particleSys.current.triggerCoinSparkle(
                  nextX + m.width / 2,
                  stageH - mBottom - m.height,
                  12 + chain * 4,
                  false,
                );
                // The bigger the chain, the harder the cabinet shakes.
                shakeUntilRef.current = performance.now() + SHAKE_MS;
                shakePowerRef.current = Math.min(1.5, 0.75 + (chain - 2) * 0.25);
              }
              say(stompChainLabel(chain), 1600);

              // Stagger (Hit) first; the loop transitions it into Die.
              nextSlimes.push({
                ...m,
                x: nextX,
                vx: nextVx,
                facing,
                state: 'hit',
                frameIndex: 0,
                animTimer: 0,
                stateTimer: 0,
              });

              // Respawn a fresh slime on the same side, clear of the zone.
              const timeoutId = window.setTimeout(() => {
                const spawn = slimeSpawn({
                  side: m.side,
                  slot: m.slot,
                  color: m.color,
                  stageWidth: stateRef.current.stageWidth || 1000,
                  safeZone: {
                    min: stateRef.current.safeZoneMin,
                    max: stateRef.current.safeZoneMax,
                  },
                });
                slimesRef.current = [
                  ...slimesRef.current,
                  { id: Date.now() + Math.random(), ...spawn },
                ];
                setSlimes(slimesRef.current);
              }, SLIME_RESPAWN_MS);
              slimeRespawnTimeoutsRef.current.push(timeoutId);
              continue;
            } else if (!invulnerableRef.current && !playerInSafeZone && !spawnGrace) {
              // Player contact damage from a slime
              if (onTakeDamage) {
                onTakeDamage(1);
              }
              invulnerableRef.current = true;
              setInvulnerable(true);
              stateRef.current.vx = nextVx > 0 ? 200 : -200; // Knocks back player
              stateRef.current.vy = 360;
              stateRef.current.grounded = false;
              say('OUCH! SLIME ATTACK!', 1800);
              window.setTimeout(() => {
                invulnerableRef.current = false;
                setInvulnerable(false);
              }, 1200);
            }
          }

          nextSlimes.push({
            ...m,
            x: nextX,
            vx: nextVx,
            facing,
            state: nextState,
            stateTimer: nextStateTimer,
            frameIndex: slimeFrameIndex(nextState, nextStateTimer),
            animTimer: m.animTimer + dt,
          });
        }

        slimesRef.current = nextSlimes;
        setSlimes(nextSlimes);
      }

      // Update and render canvas particles
      particleSys.current.updateAndRender(dt);

      // Chain juice: rattle the whole stage briefly after a big stomp chain.
      // Transform-only so layout never reflows, decaying to zero, and skipped
      // under reduced motion — the stomp response itself is input-driven, the
      // shake is the celebratory part.
      if (shakeUntilRef.current > 0) {
        const remaining = shakeUntilRef.current - performance.now();
        if (remaining <= 0) {
          shakeUntilRef.current = 0;
          if (containerRef.current) containerRef.current.style.transform = '';
        } else if (!prefersReducedMotion && containerRef.current) {
          const decay = remaining / SHAKE_MS;
          const mag = SHAKE_MAX_PX * decay * shakePowerRef.current;
          const jx = (Math.random() * 2 - 1) * mag;
          const jy = (Math.random() * 2 - 1) * mag * 0.6;
          containerRef.current.style.transform = `translate(${jx.toFixed(1)}px, ${jy.toFixed(1)}px)`;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [openBlock, onAddScore, onAddCoin, doJump]);

  // Initial sizing + block position setup. Also places every pre-spawned
  // hazard clear of the freshly-computed safe zone and opens the damage-free
  // grace window, so the player is never hit before they take control.
  useEffect(() => {
    applyStageLayout(true);

    const { stageWidth, safeZoneMin, safeZoneMax } = stateRef.current;
    slimesRef.current = slimesRef.current.map((m) =>
      m.state === 'die'
        ? m
        : {
            id: m.id,
            ...slimeSpawn({
              side: m.side,
              slot: m.slot,
              color: m.color,
              stageWidth,
              safeZone: { min: safeZoneMin, max: safeZoneMax },
            }),
          },
    );
    setSlimes(slimesRef.current);

    spawnGraceUntilRef.current = performance.now() + SPAWN_GRACE_MS;
  }, [applyStageLayout]);

  // Clear any pending slime respawns on unmount so their timers can't fire
  // setState into a torn-down component.
  useEffect(() => {
    const pending = slimeRespawnTimeoutsRef.current;
    return () => {
      pending.forEach((id) => clearTimeout(id));
      pending.length = 0;
    };
  }, []);

  // --- Ground shadows ---
  // The character's shadow and the floating blocks' contact shadows share one
  // curve (utils/shadow.ts), so they read as sitting at the same depth.
  const shadowApex = jumpApexHeight(JUMP_V, GRAVITY);
  const actorShadow = shadowForHeight(posY, shadowApex, isLanding);
  const blockShadow = shadowForHeight(BLOCK_Y, shadowApex);

  const totalCollected = Object.keys(collectedItems).length;

  return (
    <section
      ref={containerRef}
      id="stage"
      style={{ ['--stage-h' as string]: '100svh' }}
      className={`relative w-full h-[100svh] min-h-[660px] overflow-hidden select-none touch-manipulation bg-[#070512] ${
        partyMode ? 'party-mode' : ''
      }`}
      onDragOver={(e) => {
        if (arrangeMode && dragBlockRef.current !== null) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!arrangeMode || dragBlockRef.current === null) return;
        e.preventDefault();
        const key = dragBlockRef.current;
        dragBlockRef.current = null;
        const stageW = containerRef.current?.clientWidth ?? 0;
        if (!stageW) return;
        const dxPct = clampDxPct((e.clientX - rectLeft()) / stageW - 0.5, stageW, BLOCK_SIZE);
        const next = withBlockPosition(blockPositions, key, dxPct);
        setBlockPositions(next);
        saveBlockPositions(BLOCK_POSITIONS_KEY, next);
        sound.playBlip(880, 0.03, 0.06);
      }}
    >
      {/* Hero Background Slideshow — full-bleed. An earlier inset "arcade
          bezel" framing was tried here and reverted: the frame line cut
          through the intro overlay's text on the left edge. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {useProceduralBackground ? (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(#03020a 0 38%, #0a0620 38% 54%, #130a2e 54% 68%, #1c1040 68% 82%, #331860 82% 100%)',
            }}
          />
        ) : (
          STAGE_BACKGROUNDS.map((url, i) => (
            <div
              key={url + i}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${url}')`,
                opacity: i === bgIndex ? 1 : 0,
                transition: `opacity ${crossfadeMs(prefersReducedMotion, SLIDESHOW_FADE_MS)}ms ease-in-out`,
              }}
            />
          ))
        )}

        {/* Dimming overlay only for the procedural fallback — the custom
            slideshow shows the artwork at full brightness. */}
        {!hasMultipleBackgrounds && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(7,5,18,0.35) 0%, rgba(7,5,18,0.9) 100%)',
            }}
          />
        )}
      </div>

      {/* Mystery-block arranger banner & control panel (toggle with 'L') */}
      {arrangeMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 border-2 border-[#ffd23f] bg-[#0a0620]/95 font-pixel text-[9px] text-[#ffd23f] shadow-[0_0_20px_rgba(255,210,63,0.5)]">
          <span>ARRANGE MODE · Drag blocks or nudge ◀ ▶ ▲ ▼ to position</span>
          <button
            type="button"
            className="px-2 py-1 border border-[#7d7aa3] text-[#7d7aa3] hover:text-[#00e5ff] hover:border-[#00e5ff] cursor-pointer"
            onClick={() => {
              setBlockPositions([]);
              try {
                window.localStorage.removeItem(BLOCK_POSITIONS_KEY);
              } catch {}
              sound.playBlip(440, 0.05, 0.06);
            }}
          >
            RESET
          </button>
          <button
            type="button"
            className="px-2 py-1 border border-[#ffd23f] text-black bg-[#ffd23f] hover:brightness-110 cursor-pointer"
            onClick={() => setArrangeMode(false)}
          >
            DONE
          </button>
        </div>
      )}
      {hasMultipleBackgrounds && (
        <>
          <button
            type="button"
            aria-label="Previous background"
            onClick={() => stepBackground(-1)}
            className="absolute left-2.5 sm:left-5 top-1/2 -translate-y-1/2 z-30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-sm border-2 border-[#00e5ff] bg-[#070512]/60 text-[#00e5ff] backdrop-blur-[2px] transition-all hover:bg-[#00e5ff]/20 hover:shadow-[0_0_12px_rgba(0,229,255,0.7)] active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next background"
            onClick={() => stepBackground(1)}
            className="absolute right-2.5 sm:right-5 top-1/2 -translate-y-1/2 z-30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-sm border-2 border-[#00e5ff] bg-[#070512]/60 text-[#00e5ff] backdrop-blur-[2px] transition-all hover:bg-[#00e5ff]/20 hover:shadow-[0_0_12px_rgba(0,229,255,0.7)] active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Slide-change progress bar — a neon pulse that sweeps across the base
          of the stage as the current background's hold time elapses, then the
          next one crossfades in. Keyed on the slide index so the sweep restarts
          on every change (auto or manual). Decorative: the chevrons remain the
          accessible control, so this is hidden from assistive tech. */}
      {hasMultipleBackgrounds && autoAdvance && (
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 z-30 h-[3px] overflow-hidden bg-[#241c42]/60 pointer-events-none"
        >
          <div
            key={bgIndex}
            className="h-full w-0 animate-slide-progress bg-gradient-to-r from-[#00e5ff] via-[#3dffa2] to-[#ff2d78] shadow-[0_0_10px_rgba(0,229,255,0.9)]"
            style={{ animationDuration: `${SLIDESHOW_INTERVAL_MS}ms` }}
          />
        </div>
      )}

      {/* Stars Background */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        {[...Array(36)].map((_, i) => (
          <span
            key={i}
            className="absolute bg-white rounded-full animate-pulse"
            style={{
              left: `${(i * 29) % 98}%`,
              top: `${(i * 17) % 45}%`,
              width: i % 3 === 0 ? '3px' : '2px',
              height: i % 3 === 0 ? '3px' : '2px',
              animationDuration: `${1.5 + (i % 4) * 0.8}s`,
              animationDelay: `${(i % 3) * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Pixel Rain */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        {[...Array(24)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[1.5px] bg-gradient-to-b from-transparent to-[#00e5ff] animate-pulse"
            style={{
              left: `${(i * 4.3) % 100}%`,
              top: `${(i * 7.1) % 80}%`,
              height: `${14 + (i % 8)}px`,
              animationDuration: `${0.8 + (i % 4) * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Ground: neon curb + asphalt */}
      <div className="absolute left-0 right-0 bottom-0 h-[92px] pointer-events-none flex flex-col z-10">
        <div className="h-1 bg-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.8),0_0_24px_rgba(0,229,255,0.4)]" />
        <div className="flex-1 bg-[#0d0a1a]" />
      </div>

      {/* Top Left Intro Overlay */}
      <div className="absolute top-20 left-4 sm:left-8 z-20 font-pixel text-white max-w-sm sm:max-w-md pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        <p className="text-sm sm:text-lg text-white">
          HI, I'M <b className="text-[#ffd23f]">{PORTFOLIO_CONFIG.name}</b>
          <span className="inline-block w-2.5 h-4 bg-[#00e5ff] ml-1.5 animate-pulse align-middle" />
        </p>
        <p className="text-[9px] sm:text-xs text-[#00e5ff] mt-2">
          {PORTFOLIO_CONFIG.role} · {PORTFOLIO_CONFIG.company}
        </p>
        {/* Easy to miss that the page keeps going below the arcade, so this hint
            gets the full attract-mode treatment: neon glow + hard blink. */}
        <p className="neon-blink mt-4 inline-block border-2 border-[#ffd23f] bg-[#0a0620]/90 px-3 py-2 font-pixel text-[10px] sm:text-xs leading-relaxed text-[#ffd23f] shadow-[0_0_18px_rgba(255,210,63,0.55)]">
          ▼ SCROLL DOWN FOR CHAPTERS OR JUMP OVERHEAD ▼
        </p>
      </div>

      {/* Inventory Item Slots (Top Right) */}
      <div className="absolute top-20 right-4 sm:right-8 z-20 font-pixel text-right text-[8px] text-[#7d7aa3]">
        <div className="flex items-center gap-2 justify-end mb-1">
          <span>ITEMS COLLECTED:</span>
          <b className="text-[#3dffa2] text-[10px]">{totalCollected}/4</b>
        </div>
        <div className="flex gap-2 justify-end">
          {MYSTERY_BLOCKS_DATA.map((item) => {
            const hasItem = collectedItems[item.key];
            return (
              <div
                key={item.key}
                title={`${item.title} block`}
                className={`w-8 h-8 border-2 flex items-center justify-center font-pixel transition-all ${
                  hasItem
                    ? 'border-black bg-white text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-105'
                    : 'border-dashed border-[#7d7aa3]/50 bg-[#070512]/80 text-[#7d7aa3]/50'
                }`}
                style={hasItem ? { backgroundColor: item.color } : {}}
              >
                <span className="text-[7px] font-pixel leading-none text-center font-bold">
                  {hasItem ? item.shortLabel || item.label : '?'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overhead Mystery ? Blocks. The row spans the full stage width so a
          block can be absolutely positioned anywhere along it; blocks without
          a saved position flow through the centred flex (the default spread). */}
      <div
        ref={blocksRowRef}
        className="absolute left-0 right-0 flex justify-center gap-4 sm:gap-6 z-30"
        style={{ bottom: `${GROUND_H + stateRef.current.blocksLift}px` }}
      >
        {MYSTERY_BLOCKS_DATA.map((block, idx) => {
          const isUsed = collectedItems[block.key];
          const isBumped = bumpedBlockKey === block.key;
          // Attract hint: glow while the player stands under this block, so the
          // "jump to bump" affordance is discoverable without a tutorial.
          const isHinted = hintedBlock === idx && !isUsed;
          // Relocation: a saved dxPct places the block absolutely within
          // the full-width row; blocks without one keep the centred flex flow.
          const savedPos = blockPositions.find((p) => p.key === block.key);
          const savedDx = savedPos;
          return (
            <button
              key={block.key}
              type="button"
              draggable={arrangeMode || undefined}
              onDragStart={(e) => {
                if (!arrangeMode) return;
                dragBlockRef.current = block.key;
                e.dataTransfer.effectAllowed = 'move';
                try {
                  e.dataTransfer.setData('text/plain', block.key);
                } catch {}
              }}
              onClick={() => {
                const bLeft = containerRef.current
                  ? containerRef.current.clientWidth / 2
                  : 500;
                openBlock(block.key, bLeft);
              }}
              data-block-key={block.key}
              className={`${savedDx ? 'absolute' : 'relative'} w-12 h-12 sm:w-14 sm:h-14 font-pixel transition-all cursor-pointer select-none border-2 flex items-center justify-center ${
                isBumped
                  ? 'animate-mystery-bump z-40'
                  : isUsed
                  ? 'animate-mystery-revealed'
                  : 'animate-mystery-idle'
              } ${
                isUsed
                  ? 'bg-[#0c0a18] border-[#241c42] text-[#7d7aa3] shadow-[0_4px_10px_rgba(0,0,0,0.6)]'
                  : 'bg-[#0a0817] border-[#00e5ff] text-[#ff2d78] shadow-[0_0_12px_rgba(0,229,255,0.4),inset_0_0_10px_rgba(0,229,255,0.2)] hover:bg-[#0d1b2e]'
              } ${isHinted ? 'ring-2 ring-[#ffd23f] shadow-[0_0_20px_rgba(255,210,63,0.85)]' : ''}`}
              style={{
                ...(!isBumped && !isUsed ? { animationDelay: `${idx * 0.28}s` } : {}),
                ...(isHinted
                  ? {
                      borderColor: '#ffd23f',
                      color: '#ffd23f',
                      boxShadow:
                        '0 0 18px rgba(255,210,63,0.75), inset 0 0 12px rgba(255,210,63,0.3)',
                    }
                  : {
                      borderColor: isUsed ? '#241c42' : block.color,
                      color: isUsed ? block.color : block.color,
                    }),
                // Centre the block on its saved fraction of the row width
                // (the -1.75rem half-block offset is tuned for the sm size).
                // dyUpPct raises/lowers the block from the default row height
                // via bottom (positive = up). Row height ≈ BLOCK_SIZE, so a
                // moved block's bottom is the row bottom + dy px.
                ...(savedDx
                  ? {
                      left: `calc(${50 + savedDx.dxPct * 100}% - 1.75rem)`,
                      ...(savedDx.dyUpPct
                        ? { bottom: `calc(${savedDx.dyUpPct * 100} * var(--stage-h, 100svh) / 100)` }
                        : {}),
                    }
                  : {}),
              }}
              title={
                arrangeMode
                  ? `Arrange mode: drag anywhere, or nudge ◀ ▶ ▲ ▼ (${block.title})`
                  : `Mystery Block: ${block.title}`
              }
              aria-label={`Mystery Block: ${block.title}`}
            >
              {/* Corner screws */}
              <span className="absolute top-1 left-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute top-1 right-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute bottom-1 left-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute bottom-1 right-1 w-1 h-1 bg-current opacity-70" />

              {/* Block Content: Animated '?' when idle, Asset image or label when revealed */}
              {isUsed ? (
                block.image ? (
                  <img
                    src={block.image}
                    alt={block.label}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain pixel-art drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] animate-mystery-item"
                  />
                ) : (
                  <span
                    className={`font-pixel font-bold tracking-tight uppercase leading-none block px-0.5 text-center animate-mystery-item ${
                      block.label.length >= 8
                        ? 'text-[6.5px] sm:text-[7.5px]'
                        : block.label.length >= 6
                        ? 'text-[7.5px] sm:text-[8.5px]'
                        : 'text-[9px] sm:text-[10px]'
                    }`}
                    style={{ color: block.color }}
                  >
                    {block.label}
                  </span>
                )
              ) : (
                <span className="font-pixel text-xl sm:text-2xl animate-mystery-question inline-block">
                  ?
                </span>
              )}

              {/* Arrange Mode Nudge Controls */}
              {arrangeMode && (
                <>
                  <span
                    className="absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 px-1 py-0.5 border border-[#ffd23f] bg-black text-[#ffd23f] text-[8px] cursor-pointer hover:bg-[#ffd23f] hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      nudgeBlock(block.key, -1, 0);
                    }}
                    title="Move block left"
                  >
                    ◀
                  </span>
                  <span
                    className="absolute -right-2 top-1/2 translate-x-full -translate-y-1/2 px-1 py-0.5 border border-[#ffd23f] bg-black text-[#ffd23f] text-[8px] cursor-pointer hover:bg-[#ffd23f] hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      nudgeBlock(block.key, 1, 0);
                    }}
                    title="Move block right"
                  >
                    ▶
                  </span>
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-1 py-0.5 border border-[#ffd23f] bg-black text-[#ffd23f] text-[8px] cursor-pointer hover:bg-[#ffd23f] hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      nudgeBlock(block.key, 0, 1);
                    }}
                    title="Move block up"
                  >
                    ▲
                  </span>
                  <span
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full px-1 py-0.5 border border-[#ffd23f] bg-black text-[#ffd23f] text-[8px] cursor-pointer hover:bg-[#ffd23f] hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      nudgeBlock(block.key, 0, -1);
                    }}
                    title="Move block down"
                  >
                    ▼
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Contact shadows for the floating blocks. They sit on the ground far
          below, which is what sells the blocks as elevated. Rendered as a
          separate row so the bump animation can't drag them upward with it.
          Shadow placement mirrors the block row (full-width, flow or absolute
          by saved position) so relocated blocks shadow in the right spot. */}
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 flex justify-center gap-4 sm:gap-6 z-10 pointer-events-none"
        style={{ bottom: `${GROUND_H - 6}px`, opacity: blockShadow.opacity.toFixed(3) }}
      >
        {MYSTERY_BLOCKS_DATA.map((block) => {
          const savedPos = blockPositions.find((p) => p.key === block.key);
          return (
            <div
              key={block.key}
              className={`${savedPos ? 'absolute' : 'relative'} w-12 sm:w-14 h-2 flex justify-center`}
              style={
                savedPos
                  ? {
                      left: `calc(${50 + savedPos.dxPct * 100}% - 1.75rem)`,
                      ...(savedPos.dyUpPct
                        ? { bottom: `calc(${savedPos.dyUpPct * 100} * var(--stage-h, 100svh) / 100)` }
                        : {}),
                    }
                  : undefined
              }
            >
              <span
                className="w-[60%] h-full"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 72%)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Falling Coins */}
      {fallingCoins.map((coin) => (
        <button
          key={coin.id}
          type="button"
          onClick={() => {
            onAddScore(100);
            onAddCoin(1);
            sound.playCoin();
            particleSys.current.triggerCoinSparkle(coin.x + 10, coin.y + 10, 24, true);
            const remaining = fallingCoinsRef.current.filter((c) => c.id !== coin.id);
            fallingCoinsRef.current = remaining;
            setFallingCoins(remaining);
          }}
          className="absolute z-20 w-5 h-5 bg-[#ffd23f] border-2 border-[#5a3d00] shadow-[inset_-2px_-2px_0_#b8860b,inset_2px_2px_0_#fff] cursor-pointer hover:scale-125 transition-transform"
          style={{
            left: `${coin.x}px`,
            top: `${coin.y}px`,
          }}
          title="Collect Coin (+100 pts)"
          aria-label="Collect Coin"
        >
          <span className="sr-only">Coin</span>
        </button>
      ))}

      {/* Falling Hearts (1UP Health Recovery) */}
      {fallingHearts.map((heart) => (
        <button
          key={heart.id}
          type="button"
          onClick={() => {
            if (onHeal) onHeal(1);
            onAddScore(250);
            particleSys.current.triggerCoinSparkle(heart.x + 8, heart.y + 8, 28, true);
            const remaining = fallingHeartsRef.current.filter((h) => h.id !== heart.id);
            fallingHeartsRef.current = remaining;
            setFallingHearts(remaining);
          }}
          className="absolute z-20 cursor-pointer hover:scale-125 transition-transform p-1 bg-[#110d24]/80 border border-[#ff2d78] shadow-[0_0_12px_rgba(255,45,120,0.6)]"
          style={{
            left: `${heart.x}px`,
            top: `${heart.y}px`,
          }}
          title="1UP Heart: Recover Health (+250 pts)"
          aria-label="1UP Heart: Recover Health"
        >
          <PixelHeart size={16} />
        </button>
      ))}

      {/* Slime Hazards — two patrolling each side of the stage. Suppressed
          under the automation hook so the playtest can measure the walk. */}
      {!noHazards && slimes.map((s) => (
        <SlimeMonster
          key={s.id}
          x={s.x}
          y={GROUND_H + s.y}
          color={s.color}
          state={s.state}
          frameIndex={s.frameIndex}
          width={s.width}
          height={s.height}
        />
      ))}

      {/* High-Performance Canvas Particle System (Sparkles, Twinkles, Landing Dust Puffs) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-25"
      />

      {/* Speech Bubble above Actor */}
      {bubbleVisible && (
        <div
          className={`absolute z-20 font-pixel text-[9px] sm:text-[10px] bg-[#0a0817] border-2 border-[#00e5ff] text-[#d9fbff] px-3.5 py-2.5 max-w-[280px] sm:max-w-[340px] text-center shadow-[0_0_14px_rgba(0,229,255,0.4),4px_4px_0_#000] pointer-events-none leading-relaxed transition-opacity duration-150 ${
            isAirborne ? 'opacity-40' : 'opacity-100'
          }`}
          style={{
            left: `${Math.min(
              Math.max(posX + stateRef.current.actorWidth / 2, 160),
              (stateRef.current.stageWidth || 800) - 160
            )}px`,
            bottom: `${GROUND_H + posY + stateRef.current.actorHeight + 14}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <span>{bubbleText}</span>
          {/* Speech bubble pointer arrow */}
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0a0817] border-b-2 border-r-2 border-[#00e5ff] rotate-45" />
        </div>
      )}

      {/* Safe-zone floor panel: a neon strip on the ground directly under the
          player's spawn, labelled with glowing text so the safe area is
          discoverable. Purely decorative — the immunity itself is enforced by
          the hazard loop. It sits above the backdrop but below the actor,
          shadows and hazards. */}
      <div
        aria-hidden="true"
        className="absolute z-[5] pointer-events-none"
        style={{
          left: `${safeZone.min}px`,
          width: `${Math.max(0, safeZone.max - safeZone.min)}px`,
          bottom: 0,
          height: `${GROUND_H}px`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#3dffa2] shadow-[0_0_12px_rgba(61,255,162,0.9)] animate-safe-zone" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#3dffa2]/20 via-[#3dffa2]/5 to-transparent" />
        <div className="absolute left-0 top-0 bottom-0 w-px bg-[#3dffa2]/50" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-[#3dffa2]/50" />
        {/* Centred badge sitting in the ground band under the feet: a shield
            emblem above the label, both breathing as one indicator. */}
        <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 animate-safe-zone">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="#3dffa2"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow-[0_0_6px_rgba(61,255,162,0.9)]"
          >
            <path
              d="M12 2.5 4.5 5.6v6.1c0 4.5 3.2 8.3 7.5 9.4 4.3-1.1 7.5-4.9 7.5-9.4V5.6L12 2.5Z"
              fill="rgba(61,255,162,0.12)"
            />
            <path d="m8.6 11.9 2.5 2.5 4.3-4.8" />
          </svg>
          <span className="font-pixel text-[7px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.3em] text-[#3dffa2] [text-shadow:0_0_6px_rgba(61,255,162,0.95),0_0_16px_rgba(61,255,162,0.75),0_0_30px_rgba(61,255,162,0.45)]">
            SAFE ZONE HERE
          </span>
        </div>
      </div>

      {/* Actor Shadow on Ground — feathered so it reads as light falloff instead
          of a flat black pill, which barely showed against the asphalt. */}
      <div
        className="absolute z-10 h-3 rounded-[50%] pointer-events-none transition-transform duration-75 ease-out"
        style={{
          left: `${posX + SHADOW_LEFT}px`,
          bottom: `${GROUND_H - 6}px`,
          width: `${SHADOW_W}px`,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 72%)',
          transform: `scale(${actorShadow.scaleX.toFixed(3)}, ${actorShadow.scaleY.toFixed(3)})`,
          opacity: actorShadow.opacity.toFixed(3),
        }}
      />

      {/* Playable Character Actor. Sits above the mystery blocks (z-30) so
          passing through their band reads as going in front of them instead of
          being sliced up by the gaps between them. */}
      <div
        ref={actorRef}
        onClick={handleActorClick}
        title="That's me! Click to jump or bump mystery blocks!"
        className={`absolute z-40 cursor-pointer select-none ${
          isCheering ? 'animate-bounce' : ''
        } ${invulnerable ? 'opacity-60 animate-pulse' : ''}`}
        style={{
          left: `${posX}px`,
          bottom: `${GROUND_H + posY}px`,
          width: `${stateRef.current.actorWidth}px`,
          // The box is the visible character: it's the click target and the
          // squash/stretch origin sits at his feet. The sprite frame overflows it.
          height: `${SPRITE_VISIBLE_H}px`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Character Sprite Sheet container.
            Rendered with pixelated smoothing, native scale, and positioned cleanly
            using the shared anchor baseline without card flips or scaleX mirroring. */}
        <div
          ref={spriteRef}
          className="absolute pixel-art drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
          style={{
            left: `${IDLE_POSE.offsetX}px`,
            bottom: `${IDLE_POSE.offsetY}px`,
            width: `${IDLE_POSE.width}px`,
            height: `${IDLE_POSE.height}px`,
            backgroundImage: `url(${SPRITE_SPECS.walk.src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: IDLE_POSE.backgroundSize,
            backgroundPosition: IDLE_POSE.backgroundPosition,
            transformOrigin: 'bottom center',
            imageRendering: 'pixelated',
          }}
          role="img"
          aria-label="Pixel character of Arshad Mohemed"
        />
      </div>

      {/* Controls Hint — the four sign panels, sitting on the ground strip at
          bottom-centre, just below the character. Rendered from the sliced
          artwork (2x source, so crisp at this size). Decorative:
          pointer-events-none so it never blocks stage clicks. */}
      <div
        aria-label="Character controls"
        className="absolute left-1/2 bottom-5 lg:bottom-6 -translate-x-1/2 z-20 hidden md:flex items-center gap-3 lg:gap-4 pointer-events-none"
      >
        <img src={moveControlsImg} alt="Move: left, right arrows or A and D" className="h-12 lg:h-14 w-auto" />
        <img src={jumpControlsImg} alt="Jump: Space or W" className="h-12 lg:h-14 w-auto" />
        <img src={bumpBlocksImg} alt="Bump blocks: jump with the up direction" className="h-12 lg:h-14 w-auto" />
        <img src={clickMeImg} alt="Click the character" className="h-12 lg:h-14 w-auto" />
      </div>

      {/* Mobile Touch D-Pad */}
      <div className="md:hidden absolute right-4 bottom-24 z-40 flex items-center gap-2">
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            keysRef.current.left = true;
          }}
          onTouchEnd={() => {
            keysRef.current.left = false;
          }}
          onMouseDown={() => {
            keysRef.current.left = true;
          }}
          onMouseUp={() => {
            keysRef.current.left = false;
          }}
          className="w-12 h-12 bg-[#070512]/90 border-2 border-[#00e5ff] text-[#00e5ff] font-pixel text-lg active:translate-y-1 shadow-[0_4px_0_#000]"
          aria-label="Move Left"
        >
          &lt;
        </button>

        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            doJump();
          }}
          onMouseDown={() => doJump()}
          className="w-14 h-14 bg-[#070512]/90 border-2 border-[#ff2d78] text-[#ff2d78] font-pixel text-sm active:translate-y-1 shadow-[0_4px_0_#000]"
          aria-label="Jump"
        >
          JUMP
        </button>

        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            keysRef.current.right = true;
          }}
          onTouchEnd={() => {
            keysRef.current.right = false;
          }}
          onMouseDown={() => {
            keysRef.current.right = true;
          }}
          onMouseUp={() => {
            keysRef.current.right = false;
          }}
          className="w-12 h-12 bg-[#070512]/90 border-2 border-[#00e5ff] text-[#00e5ff] font-pixel text-lg active:translate-y-1 shadow-[0_4px_0_#000]"
          aria-label="Move Right"
        >
          &gt;
        </button>
      </div>

    </section>
  );
};
