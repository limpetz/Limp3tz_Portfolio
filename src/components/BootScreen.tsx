import React from 'react';
import { sound } from '../utils/soundEngine';

/** Build identity, injected at build time by vite.config.ts `define`. */
const BUILD_LABEL = `${__APP_VERSION__} · ${__BUILD_DATE__}`;

interface BootScreenProps {
  onStart: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ onStart }) => {
  const handleStart = () => {
    sound.initUserGesture();
    sound.playMusic();
    sound.playStart();
    onStart();
  };

  return (
    <div
      onClick={handleStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleStart();
        }
      }}
      className="fixed inset-0 z-[100] bg-[#04030c] flex items-center justify-center text-center cursor-pointer select-none px-4 animate-in fade-in duration-300"
      aria-label="Press start to enter the portfolio"
    >
      <div className="max-w-3xl space-y-6">
        <p className="font-pixel text-[9px] sm:text-[11px] text-[#7d7aa3] tracking-[4px] uppercase animate-pulse">
          A Neon Pixel Arcade Portfolio Presents
        </p>

        <h1 className="font-retro text-6xl sm:text-8xl md:text-9xl text-[#ffd23f] tracking-wider animate-glitch leading-none">
          LIMP3TZ
        </h1>

        <div className="h-0.5 w-32 mx-auto bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent my-4" />

        <p className="font-pixel text-[9px] sm:text-[11px] text-[#ff2d78] tracking-widest leading-relaxed shadow-[0_0_12px_rgba(255,45,120,0.5)]">
          ARSHAD MOHEMED · SR. SPECIALIST TRAINER — AD OPS · EX-NVIDIA
        </p>

        <div className="pt-8">
          <p className="font-pixel text-sm sm:text-base text-[#3dffa2] animate-bounce shadow-[0_0_12px_rgba(61,255,162,0.7)]">
            ▶ PRESS START / CLICK TO PLAY ◀
          </p>
          <p className="font-retro text-lg sm:text-xl text-[#7d7aa3] mt-2">
            [ ARROW KEYS / WASD MOVE · SPACE JUMP · TOUCH D-PAD READY ]
          </p>
        </div>

        <p className="font-pixel text-[8px] text-[#7d7aa3]/70 pt-10">
          © 2026 ARSHAD MOHEMED (LIMP3TZ) · ALL RIGHTS RESERVED
        </p>

        {/* Build badge: version · date · sha. Comparing this against the latest
            commit on main makes a stale build obvious at a glance. */}
        <p className="font-pixel text-[8px] text-[#7d7aa3]/50 pt-1 tracking-wider">
          BUILD {BUILD_LABEL} · {__BUILD_SHA__.toUpperCase()}
        </p>
      </div>
    </div>
  );
};
