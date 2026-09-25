import React from 'react';
import { PORTFOLIO_CONFIG } from '../data/portfolioData';
import { spriteCanvasSize } from '../data/sprite';
import { GitHubActivity } from './GitHubActivity';
import { PixelHeart } from './PixelHeart';

interface CharacterSheetProps {
  spriteUrl: string;
  health: number;
  onAddScore: (amount: number) => void;
  onTakeDamage?: (amount?: number) => void;
  onHeal?: (amount?: number) => void;
}

// The portrait is sized by its *visible* character, since the sprite canvas is
// mostly transparent margin. 301px matches the height the original portrait
// sprite rendered at in this frame. The canvas keeps the artwork's aspect ratio
// and shrinks together on narrow screens.
const PORTRAIT = spriteCanvasSize(301);

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  spriteUrl,
  health,
  onAddScore,
  onTakeDamage,
  onHeal,
}) => {
  return (
    <section id="about" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto scroll-mt-16">
      {/* Header */}
      <div className="flex items-center gap-4 mb-12 flex-wrap">
        <span className="font-pixel text-xs px-3 py-2 bg-[#0a0817] border-2 border-[#00e5ff] text-[#00e5ff]">
          LEVEL 13
        </span>
        <h2 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
          CHARACTER SHEET
        </h2>
        <div className="flex-1 border-t-2 border-dashed border-[#241c42] min-w-[60px]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10 items-start">
        {/* Left Column: Character Card */}
        <div className="relative bg-[#110d24] border-2 border-[#241c42] p-5 text-center shadow-[8px_8px_0_#000]">
          {/* Cyberpunk corner brackets */}
          <span className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#00e5ff]" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#00e5ff]" />
          <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#00e5ff]" />
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#00e5ff]" />

          {/* Portrait Frame */}
          <div className="bg-gradient-to-b from-[#160f33] to-[#241348] border-2 border-[#241c42] p-4 flex items-center justify-center min-h-[320px] overflow-hidden">
            {/* Width only: `h-auto` keeps the artwork's aspect ratio, so the
                portrait shrinks without distorting when the panel narrows. */}
            <img
              src={spriteUrl}
              alt="Arshad Mohemed pixel character portrait"
              className="h-auto max-w-full object-contain pixel-art drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] animate-idle-breathe"
              style={{ width: `${PORTRAIT.width}px` }}
            />
          </div>

          <p className="mt-4 font-pixel text-[9px] text-[#3dffa2] animate-pulse">
            P1 — READY FOR NEXT QUEST!
          </p>

          {/* Animated 4 Pixel Hearts */}
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-label={`Health: ${health} of 4 hearts`}>
            <b className="font-pixel text-[8px] text-[#ff2d78] tracking-widest font-bold mr-0.5 not-italic">HP</b>
            {[0, 1, 2, 3].map((i) => {
              const isFilled = i < health;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (isFilled && onTakeDamage) onTakeDamage(1);
                    else if (!isFilled && onHeal) onHeal(1);
                  }}
                  className="inline-flex cursor-pointer hover:scale-125 transition-transform"
                  title={isFilled ? `Heart ${i + 1} (Click to take damage)` : `Heart ${i + 1} empty (Click to heal)`}
                >
                  <PixelHeart
                    size={16}
                    delay={i * 0.15}
                    filled={isFilled}
                  />
                </button>
              );
            })}
            <b
              className={`font-pixel text-[8px] tracking-wider ml-0.5 not-italic ${
                health === 4 ? 'text-[#3dffa2]' : health > 1 ? 'text-[#ffd23f]' : 'text-[#ff2d78] animate-pulse'
              }`}
            >
              {health === 4 ? 'MAX' : `${health}/4`}
            </b>
          </div>

          <div className="mt-4 pt-3 border-t border-[#241c42] font-pixel text-[8px] text-[#7d7aa3] space-y-1">
            <p>CLASS: TRAINER / AD OPS ARCHITECT</p>
            <p className="text-[#ffd23f]">XP: 13+ YEARS IN TECH</p>
          </div>

          {/* Live GitHub radar, straight under the portrait. Compact variant:
              status strip + stat tiles + heatmap, sized for this 320px column.
              The full terminal feed lives on the L4 GitHub cartridge dialog. */}
          <div className="mt-5 pt-4 border-t-2 border-dashed border-[#241c42]">
            <GitHubActivity compact onAddScore={onAddScore} />
          </div>
        </div>

        {/* Right Column: Stats Table & Narrative Bio */}
        <div className="space-y-6">
          <div>
            <h3 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
              {PORTFOLIO_CONFIG.name}
            </h3>
            <p className="text-[#00e5ff] font-retro text-2xl mt-1">
              {PORTFOLIO_CONFIG.role} · LV {PORTFOLIO_CONFIG.level} · {PORTFOLIO_CONFIG.exp} XP
            </p>
          </div>

          {/* Stats Grid */}
          <div className="bg-[#110d24]/60 border border-[#241c42] divide-y divide-[#241c42]/80 text-lg font-retro">
            {[
              { label: 'CURRENT GUILD', value: `${PORTFOLIO_CONFIG.company} · SR. SPECIALIST TRAINER` },
              { label: 'FORMER GUILD', value: 'NVIDIA · SOFTWARE QA ENGINEER (SW-GPU)' },
              { label: 'IGN (GAMERTAG)', value: PORTFOLIO_CONFIG.ign },
              { label: 'BASE OF OPERATIONS', value: PORTFOLIO_CONFIG.location },
              { label: 'ALIGNMENT', value: 'LAWFUL ANALYTICAL' },
              { label: 'MISSION', value: 'SIMPLIFY COMPLEXITY' },
              { label: 'STATUS', value: `${PORTFOLIO_CONFIG.status}` },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col sm:flex-row justify-between py-2 px-3 gap-1">
                <span className="text-[#7d7aa3] text-base">{stat.label}</span>
                <b className="font-normal text-white text-right">{stat.value}</b>
              </div>
            ))}
          </div>

          {/* Narrative Prose */}
          <div className="space-y-4 text-slate-300 text-xl font-retro leading-relaxed">
            <p>
              13+ years in technology, 8+ in Ad Operations. One mission: simplify complexity so teams and systems can perform at their peak. I engineer the frameworks behind high-velocity SDR and AdOps teams — QA frameworks, training curricula, audit scorecards, and Root Cause Analysis (RCA) workflows across Google, Reddit & Facebook Ads.
            </p>
            <p>
              I started as a Software QA Engineer at NVIDIA in the SW-GPU department, isolating driver bugs across GeForce, Quadro, Tegra, and SHIELD. That engineering rigor now shapes everything: training programs that are measurable, repeatable, and scalable — and applied AI tooling that is practical, integrated, and production-ready.
            </p>
            <p>
              My AI work goes far beyond simple prompts: I deploy and run local open-weights LLMs via terminal and CLI, write custom chat scripts, and architect knowledge-retention systems on Google NotebookLM that serve as living databases powering colleagues.
            </p>
          </div>

          {/* Specialization Chips */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            {[
              'APPLIED AI & LLM ENGINEERING',
              'QA FRAMEWORKS & RCA',
              'TRAINING & ENABLEMENT',
              'AD OPERATIONS & SHOPPING',
              'LOCAL LLM CLI WORKFLOWS',
            ].map((tag, i) => (
              <span
                key={i}
                className="font-pixel text-[8px] px-3 py-2 bg-[#0a0817] border-2 border-[#241c42] text-[#00e5ff] hover:border-[#00e5ff] transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
