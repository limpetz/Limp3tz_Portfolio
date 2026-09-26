import React from 'react';
import { PORTFOLIO_CONFIG } from '../data/portfolioData';

export const ArcadeFooter: React.FC = () => {
  return (
    <footer className="border-t-2 border-[#241c42] bg-[#04030c] relative z-20">
      {/* Arcade Marquee Ticker. Two identical copies in a `w-max` row: the
          `animate-marquee` keyframes translate the row by exactly -50%, which
          is one copy's width, so the loop is seamless. The copies carry no
          flex gap (spacing lives in each span's padding) — a gap would make
          -50% land short of one copy and cause a visible jump. */}
      <div className="overflow-hidden border-b-2 border-[#241c42] bg-[#070512] py-2.5">
        <div className="whitespace-nowrap flex w-max animate-marquee">
          <span className="font-retro text-2xl text-[#ffd23f] tracking-widest drop-shadow-[0_0_8px_rgba(255,210,63,0.5)] pr-10">
            ★ {PORTFOLIO_CONFIG.ign} ★ {PORTFOLIO_CONFIG.name} ★ {PORTFOLIO_CONFIG.role} ★ {PORTFOLIO_CONFIG.company} ★ EX-NVIDIA QA ★ 13+ YEARS IN TECH ★ 44 REPERTOIRE SKILLS ★ EASTER EGG: ↑ ↑ ↓ ↓ ← → ← → B A ★ ONE MISSION: SIMPLIFY COMPLEXITY ★
          </span>
          <span
            aria-hidden="true"
            className="font-retro text-2xl text-[#ffd23f] tracking-widest drop-shadow-[0_0_8px_rgba(255,210,63,0.5)] pr-10"
          >
            ★ {PORTFOLIO_CONFIG.ign} ★ {PORTFOLIO_CONFIG.name} ★ {PORTFOLIO_CONFIG.role} ★ {PORTFOLIO_CONFIG.company} ★ EX-NVIDIA QA ★ 13+ YEARS IN TECH ★ 44 REPERTOIRE SKILLS ★ EASTER EGG: ↑ ↑ ↓ ↓ ← → ← → B A ★ ONE MISSION: SIMPLIFY COMPLEXITY ★
          </span>
        </div>
      </div>

      {/* Footer Details */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-pixel text-[8px] text-[#7d7aa3] text-center sm:text-left">
        <div>
          <p>© 2026 {PORTFOLIO_CONFIG.name} ({PORTFOLIO_CONFIG.ign})</p>
          <p className="text-[#00e5ff] mt-1">BUILT WITH 8-BIT SOUL IN NEON CITY · BENGALURU, INDIA</p>
        </div>

        <div className="flex gap-4">
          <a
            href={`mailto:${PORTFOLIO_CONFIG.email}`}
            className="hover:text-white transition-colors"
          >
            EMAIL
          </a>
          <span className="text-[#241c42]">·</span>
          <a
            href={PORTFOLIO_CONFIG.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00e5ff] transition-colors"
          >
            LINKEDIN
          </a>
          <span className="text-[#241c42]">·</span>
          <a
            href={PORTFOLIO_CONFIG.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#ffd23f] transition-colors"
          >
            GITHUB
          </a>
          <span className="text-[#241c42]">·</span>
          <a
            href={PORTFOLIO_CONFIG.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#5865f2] transition-colors"
          >
            DISCORD
          </a>
          <span className="text-[#241c42]">·</span>
          <a
            href={PORTFOLIO_CONFIG.steam}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#66c0f4] transition-colors"
          >
            STEAM
          </a>
        </div>
      </div>
    </footer>
  );
};
