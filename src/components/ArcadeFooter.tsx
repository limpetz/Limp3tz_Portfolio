import React from 'react';
import { PORTFOLIO_CONFIG } from '../data/portfolioData';

export const ArcadeFooter: React.FC = () => {
  return (
    <footer className="border-t-2 border-[#241c42] bg-[#04030c] relative z-20">
      {/* Arcade Marquee Ticker */}
      <div className="overflow-hidden border-b-2 border-[#241c42] bg-[#070512] py-2.5">
        <div className="whitespace-nowrap flex gap-4 animate-[ticker_35s_linear_infinite]">
          <span className="font-retro text-2xl text-[#ffd23f] tracking-widest drop-shadow-[0_0_8px_rgba(255,210,63,0.5)]">
            ★ {PORTFOLIO_CONFIG.ign} ★ {PORTFOLIO_CONFIG.name} ★ {PORTFOLIO_CONFIG.role} ★ {PORTFOLIO_CONFIG.company} ★ EX-NVIDIA QA ★ 13+ YEARS IN TECH ★ 44 REPERTOIRE SKILLS ★ EASTER EGG: ↑ ↑ ↓ ↓ ← → ← → B A ★ ONE MISSION: SIMPLIFY COMPLEXITY ★
          </span>
          <span className="font-retro text-2xl text-[#ffd23f] tracking-widest drop-shadow-[0_0_8px_rgba(255,210,63,0.5)]">
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
        </div>
      </div>
    </footer>
  );
};
