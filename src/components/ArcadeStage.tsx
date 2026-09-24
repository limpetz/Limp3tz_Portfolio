import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PORTFOLIO_CONFIG, MYSTERY_BLOCKS_DATA, IDLE_QUIPS } from '../data/portfolioData';
import { sound } from '../utils/soundEngine';
import { ArcadeParticleSystem } from '../utils/particleSystem';

interface ArcadeStageProps {
  onAddScore: (amount: number) => void;
  onAddCoin: (amount: number) => void;
  spriteUrl: string;
  backgroundUrl: string;
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
  backgroundUrl,
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
  const JUMP_V = 780; // px/sec
  const GRAVITY = 1950; // px/sec²

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
    tilt: 0,
    landingTimer: 0,
    landingIntensity: 1,
    stageWidth: 1000,
    actorWidth: 72,
    actorHeight: 175,
    blocksLift: 275, // height of blocks above ground (positioned above speech bubble)
  });

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

  // Initialize and handle Canvas Particle System sizing
  useEffect(() => {
    if (canvasRef.current) {
      particleSys.current.attachCanvas(canvasRef.current);
    }
    const handleResize = () => {
      particleSys.current.resize();
    };
    window.addEventListener('resize', handleResize);

    const ro = new ResizeObserver(() => {
      particleSys.current.resize();
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, []);

  // Open mystery block
  const openBlock = useCallback((key: string, blockCenterX: number) => {
    const itemDef = MYSTERY_BLOCKS_DATA.find((x) => x.key === key);
    if (!itemDef) return;

    setBumpedBlockKey(key);
    setTimeout(() => setBumpedBlockKey(null), 300);

    if (collectedItemsRef.current[key]) {
      sound.playBump();
      say(`ALREADY COLLECTED: ${itemDef.title}!`, 1500);
      return;
    }

    const updated = { ...collectedItemsRef.current, [key]: true };
    collectedItemsRef.current = updated;
    setCollectedItems(updated);

    sound.playPower();
    sound.playCoin();
    onAddScore(50);
    onAddCoin(1);

    // Burst golden sparkles and stars at block location
    const stageH = containerRef.current?.clientHeight || 800;
    const blockCenterCanvasY = stageH - (GROUND_H + stateRef.current.blocksLift) + 24;
    particleSys.current.triggerCoinSparkle(blockCenterX, blockCenterCanvasY, 26, true);

    setIsCheering(true);
    setTimeout(() => setIsCheering(false), 900);

    say(itemDef.getLine(), 2800);

    const count = Object.keys(updated).length;
    if (count === MYSTERY_BLOCKS_DATA.length) {
      setTimeout(() => {
        onAddScore(500);
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

      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        keysRef.current.left = true;
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        keysRef.current.right = true;
      }
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        doJump();
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
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        keysRef.current.left = false;
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        keysRef.current.right = false;
      }
      // Variable jump height: release cuts vertical speed
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        if (!stateRef.current.grounded && stateRef.current.vy > 250) {
          stateRef.current.vy = 250;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doJump, triggerKonami]);

  // Periodic falling coins generator
  useEffect(() => {
    const coinInterval = setInterval(() => {
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
      const dt = Math.min((time - stateRef.current.lastT) / 1000, 0.05);
      stateRef.current.lastT = time;

      if (containerRef.current) {
        stateRef.current.stageWidth = containerRef.current.clientWidth;
      }

      // Horizontal movement physics with acceleration, friction, and skidding
      const moveDir = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      let vx = stateRef.current.vx;
      const targetVx = moveDir * MAX_SPEED;

      if (moveDir !== 0) {
        if (facingDirRef.current !== moveDir) {
          facingDirRef.current = moveDir as 1 | -1;
          setFacingDir(moveDir as 1 | -1);
        }

        // Check for skidding (changing direction while moving fast)
        const isSkidding = (vx > 50 && moveDir < 0) || (vx < -50 && moveDir > 0);
        if (isSkidding) {
          const skidStep = SKID_DECEL * dt;
          if (vx > 0) {
            vx = Math.max(0, vx - skidStep);
          } else {
            vx = Math.min(0, vx + skidStep);
          }

          stateRef.current.distSinceSkid += dt;
          if (stateRef.current.grounded && stateRef.current.distSinceSkid > 0.08 && Math.abs(vx) > 70) {
            stateRef.current.distSinceSkid = 0;
            const stageH = containerRef.current?.clientHeight || 800;
            const feetCanvasX = stateRef.current.x + stateRef.current.actorWidth / 2;
            const groundCanvasY = stageH - GROUND_H;
            particleSys.current.triggerSkidDust(feetCanvasX, groundCanvasY, Math.sign(vx));
          }
        } else {
          const accelStep = ACCEL * dt;
          if (vx < targetVx) {
            vx = Math.min(targetVx, vx + accelStep);
          } else if (vx > targetVx) {
            vx = Math.max(targetVx, vx - accelStep);
          }
        }
      } else {
        // Friction deceleration to smooth stop
        const frictStep = FRICTION * dt;
        if (vx > 0) {
          vx = Math.max(0, vx - frictStep);
        } else if (vx < 0) {
          vx = Math.min(0, vx + frictStep);
        }
        if (Math.abs(vx) < 5) vx = 0;
      }

      stateRef.current.vx = vx;
      setIsWalking(Math.abs(vx) > 20);

      // Position update
      const nextX = Math.max(
        12,
        Math.min(
          stateRef.current.stageWidth - stateRef.current.actorWidth - 12,
          stateRef.current.x + vx * dt
        )
      );
      if ((nextX <= 12 && vx < 0) || (nextX >= stateRef.current.stageWidth - stateRef.current.actorWidth - 12 && vx > 0)) {
        stateRef.current.vx = 0;
      }
      stateRef.current.x = nextX;
      setPosX(nextX);

      // Footstep dust puffs while running
      if (Math.abs(vx) > 25 && stateRef.current.grounded) {
        stateRef.current.distSincePuff += Math.abs(vx) * dt;
        if (stateRef.current.distSincePuff > 65) {
          stateRef.current.distSincePuff = 0;
          const stageH = containerRef.current?.clientHeight || 800;
          const feetCanvasX = nextX + stateRef.current.actorWidth / 2;
          const groundCanvasY = stageH - GROUND_H;
          particleSys.current.triggerFootstepDust(feetCanvasX, groundCanvasY, Math.sign(vx));
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
          const actorHead = stateRef.current.y + stateRef.current.actorHeight;
          const blockH = stateRef.current.blocksLift;
          if (actorHead >= blockH && actorHead <= blockH + 40) {
            // Check horizontal collision with any block
            const actorCenterX = stateRef.current.x + stateRef.current.actorWidth / 2;
            const containerW = stateRef.current.stageWidth;
            const blockSpacing = 70;
            const blocksStartX = containerW / 2 - (MYSTERY_BLOCKS_DATA.length * blockSpacing) / 2;

            MYSTERY_BLOCKS_DATA.forEach((b, idx) => {
              const bCenterX = blocksStartX + idx * blockSpacing + 26;
              if (Math.abs(actorCenterX - bCenterX) < 32) {
                openBlock(b.key, bCenterX);
                stateRef.current.vy = -120; // Bounce downward
              }
            });
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
          tilt = (stateRef.current.vx / MAX_SPEED) * 5;
        } else if (vy < -60) {
          const fallStretch = Math.min(0.14, (Math.abs(vy) / JUMP_V) * 0.14);
          squashY = 1 + fallStretch;
          squashX = 1 - fallStretch * 0.5;
          tilt = (stateRef.current.vx / MAX_SPEED) * 3;
        } else {
          // Apex float
          squashY = 1;
          squashX = 1;
          tilt = (stateRef.current.vx / MAX_SPEED) * 3;
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
        // Running stride cadence & forward lean
        stateRef.current.runCycle += Math.abs(stateRef.current.vx) * dt * 0.036;
        bobY = -Math.abs(Math.sin(stateRef.current.runCycle * Math.PI)) * 3.8;
        squashX = 1 + Math.sin(stateRef.current.runCycle * Math.PI * 2) * 0.035;
        squashY = 1 - Math.sin(stateRef.current.runCycle * Math.PI * 2) * 0.025;

        const targetTilt = (stateRef.current.vx / MAX_SPEED) * 5.2;
        stateRef.current.tilt += (targetTilt - stateRef.current.tilt) * Math.min(1, dt * 14);
        tilt = stateRef.current.tilt;
      } else {
        // Idle breathing on ground
        stateRef.current.tilt = 0;
        stateRef.current.runCycle = 0;
        isIdle = true;
      }

      // Update character sprite element
      if (spriteRef.current) {
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
  }, [openBlock, onAddScore, onAddCoin]);

  // Initial sizing
  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.clientWidth;
      stateRef.current.stageWidth = w;
      stateRef.current.x = Math.max(20, w / 2 - 60);
      setPosX(stateRef.current.x);
    }
  }, []);

  const totalCollected = Object.keys(collectedItems).length;

  return (
    <section
      ref={containerRef}
      id="stage"
      className={`relative w-full h-[100svh] min-h-[640px] overflow-hidden select-none touch-manipulation ${
        partyMode ? 'party-mode' : ''
      }`}
      style={{
        background: useProceduralBackground
          ? 'linear-gradient(#03020a 0 38%, #0a0620 38% 54%, #130a2e 54% 68%, #1c1040 68% 82%, #331860 82% 100%)'
          : `radial-gradient(ellipse at center, rgba(7,5,18,0.4) 0%, rgba(7,5,18,0.95) 100%), url('${backgroundUrl}') center/cover no-repeat`,
      }}
    >
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

      {/* Ground: curb + asphalt + reflections */}
      <div className="absolute left-0 right-0 bottom-0 h-[92px] pointer-events-none flex flex-col z-10">
        <div className="h-1 bg-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.8),0_0_24px_rgba(0,229,255,0.4)]" />
        <div className="flex-1 bg-[#0d0a1a] relative overflow-hidden">
          {/* Road dashes */}
          <div className="absolute top-6 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(90deg,#ffd23f_0_30px,transparent_30px_70px)] opacity-50" />
          {/* Wet asphalt puddle reflections */}
          <div className="absolute bottom-2 left-[15%] w-24 h-8 bg-[#00e5ff]/20 blur-[2px] rounded-full" />
          <div className="absolute bottom-2 right-[25%] w-32 h-8 bg-[#ff2d78]/25 blur-[2px] rounded-full" />
          <div className="absolute bottom-3 left-[48%] w-20 h-6 bg-[#ffd23f]/20 blur-[2px] rounded-full" />
        </div>
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
        <p className="text-[8px] text-[#7d7aa3] mt-3 animate-pulse">
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
        className="absolute left-1/2 -translate-x-1/2 flex gap-4 sm:gap-6 z-30"
        style={{ bottom: `${GROUND_H + stateRef.current.blocksLift}px` }}
      >
        {MYSTERY_BLOCKS_DATA.map((block) => {
          const isUsed = collectedItems[block.key];
          const isBumped = bumpedBlockKey === block.key;
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
              }`}
              style={{
                borderColor: isUsed ? '#241c42' : block.color,
                color: isUsed ? '#7d7aa3' : block.color,
              }}
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

      {/* Actor Shadow on Ground */}
      <div
        className="absolute z-10 h-3 bg-black/60 rounded-[50%] pointer-events-none transition-transform duration-75"
        style={{
          left: `${posX + 6}px`,
          bottom: `${GROUND_H - 6}px`,
          width: `${stateRef.current.actorWidth - 12}px`,
          transform: `scale(${Math.max(0.2, 1 - posY / 220) * (isLanding ? 1.25 : 1)}, ${Math.max(0.2, 1 - posY / 220)})`,
          opacity: Math.max(0.2, 0.8 - posY / 300),
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
          transform: `scaleX(${facingDir})`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          ref={spriteRef}
          className="relative origin-bottom"
          style={{ transformOrigin: 'bottom center' }}
        >
          <img
            src={spriteUrl}
            alt="Pixel character of Arshad Mohemed"
            className="w-full h-auto max-h-[175px] object-contain pixel-art drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
          />
        </div>
      </div>

      {/* Controls Hint & Mobile Touch D-Pad */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 font-pixel text-[8px] text-[#00e5ff] bg-[#04030c]/85 border border-[#00e5ff]/40 px-3 py-1.5 text-center hidden md:block shadow-[0_0_10px_rgba(0,229,255,0.4)]">
        &larr; &rarr; / A D MOVE · SPACE / W JUMP · BUMP BLOCKS · CLICK ME
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
