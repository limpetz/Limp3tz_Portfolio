import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PORTFOLIO_CONFIG, MYSTERY_BLOCKS_DATA, IDLE_QUIPS } from '../data/portfolioData';
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
  nearestBumpTarget,
} from '../utils/blocks';
import { crossfadeMs, shouldAutoAdvance, usePrefersReducedMotion } from '../utils/motion';
import { spritePlacement } from '../data/sprite';
import { shadowForHeight } from '../utils/shadow';
import {
  WALK_SHEET,
  backgroundPositionFor,
  frameAtElapsed,
} from '../utils/walk';
import moveControlsImg from '../assets/images/move.webp';
import jumpControlsImg from '../assets/images/jump.webp';
import bumpBlocksImg from '../assets/images/bump-blocks.webp';
import clickMeImg from '../assets/images/click-me.webp';

interface ArcadeStageProps {
  onAddScore: (amount: number) => void;
  onAddCoin: (amount: number) => void;
  spriteUrl: string;
  useProceduralBackground?: boolean;
}

interface FallingCoin {
  id: number;
  x: number;
  y: number;
  vy: number;
}

export const ArcadeStage: React.FC<ArcadeStageProps> = ({
  onAddScore,
  onAddCoin,
  spriteUrl,
  useProceduralBackground,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const facingDirRef = useRef<1 | -1>(1);

  const [posX, setPosX] = useState(200);
  const [posY, setPosY] = useState(0); // height above ground
  const [facingDir, setFacingDir] = useState<1 | -1>(1);
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

  // Falling Coins
  const [fallingCoins, setFallingCoins] = useState<FallingCoin[]>([]);
  const fallingCoinsRef = useRef<FallingCoin[]>([]);
  const [partyMode, setPartyMode] = useState(false);

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

  // Advance to the next background on an interval. Skipped entirely when the
  // visitor asked for reduced motion — the chevrons still step manually.
  useEffect(() => {
    if (!shouldAutoAdvance(prefersReducedMotion, STAGE_BACKGROUNDS.length)) return;
    const id = window.setInterval(() => {
      if (!stageVisibleRef.current) return;
      setBgIndex((i) => stepBackgroundIndex(i, 1, STAGE_BACKGROUNDS.length));
    }, SLIDESHOW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion, slideEpoch]);

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

  // Konami code buffer
  const konamiBuffer = useRef<string[]>([]);
  const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];

  // Physics constants
  const GROUND_H = 92;
  const MAX_SPEED = 280; // px/sec
  const ACCEL = 1800; // px/sec²
  const FRICTION = 2200; // px/sec²
  const SKID_DECEL = 3400; // px/sec²
  const JUMP_V = 1100; // px/sec (raised so the player can reach the overhead blocks)
  const GRAVITY = 1950; // px/sec²
  
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
  const BLOCK_Y = 275;          // px above ground the blocks sit
  // A block's collision box is the measured block plus this grace, so it is
  // forgiving to hit without reaching far past its visible edges.
  const BLOCK_BUMP_GRACE = 4;

  // --- Character actor box ---
  const ACTOR_W = 72; // collision-box width (px)

  // The sprite canvas is mostly transparent margin, so it is sized by its
  // *visible* character rather than by the canvas — otherwise the character
  // renders far smaller than intended. Metrics and maths live in data/sprite.ts;
  // 172px matches the height the original portrait sprite rendered at.
  const SPRITE_VISIBLE_H = 172;
  const SPRITE_PLACEMENT = spritePlacement(ACTOR_W, SPRITE_VISIBLE_H);

  // The ground shadow tracks the character's visible width, not the collision box.
  const SHADOW_W = Math.round(SPRITE_PLACEMENT.visibleWidth) - 12;
  const SHADOW_LEFT = (ACTOR_W - SHADOW_W) / 2;

  // --- Walk cycle ---
  // The sprite sheet replaces the old single still. Per the asset spec:
  // frames render at NATIVE size (88×170), the horizontal centre of the cell
  // is the character's position, and the feet sit on a baseline 164px from the
  // cell top. The physics loop pokes a background-position on the sprite
  // element, so frames never touch React state.
  const WALK_RENDER_W = WALK_SHEET.frameWidth; // 88 — native, do not scale
  const WALK_RENDER_H = WALK_SHEET.frameHeight; // 170
  const WALK_BASELINE_Y = WALK_SHEET.footY; // 164px from cell top
  const WALK_SPEED = 100; // CSS px/s (spec: start at 100)

  // Refs the loop mutates without re-rendering.
  const walkElapsedRef = useRef(0);
  const walkFrameRef = useRef<number | null>(null);
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
    blockHalfWidth: BLOCK_SIZE / 2, // measured, until the first DOM measure
    tilt: 0,
    landingTimer: 0,
    landingIntensity: 1,
    stageWidth: 1000,
    actorWidth: ACTOR_W,
    // Visible character height, which is what head-bump detection should use.
    actorHeight: SPRITE_VISIBLE_H,
    blocksLift: 275, // height of blocks above ground (positioned above speech bubble)
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

    Array.from(row.children).forEach((child) => {
      const rect = child.getBoundingClientRect();
      if (rect.width <= 0) return;
      centres.push(rect.left - stageLeft + rect.width / 2);
      halfWidth = Math.max(halfWidth, rect.width / 2);
    });

    // Only trust a complete measurement; otherwise keep whatever we had.
    if (centres.length === MYSTERY_BLOCKS_DATA.length) {
      stateRef.current.blockCentres = centres;
      stateRef.current.blockHalfWidth = halfWidth;
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
    };
    window.addEventListener('resize', handleResize);

    const ro = new ResizeObserver(() => {
      particleSys.current.resize();
      measureBlocks();
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
  }, [measureBlocks]);

  // Open mystery block
  const openBlock = useCallback((key: string, blockCenterX: number) => {
    const itemDef = MYSTERY_BLOCKS_DATA.find((x) => x.key === key);
    if (!itemDef) return;

    setBumpedBlockKey(key);
    setTimeout(() => setBumpedBlockKey(null), 300);

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
    onAddScore(BLOCK_SCORE);
    onAddCoin(BLOCK_COIN);

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

  // Jump trigger
  const doJump = useCallback(() => {
    if (!stateRef.current.grounded) return;
    stateRef.current.grounded = false;
    stateRef.current.y = 2;
    stateRef.current.vy = JUMP_V;
    stateRef.current.landingTimer = 0;
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
    }, 3800);

    return () => clearInterval(coinInterval);
  }, []);

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

      // Face the direction of travel (classic platformer flip). This is
      // instant, but the lean below smooths the *feel* of changing direction.
      if (moveDir !== 0 && facingDirRef.current !== moveDir) {
        facingDirRef.current = moveDir as 1 | -1;
        setFacingDir(moveDir as 1 | -1);
      }

      // Lean angle (degrees) springs toward the movement direction, so the
      // body rolls into a turn rather than snapping flat.
      const targetTurn = moveDir * MAX_TILT_DEG;
      stateRef.current.turnDamping *= TURN_DAMP;
      stateRef.current.turnAngle +=
        (targetTurn - stateRef.current.turnAngle) * Math.min(1, dt * TURN_SPEED);

      // Smooth speed ramp: accelerate toward the target velocity at ACCEL,
      // and decelerate with friction when there's no input. Click-to-move
      // walks at the spec's 100px/s; keyboard walks at full sprint speed.
      const targetVx =
        moveDir * (clickDestRef.current != null && moveDirection(keysRef.current.left, keysRef.current.right) === 0 ? WALK_SPEED : MAX_SPEED);
      stateRef.current.vx =
        moveDir !== 0
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

      // Vertical band occupied by the overhead blocks
      const blockBandBottom = GROUND_H + BLOCK_Y;
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
      // sideways into a block. Jumping straight up (vx ~ 0) should bump the
      // block from below instead of being shoved out sideways.
      if (inBlockBand && Math.abs(stateRef.current.vx) > 1) {
        const hitIndex = findOverlappingBlock(actorL, actorR, blocks, blockRadius);

        if (hitIndex !== -1) {
          stateRef.current.x = clampToStage(
            resolveBlockCollision(
              stateRef.current.x,
              stateRef.current.actorWidth,
              blocks[hitIndex],
              blockRadius,
              stateRef.current.vx > 0
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
        // Apex float: subtle gravity dampening near peak
        const apexFactor = Math.abs(stateRef.current.vy) < 80 ? 0.75 : 1.0;
        stateRef.current.vy -= GRAVITY * apexFactor * dt;
        stateRef.current.y += stateRef.current.vy * dt;

        // Check head collision with mystery blocks while moving UP
        if (stateRef.current.vy > 0) {
          const hit = findHeadBumpedBlock({
            actorCenterX: stateRef.current.x + stateRef.current.actorWidth / 2,
            actorHead: stateRef.current.y + stateRef.current.actorHeight,
            blockCentres: stateRef.current.blockCentres,
            blockLift: stateRef.current.blocksLift,
            radius: stateRef.current.blockHalfWidth + BLOCK_BUMP_GRACE,
          });

          if (hit) {
            openBlock(MYSTERY_BLOCKS_DATA[hit.index].key, hit.centerX);
            stateRef.current.vy = HEAD_BUMP_BOUNCE; // Bounce downward
          }
        }

        // Hit ground (Landing effect)
        if (stateRef.current.y <= 0) {
          const fallSpeed = Math.abs(stateRef.current.vy);
          stateRef.current.y = 0;
          stateRef.current.vy = 0;
          stateRef.current.grounded = true;
          setIsAirborne(false);
          setIsLanding(true);
          stateRef.current.landingTimer = 0.22;
          stateRef.current.landingIntensity = Math.min(1.0, Math.max(0.4, fallSpeed / 620));
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
      if (HOLD_TO_JUMP && keysRef.current.jump && stateRef.current.grounded) {
        doJump();
      }

      // Compute character dynamic squash, stretch, tilt, bob, and breathing
      let squashX = 1;
      let squashY = 1;
      let tilt = 0;
      let bobY = 0;
      let isIdle = false;

      if (!stateRef.current.grounded) {
        // Airborne: stretch on ascent, aerodynamic float/fall on descent
        const vy = stateRef.current.vy;
        if (vy > 60) {
          const stretch = Math.min(0.20, (vy / JUMP_V) * 0.20);
          squashY = 1 + stretch;
          squashX = 1 - stretch * 0.6;
          tilt = stateRef.current.turnAngle * 1.15;
        } else if (vy < -60) {
          const fallStretch = Math.min(0.14, (Math.abs(vy) / JUMP_V) * 0.14);
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
          // Impact squash
          const p = progress / 0.35;
          const s = Math.sin(p * Math.PI * 0.5);
          squashY = 1.0 - 0.26 * intensity * s;
          squashX = 1.0 + 0.24 * intensity * s;
          bobY = 3.5 * intensity * s;
        } else if (progress < 0.70) {
          // Elastic spring overshoot
          const p = (progress - 0.35) / 0.35;
          const r = Math.sin(p * Math.PI);
          squashY = 1.0 + 0.08 * intensity * r;
          squashX = 1.0 - 0.06 * intensity * r;
          bobY = -2.0 * intensity * r;
        } else {
          // Settle
          squashY = 1;
          squashX = 1;
          bobY = 0;
        }
      } else if (Math.abs(stateRef.current.vx) > 15) {
        // WALKING: advance the sheet's clock only while actually moving, so the
        // cadence is tied to motion (10fps from the JSON). Frame advance happens
        // below in the sprite-update block; here we just keep the lean.
        walkElapsedRef.current += dt * 1000;

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

      // Update character sprite element.
      // The sheet frame is selected from real elapsed time (refresh-rate
      // independent) and applied as a background-position — no React state.
      if (spriteRef.current) {
        const walkingNow = !isIdle && !isCheering && Math.abs(stateRef.current.vx) > 15;
        const animName =
          facingDirRef.current === 1
            ? walkingNow
              ? 'walkRight'
              : 'idleRight'
            : walkingNow
              ? 'walkLeft'
              : 'idleLeft';
        const indices = WALK_SHEET.animations[animName];
        const frameIdx = walkingNow
          ? frameAtElapsed(walkElapsedRef.current, indices, WALK_SHEET.frames, WALK_SHEET.defaultFps)
          : indices[0];

        if (walkFrameRef.current !== frameIdx) {
          walkFrameRef.current = frameIdx;
          spriteRef.current.style.backgroundPosition = backgroundPositionFor(
            WALK_SHEET.frames[frameIdx],
            WALK_SHEET,
            WALK_RENDER_W,
            WALK_RENDER_H,
          );
        }

        if (isIdle && !isCheering) {
          if (!spriteRef.current.classList.contains('animate-idle-breathe')) {
            spriteRef.current.classList.add('animate-idle-breathe');
          }
          spriteRef.current.style.transform = '';
        } else {
          if (spriteRef.current.classList.contains('animate-idle-breathe')) {
            spriteRef.current.classList.remove('animate-idle-breathe');
          }
          spriteRef.current.style.transform = `scale(${squashX.toFixed(3)}, ${squashY.toFixed(3)}) rotate(${tilt.toFixed(2)}deg) translateY(${bobY.toFixed(2)}px)`;
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

      // Update and render canvas particles
      particleSys.current.updateAndRender(dt);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [openBlock, onAddScore, onAddCoin, doJump]);

  // Initial sizing + block position setup
  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.clientWidth;
      stateRef.current.stageWidth = w;
      stateRef.current.x = Math.max(20, w / 2 - 60);
      setPosX(stateRef.current.x);
    }
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
      className={`relative w-full h-[100svh] min-h-[640px] overflow-hidden select-none touch-manipulation bg-[#070512] ${
        partyMode ? 'party-mode' : ''
      }`}
    >
      {/* Hero Background Slideshow */}
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

      {/* Manual slideshow navigation */}
      {hasMultipleBackgrounds && (
        <>
          <button
            type="button"
            aria-label="Previous background"
            onClick={() => stepBackground(-1)}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-sm border-2 border-[#00e5ff] bg-[#070512]/60 text-[#00e5ff] backdrop-blur-[2px] transition-all hover:bg-[#00e5ff]/20 hover:shadow-[0_0_16px_rgba(0,229,255,0.8)] active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next background"
            onClick={() => stepBackground(1)}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-sm border-2 border-[#00e5ff] bg-[#070512]/60 text-[#00e5ff] backdrop-blur-[2px] transition-all hover:bg-[#00e5ff]/20 hover:shadow-[0_0_16px_rgba(0,229,255,0.8)] active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
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
                className={`w-8 h-8 border-2 flex items-center justify-center text-[10px] font-pixel transition-all ${
                  hasItem
                    ? 'border-black bg-white text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-105'
                    : 'border-dashed border-[#7d7aa3]/50 bg-[#070512]/80 text-[#7d7aa3]/50'
                }`}
                style={hasItem ? { backgroundColor: item.color } : {}}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overhead Mystery ? Blocks */}
      <div
        ref={blocksRowRef}
        className="absolute left-1/2 -translate-x-1/2 flex gap-4 sm:gap-6 z-30"
        style={{ bottom: `${GROUND_H + stateRef.current.blocksLift}px` }}
      >
        {MYSTERY_BLOCKS_DATA.map((block, idx) => {
          const isUsed = collectedItems[block.key];
          const isBumped = bumpedBlockKey === block.key;
          // Attract hint: glow while the player stands under this block, so the
          // "jump to bump" affordance is discoverable without a tutorial.
          const isHinted = hintedBlock === idx && !isUsed;
          return (
            <button
              key={block.key}
              type="button"
              onClick={() => {
                const bLeft = containerRef.current
                  ? containerRef.current.clientWidth / 2
                  : 500;
                openBlock(block.key, bLeft);
              }}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 font-pixel text-xl sm:text-2xl transition-transform cursor-pointer select-none border-2 ${
                isBumped ? '-translate-y-4 duration-150' : 'translate-y-0 duration-200'
              } ${
                isUsed
                  ? 'bg-[#0c0a18] border-[#241c42] text-[#7d7aa3]'
                  : 'bg-[#0a0817] border-[#00e5ff] text-[#ff2d78] shadow-[0_0_12px_rgba(0,229,255,0.4),inset_0_0_10px_rgba(0,229,255,0.2)] hover:bg-[#0d1b2e]'
              } ${isHinted ? 'animate-pulse' : ''}`}
              style={
                isHinted
                  ? {
                      borderColor: '#ffd23f',
                      color: '#ffd23f',
                      boxShadow:
                        '0 0 18px rgba(255,210,63,0.75), inset 0 0 12px rgba(255,210,63,0.3)',
                    }
                  : {
                      borderColor: isUsed ? '#241c42' : block.color,
                      color: isUsed ? '#7d7aa3' : block.color,
                    }
              }
              title={`Mystery Block: ${block.title}`}
              aria-label={`Mystery Block: ${block.title}`}
            >
              {/* Corner screws */}
              <span className="absolute top-1 left-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute top-1 right-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute bottom-1 left-1 w-1 h-1 bg-current opacity-70" />
              <span className="absolute bottom-1 right-1 w-1 h-1 bg-current opacity-70" />
              <span>{isUsed ? block.label : '?'}</span>
            </button>
          );
        })}
      </div>

      {/* Contact shadows for the floating blocks. They sit on the ground far
          below, which is what sells the blocks as elevated. Rendered as a
          separate row so the bump animation can't drag them upward with it. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 flex gap-4 sm:gap-6 z-10 pointer-events-none"
        style={{ bottom: `${GROUND_H - 6}px`, opacity: blockShadow.opacity.toFixed(3) }}
      >
        {MYSTERY_BLOCKS_DATA.map((block) => (
          <div key={block.key} className="w-12 sm:w-14 h-2 flex justify-center">
            <span
              className="w-[60%] h-full"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 72%)',
              }}
            />
          </div>
        ))}
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

      {/* Playable Character Actor */}
      <div
        ref={actorRef}
        onClick={handleActorClick}
        title="That's me! Click to jump or bump mystery blocks!"
        className={`absolute z-20 cursor-pointer select-none transition-transform duration-100 ease-out ${
          isCheering ? 'animate-bounce' : ''
        }`}
        style={{
          left: `${posX}px`,
          bottom: `${GROUND_H + posY}px`,
          width: `${stateRef.current.actorWidth}px`,
          // The box is the visible character: it's the click target and the
          // squash/stretch origin sits at his feet. The sprite frame overflows it.
          height: `${SPRITE_VISIBLE_H}px`,
          transform: `scaleX(${facingDir})`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Walk-cycle sheet. Native cell size, centred on the collision box;
            the feet baseline (164px into the cell) sits on the box bottom. */}
        <div
          ref={spriteRef}
          className="absolute pixel-art drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
          style={{
            left: `${(ACTOR_W - WALK_RENDER_W) / 2}px`,
            bottom: `${-(WALK_RENDER_H - WALK_BASELINE_Y)}px`,
            width: `${WALK_RENDER_W}px`,
            height: `${WALK_RENDER_H}px`,
            backgroundImage: `url(${WALK_SHEET.src})`,
            backgroundRepeat: 'no-repeat',
            // Row 0, column 0 = standing, facing right (matches initial state).
            backgroundPosition: backgroundPositionFor(
              WALK_SHEET.frames[WALK_SHEET.animations.idleRight[0]],
              WALK_SHEET,
              WALK_RENDER_W,
              WALK_RENDER_H,
            ),
            transformOrigin: 'bottom center',
          }}
          role="img"
          aria-label="Pixel character of Arshad Mohemed"
        />
      </div>

      {/* Controls Hint — the four sign panels, centred mid-screen. Rendered from
          the sliced artwork (2x source, so crisp at this size). Decorative:
          pointer-events-none so it never blocks stage clicks. */}
      <div
        aria-label="Character controls"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex items-center gap-3 lg:gap-4 pointer-events-none"
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
          onMouseDown={doJump}
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
