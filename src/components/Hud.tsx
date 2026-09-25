import React, { useState } from 'react';
import { sound } from '../utils/soundEngine';
import { PixelHeart } from './PixelHeart';

/** Short display version (e.g. "v1.1.0"); full identity lives in the tooltip.
 *  Handles all describe shapes: "v1.1.0-6-gsha", "auto/v1.1.2+sha", bare sha. */
const BUILD_SHORT = __APP_VERSION__.replace(/^[^/]*\//, '').split(/[+-]/)[0];
const BUILD_TOOLTIP = `BUILD ${__APP_VERSION__} · ${__BUILD_DATE__} · ${__BUILD_SHA__.toUpperCase()}`;
/** GitHub commit page for the exact build, opened by the version chip. */
const COMMIT_URL = `https://github.com/limpetz/Limp3tz_Portfolio/commit/${__BUILD_SHA__}`;

interface HudProps {
  score: number;
  highScore: number;
  coins: number;
  health: number;
  onTakeDamage?: (amount?: number) => void;
  onHeal?: (amount?: number) => void;
  scorePopping: boolean;
  musicOn: boolean;
  sfxOn: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  activeSection: string;
}

export const Hud: React.FC<HudProps> = ({
  score,
  highScore,
  coins,
  health,
  onTakeDamage,
  onHeal,
  scorePopping,
  musicOn,
  sfxOn,
  onToggleMusic,
  onToggleSfx,
  activeSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'stage', label: 'STAGE' },
    { id: 'about', label: 'L1 ABOUT' },
    { id: 'skills', label: 'L2 SKILLS' },
    { id: 'quests', label: 'L3 QUESTS' },
    { id: 'projects', label: 'L4 CARTS' },
    { id: 'contact', label: 'L5 CONTACT' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[58px] bg-[#070512]/95 border-b-2 border-[#00e5ff] font-pixel text-[9px] text-white flex items-center px-4 gap-4 backdrop-blur-sm">
      {/* Lives & P1 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="flex items-center gap-1.5 bg-[#110d24]/90 px-2 py-1 border border-[#ff2d78]/40 shadow-[0_0_8px_rgba(255,45,120,0.3)] select-none"
          aria-label={`Health: ${health} of 4 hearts`}
        >
          <button
            type="button"
            onClick={() => {
              if (health > 0 && onTakeDamage) onTakeDamage(1);
            }}
            title="Click HP to test damage (-1 heart)"
            className="text-[#ff2d78] font-bold text-[8px] mr-0.5 cursor-pointer hover:brightness-125 transition-transform active:scale-90"
          >
            HP
          </button>
          <div className="flex gap-1 items-center">
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
                  className="cursor-pointer hover:scale-125 transition-transform"
                  title={isFilled ? `Heart ${i + 1} (Click to take damage)` : `Heart ${i + 1} empty (Click to heal)`}
                >
                  <PixelHeart
                    size={13}
                    delay={i * 0.15}
                    filled={isFilled}
                  />
                </button>
              );
            })}
          </div>
          {/* Micro health meter on sm screens */}
          <div className="hidden sm:block w-9 h-1.5 bg-[#0a0817] border border-[#ff2d78]/40 overflow-hidden ml-1">
            <div
              className="h-full bg-gradient-to-r from-[#ff2d78] via-[#ff5c98] to-[#3dffa2] transition-all duration-300"
              style={{ width: `${(health / 4) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-[#ffd23f] tracking-wider hidden sm:inline-block">P1: ARSHAD</span>
        {/* Build badge: matches the boot-screen stamp, so a stale deploy is
            visible without leaving the game. Click opens the exact commit on
            GitHub; hover shows full build identity. */}
        <a
          href={COMMIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-block text-[8px] text-[#7d7aa3]/60 tracking-wider hover:text-[#00e5ff] transition-colors"
          title={BUILD_TOOLTIP}
        >
          {BUILD_SHORT}
        </a>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-4 mx-auto text-slate-300">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => sound.playBlip(750, 0.03, 0.05)}
              className={`py-1 px-1 border-b-2 transition-colors ${
                isActive
                  ? 'text-[#3dffa2] border-[#3dffa2]'
                  : 'text-slate-300 border-transparent hover:text-[#00e5ff] hover:border-[#00e5ff]'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Right HUD Zone: Score, Coins, Audio, Assets, Menu */}
      <div className="flex items-center gap-3 ml-auto shrink-0">
        {/* High Score Banner */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 border border-[#ffd23f]/30 bg-[#ffd23f]/5">
          <span className="text-[#ffd23f] text-[8px] font-bold">HI</span>
          <span className="text-[#ffd23f] tabular-nums text-[8px]">{String(highScore).padStart(6, '0')}</span>
        </div>

        {/* Score */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-[#7d7aa3]">SCORE</span>
          <b
            className={`text-[#3dffa2] font-normal tabular-nums transition-transform duration-150 inline-block ${
              scorePopping ? 'scale-125 text-[#ffd23f]' : ''
            }`}
          >
            {String(score).padStart(6, '0')}
          </b>
        </div>

        {/* Coins */}
        <div className="flex items-center gap-1.5 text-[#ffd23f]">
          <span className="w-3.5 h-3.5 bg-[#ffd23f] border-2 border-[#5a3d00] block" />
          <span className="tabular-nums">x{String(coins).padStart(2, '0')}</span>
        </div>

        {/* SFX Toggle — flat neon: solid border, opaque fill, glow only when ON */}
        <button
          type="button"
          onClick={onToggleSfx}
          aria-pressed={sfxOn}
          className={`px-2 py-1 border-2 transition-colors font-pixel text-[8px] cursor-pointer ${
            sfxOn
              ? 'border-[#3dffa2] text-[#3dffa2] bg-[#0a0817]'
              : 'border-[#241c42] text-[#7d7aa3] bg-[#0a0817]'
          }`}
          title="Toggle 8-bit sound effects"
        >
          SFX {sfxOn ? 'ON' : 'OFF'}
        </button>

        {/* Music Toggle */}
        <button
          type="button"
          onClick={onToggleMusic}
          aria-pressed={musicOn}
          className={`hidden md:block px-2 py-1 border-2 transition-colors font-pixel text-[8px] cursor-pointer ${
            musicOn
              ? 'border-[#00e5ff] text-[#00e5ff] bg-[#0a0817]'
              : 'border-[#241c42] text-[#7d7aa3] bg-[#0a0817]'
          }`}
          title="Toggle synthesized chiptune music"
        >
          BGM {musicOn ? 'ON' : 'OFF'}
        </button>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => {
            sound.playBlip(600, 0.03, 0.05);
            setMobileMenuOpen(!mobileMenuOpen);
          }}
          className="lg:hidden px-2 py-1 border-2 border-[#241c42] text-[#00e5ff] hover:border-[#00e5ff] bg-[#0a0817] text-xs font-pixel"
          aria-label="Toggle navigation menu"
        >
          ≡
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-[58px] left-0 right-0 bg-[#070512]/98 border-b-2 border-[#00e5ff] flex flex-col p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-[#241c42] flex justify-between items-center text-[#ffd23f]">
            <span>SCORE: {String(score).padStart(6, '0')}</span>
            <span>COINS: x{String(coins).padStart(2, '0')}</span>
          </div>
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => {
                sound.playBlip(750, 0.03, 0.05);
                setMobileMenuOpen(false);
              }}
              className={`px-4 py-3 border-b border-[#241c42]/60 hover:text-[#00e5ff] ${
                activeSection === item.id ? 'text-[#3dffa2] bg-[#3dffa2]/10' : 'text-slate-300'
              }`}
            >
              {item.label}
            </a>
          ))}
          <div className="p-3 flex justify-between items-center">
            <button
              type="button"
              onClick={onToggleMusic}
              className={`px-3 py-1.5 border text-[9px] ${
                musicOn ? 'border-[#00e5ff] text-[#00e5ff]' : 'border-[#241c42] text-slate-400'
              }`}
            >
              MUSIC: {musicOn ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={onToggleSfx}
              className={`px-3 py-1.5 border text-[9px] ${
                sfxOn ? 'border-[#3dffa2] text-[#3dffa2]' : 'border-[#241c42] text-slate-400'
              }`}
            >
              SFX: {sfxOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
