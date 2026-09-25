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
import { ErrorBoundary } from './components/ErrorBoundary';
import { clampScore } from './utils/physics';

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
  const [health, setHealth] = useState<number>(() => {
    const saved = localStorage.getItem('limp3tz_health');
    const parsed = saved ? parseInt(saved, 10) : 4;
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 4 ? parsed : 4;
  });
  const [scorePopping, setScorePopping] = useState(false);

  // Audio toggles (music ON by default)
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  // Active section for navigation
  const [activeSection, setActiveSection] = useState('stage');

  // Official character sprite (fixed, no user alteration)
  const spriteUrl = PORTFOLIO_CONFIG.defaultSprite;

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
    setScore((prev) => clampScore(prev, amount));
    setScorePopping(true);
    setTimeout(() => setScorePopping(false), 300);
  }, []);

  const handleAddCoin = useCallback((amount: number) => {
    setCoins((prev) => prev + amount);
  }, []);

  const handleTakeDamage = useCallback((amount: number = 1) => {
    setHealth((prev) => {
      const next = Math.max(0, prev - amount);
      if (next < prev) {
        sound.playHurt();
      }
      return next;
    });
  }, []);

  const handleHeal = useCallback((amount: number = 1) => {
    setHealth((prev) => {
      const next = Math.min(4, prev + amount);
      if (next > prev) {
        sound.playHeal();
      }
      return next;
    });
  }, []);

  // Persist score & coins whenever they change. This is deliberately kept out
  // of the state updaters: React may invoke an updater more than once
  // (StrictMode, batching), which would double-write to localStorage there.
  useEffect(() => {
    localStorage.setItem('limp3tz_score', String(score));
  }, [score]);

  useEffect(() => {
    localStorage.setItem('limp3tz_coins', String(coins));
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('limp3tz_health', String(health));
  }, [health]);

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
        health={health}
        onTakeDamage={handleTakeDamage}
        onHeal={handleHeal}
        scorePopping={scorePopping}
        musicOn={musicOn}
        sfxOn={sfxOn}
        onToggleMusic={handleToggleMusic}
        onToggleSfx={handleToggleSfx}
        activeSection={activeSection}
      />

      <main className="relative pt-[58px]">
        {/* Stage 0: Playable 2D Platformer Minigame */}
        <ErrorBoundary label="ARCADE STAGE">
          <ArcadeStage
            onAddScore={handleAddScore}
            onAddCoin={handleAddCoin}
            onHeal={handleHeal}
            health={health}
            spriteUrl={spriteUrl}
          />
        </ErrorBoundary>

        {/* Level 1: Character Sheet & Lore */}
        <ErrorBoundary label="CHARACTER SHEET">
          <CharacterSheet
            spriteUrl={spriteUrl}
            health={health}
            onAddScore={handleAddScore}
            onTakeDamage={handleTakeDamage}
            onHeal={handleHeal}
          />
        </ErrorBoundary>

        {/* Level 2: Skill Tree & 44-Item Inventory */}
        <ErrorBoundary label="SKILL INVENTORY">
          <SkillInventory onAddScore={handleAddScore} />
        </ErrorBoundary>

        {/* Level 3: Quest Log (Career Timeline) */}
        <ErrorBoundary label="QUEST LOG">
          <QuestLog />
        </ErrorBoundary>

        {/* Level 4: Game Cartridges Library */}
        <ErrorBoundary label="GAME LIBRARY">
          <ProjectLibrary onAddScore={handleAddScore} />
        </ErrorBoundary>

        {/* Final Level: Continue? / Arcade Comms Terminal */}
        <ErrorBoundary label="COMMS TERMINAL">
          <ArcadeContact onAddScore={handleAddScore} />
        </ErrorBoundary>
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
