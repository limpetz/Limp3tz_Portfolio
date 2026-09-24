/**
 * LIMP3TZ // Neon Pixel Arcade Portfolio
 * Arshad Mohemed — Senior Specialist Trainer, Ad Operations @ MarketStar · ex-NVIDIA QA
 */

import { useState, useEffect, useCallback } from 'react';
import { PORTFOLIO_CONFIG } from './data/portfolioData';
import { sound } from './utils/soundEngine';
import { Hud } from './components/Hud';
import { BootScreen } from './components/BootScreen';
import { ArcadeStage } from './components/ArcadeStage';
import { CharacterSheet } from './components/CharacterSheet';
import { SkillInventory } from './components/SkillInventory';
import { QuestLog } from './components/QuestLog';
import { ProjectLibrary } from './components/ProjectLibrary';
import { ArcadeContact } from './components/ArcadeContact';
import { ArcadeFooter } from './components/ArcadeFooter';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [score, setScore] = useState(() => {
    const saved = localStorage.getItem('limp3tz_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [coins, setCoins] = useState(() => {
    const saved = localStorage.getItem('limp3tz_coins');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [scorePopping, setScorePopping] = useState(false);

  // Audio toggles (music ON by default)
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  // Active section for navigation
  const [activeSection, setActiveSection] = useState('stage');

  // Official character sprite & background (fixed, no user alteration)
  const spriteUrl = PORTFOLIO_CONFIG.defaultSprite;
  const backgroundUrl = PORTFOLIO_CONFIG.defaultBackground;

  // Clear any legacy custom asset or CRT overrides from local storage
  useEffect(() => {
    localStorage.removeItem('limp3tz_sprite_url');
    localStorage.removeItem('limp3tz_bg_url');
    localStorage.removeItem('limp3tz_procedural_bg');
    localStorage.removeItem('limp3tz_crt');
  }, []);

  // Ensure background music starts on first user interaction if browser policy deferred it
  useEffect(() => {
    const handleFirstInteraction = () => {
      sound.initUserGesture();
      if (musicOn) {
        sound.playMusic();
      }
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [musicOn]);

  // Score & Coin handlers
  const handleAddScore = useCallback((amount: number) => {
    setScore((prev) => {
      const next = Math.min(prev + amount, 999999);
      localStorage.setItem('limp3tz_score', String(next));
      return next;
    });
    setScorePopping(true);
    setTimeout(() => setScorePopping(false), 300);
  }, []);

  const handleAddCoin = useCallback((amount: number) => {
    setCoins((prev) => {
      const next = prev + amount;
      localStorage.setItem('limp3tz_coins', String(next));
      return next;
    });
  }, []);

  // Audio toggles
  const handleToggleMusic = useCallback(() => {
    const nextState = sound.toggleMusic();
    setMusicOn(nextState);
  }, []);

  const handleToggleSfx = useCallback(() => {
    const nextState = sound.toggleSfx();
    setSfxOn(nextState);
  }, []);

  // Scroll spy to highlight active HUD item
  useEffect(() => {
    const sectionIds = ['stage', 'about', 'skills', 'quests', 'projects', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#070512] text-[#efedf7] font-retro relative selection:bg-[#00e5ff] selection:text-[#001016]">
      {/* Boot Screen */}
      {!hasStarted && (
        <BootScreen onStart={() => setHasStarted(true)} />
      )}

      {/* Fixed HUD Navigation Bar */}
      <Hud
        score={score}
        coins={coins}
        scorePopping={scorePopping}
        musicOn={musicOn}
        sfxOn={sfxOn}
        onToggleMusic={handleToggleMusic}
        onToggleSfx={handleToggleSfx}
        activeSection={activeSection}
      />

      <main className="relative pt-[58px]">
        {/* Stage 0: Playable 2D Platformer Minigame */}
        <ArcadeStage
          onAddScore={handleAddScore}
          onAddCoin={handleAddCoin}
          spriteUrl={spriteUrl}
          backgroundUrl={backgroundUrl}
        />

        {/* Level 1: Character Sheet & Lore */}
        <CharacterSheet spriteUrl={spriteUrl} />

        {/* Level 2: Skill Tree & 44-Item Inventory */}
        <SkillInventory onAddScore={handleAddScore} />

        {/* Level 3: Quest Log (Career Timeline) */}
        <QuestLog />

        {/* Level 4: Game Cartridges Library */}
        <ProjectLibrary onAddScore={handleAddScore} />

        {/* Final Level: Continue? / Arcade Comms Terminal */}
        <ArcadeContact onAddScore={handleAddScore} />
      </main>

      {/* Retro Arcade Footer */}
      <ArcadeFooter />

      {/* Floating Retro Controls (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40 hidden sm:flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            sound.playPower();
            handleAddScore(100);
          }}
          className="font-pixel text-[7px] px-2.5 py-1.5 border border-[#ffd23f] text-[#ffd23f] bg-[#0a0817] hover:bg-[#ffd23f] hover:text-black transition-colors cursor-pointer shadow-[0_2px_0_#000]"
          title="Easter egg: Instant 100 points!"
        >
          INSERT COIN
        </button>
      </div>
    </div>
  );
}
