import React, { useState, useEffect } from 'react';
import { sound } from '../utils/soundEngine';

interface GameOverModalProps {
  onContinue: () => void;
  onRestart: () => void;
  coins: number;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  onContinue,
  onRestart,
  coins,
}) => {
  const [countdown, setCountdown] = useState(9);

  useEffect(() => {
    sound.playBump();
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        sound.playBlip(320, 0.06, 0.08);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md font-pixel p-4 select-none">
      <div className="relative max-w-md w-full bg-[#0a0817] border-4 border-[#ff2d78] shadow-[0_0_40px_rgba(255,45,120,0.6)] p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
        {/* CRT Scanline styling effect */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-[#ff2d78] tracking-widest animate-pulse">
            GAME OVER
          </h2>
          <p className="text-[10px] text-[#ffd23f]">ALL HEARTS DEPLETED</p>
        </div>

        {/* Retro Countdown */}
        <div className="py-2">
          <span className="text-[10px] text-[#7d7aa3] block mb-1">CONTINUE?</span>
          <span className="text-5xl sm:text-6xl font-black text-[#00e5ff] tracking-tighter drop-shadow-[0_0_12px_rgba(0,229,255,0.8)] tabular-nums">
            {countdown}
          </span>
        </div>

        {/* Continue & Respawn actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
          <button
            type="button"
            onClick={() => {
              sound.playPower();
              onContinue();
            }}
            className="w-full sm:w-auto px-5 py-3 border-2 border-[#3dffa2] bg-[#3dffa2]/15 text-[#3dffa2] hover:bg-[#3dffa2] hover:text-black transition-all cursor-pointer text-xs font-bold shadow-[0_4px_0_#000] active:translate-y-1"
          >
            INSERT COIN (CONTINUE)
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playStart();
              onRestart();
            }}
            className="w-full sm:w-auto px-4 py-3 border-2 border-[#7d7aa3] text-[#7d7aa3] hover:border-white hover:text-white transition-all cursor-pointer text-[9px]"
          >
            RESTART STAGE
          </button>
        </div>

        <p className="text-[8px] text-[#7d7aa3] tracking-wide">
          COINS IN WALLET: x{String(coins).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
};
