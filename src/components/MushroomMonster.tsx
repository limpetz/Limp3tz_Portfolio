import React from 'react';
import mushroomRunImg from '../assets/images/mushroom/Mushroom-Run.png';
import mushroomIdleImg from '../assets/images/mushroom/Mushroom-Idle.png';
import mushroomHitImg from '../assets/images/mushroom/Mushroom-Hit.png';
import mushroomDieImg from '../assets/images/mushroom/Mushroom-Die.png';
import mushroomAttackImg from '../assets/images/mushroom/Mushroom-Attack.png';

export type MushroomState = 'run' | 'idle' | 'hit' | 'die' | 'attack';

interface MushroomMonsterProps {
  x: number;
  y: number; // ground clearance in px
  facing: 1 | -1;
  state?: MushroomState;
  frameIndex?: number;
}

/**
 * 80x64 sprite sheet animations for Mushroom Monster:
 * - Run: 8 frames (640x64)
 * - Idle: 7 frames (560x64)
 * - Hit: 5 frames (400x64)
 * - Die: 15 frames (1200x64)
 * - Attack: 10 frames (800x64)
 */
const ANIM_CONFIG: Record<MushroomState, { src: string; frames: number }> = {
  run: { src: mushroomRunImg, frames: 8 },
  idle: { src: mushroomIdleImg, frames: 7 },
  hit: { src: mushroomHitImg, frames: 5 },
  die: { src: mushroomDieImg, frames: 15 },
  attack: { src: mushroomAttackImg, frames: 10 },
};

export const MushroomMonster: React.FC<MushroomMonsterProps> = ({
  x,
  y,
  facing,
  state = 'run',
  frameIndex = 0,
}) => {
  const config = ANIM_CONFIG[state] || ANIM_CONFIG.run;
  const currentFrame = frameIndex % config.frames;
  const offsetX = currentFrame * 80;

  return (
    <div
      className="absolute z-20 pointer-events-none select-none"
      style={{
        left: `${x}px`,
        bottom: `${y}px`,
        width: '64px',
        height: '52px',
        transform: `scaleX(${facing})`,
        transformOrigin: 'bottom center',
      }}
      aria-label="Mushroom Monster Hazard"
    >
      <div
        className="w-full h-full pixel-art drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
        style={{
          width: '80px',
          height: '64px',
          position: 'absolute',
          bottom: 0,
          left: '-8px',
          backgroundImage: `url(${config.src})`,
          backgroundPosition: `-${offsetX}px 0px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
