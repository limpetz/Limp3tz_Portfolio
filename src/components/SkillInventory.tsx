import React, { useState } from 'react';
import { CORE_SKILL_TREE, INVENTORY_SKILLS, SKILL_CATEGORIES } from '../data/portfolioData';
import { sound } from '../utils/soundEngine';

interface SkillInventoryProps {
  onAddScore: (amount: number) => void;
}

export const SkillInventory: React.FC<SkillInventoryProps> = ({ onAddScore }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [inspectedSkills, setInspectedSkills] = useState<Set<string>>(new Set());
  const [trophyUnlocked, setTrophyUnlocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const totalSkills = INVENTORY_SKILLS.length;

  const handleInspect = (skillName: string) => {
    if (inspectedSkills.has(skillName)) {
      sound.playBlip(320, 0.04, 0.04);
      return;
    }

    const nextSet = new Set(inspectedSkills);
    nextSet.add(skillName);
    setInspectedSkills(nextSet);

    onAddScore(5);
    sound.playInspect();

    if (nextSet.size === totalSkills && !trophyUnlocked) {
      setTrophyUnlocked(true);
      onAddScore(500);
      sound.playTrophy();
    }
  };

  const filteredSkills = INVENTORY_SKILLS.filter((s) => {
    const matchesCat = activeCategory === 'all' || s.category === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <section id="skills" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto scroll-mt-16 bg-[#090714]/70 border-y-2 border-[#00e5ff]/30">
      {/* Level Header */}
      <div className="flex items-center gap-4 mb-10 flex-wrap">
        <span className="font-pixel text-xs px-3 py-2 bg-[#0a0817] border-2 border-[#00e5ff] text-[#00e5ff] shadow-[4px_4px_0_#000]">
          LEVEL 2
        </span>
        <h2 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
          SKILL TREE &amp; INVENTORY
        </h2>
        <div className="flex-1 border-t-2 border-dashed border-[#241c42] min-w-[60px]" />
      </div>

      {/* Top 10 Equipped Loadout Skill Bars */}
      <div className="mb-16">
        <p className="font-pixel text-[10px] text-[#ffd23f] mb-6 tracking-wider">
          PRIMARY LOADOUT // POWER RATINGS
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
          {CORE_SKILL_TREE.map((skill, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr_45px] sm:grid-cols-[180px_1fr_50px] items-center gap-3 font-pixel text-[8px] sm:text-[9px]"
            >
              <span className="text-slate-300 truncate" title={skill.name}>
                {skill.name}
              </span>
              <div className="h-4 bg-[#0a0817] border-2 border-[#241c42] relative overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 relative"
                  style={{
                    width: `${skill.level}%`,
                    backgroundColor: skill.color,
                    boxShadow: `0 0 10px ${skill.color}`,
                  }}
                >
                  {/* Subtle diagonal scanlines over progress bar */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.25)_0_4px,transparent_4px_8px)]" />
                </div>
              </div>
              <span className="text-[#7d7aa3] text-right font-mono tabular-nums">
                {skill.level}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 44-Skill Comprehensive Inventory */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-t-2 border-dashed border-[#241c42] pt-8">
          <div>
            <span className="font-pixel text-xs text-[#ffd23f] tracking-wide">
              FULL INVENTORY (SKILLS.CSV)
            </span>
            <div className="flex items-center gap-3 mt-1 font-pixel text-[9px]">
              <span className="text-[#3dffa2]">{totalSkills} REPERTOIRE NODES</span>
              <span className="text-[#7d7aa3]">·</span>
              <span className="text-[#ffd23f]">
                {inspectedSkills.size}/{totalSkills} INSPECTED
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="SEARCH INVENTORY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0817] border-2 border-[#241c42] focus:border-[#00e5ff] text-[#efedf7] font-retro text-lg px-3 py-1 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              sound.playBlip(520, 0.03, 0.05);
              setActiveCategory('all');
            }}
            className={`font-pixel text-[8px] px-3 py-2 border-2 cursor-pointer transition-all ${
              activeCategory === 'all'
                ? 'border-white text-white bg-[#0a0817] shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'border-[#241c42] text-[#7d7aa3] bg-[#0a0817] hover:text-white'
            }`}
          >
            ALL ×{totalSkills}
          </button>

          {Object.entries(SKILL_CATEGORIES).map(([catKey, cat]) => {
            const count = INVENTORY_SKILLS.filter((s) => s.category === catKey).length;
            const isActive = activeCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => {
                  sound.playBlip(520, 0.03, 0.05);
                  setActiveCategory(catKey);
                }}
                className={`font-pixel text-[8px] px-3 py-2 border-2 cursor-pointer transition-all ${
                  isActive
                    ? 'border-current bg-[#0a0817] shadow-[0_0_12px_-2px_currentColor]'
                    : 'border-[#241c42] text-[#7d7aa3] bg-[#0a0817] hover:text-white'
                }`}
                style={isActive ? { color: cat.color } : {}}
              >
                {cat.tab} ×{count}
              </button>
            );
          })}
        </div>

        {/* Category Description Banner */}
        {activeCategory !== 'all' && (
          <p className="font-retro text-base text-[#7d7aa3] mb-4">
            CATEGORY FOCUS: <span className="text-white">{SKILL_CATEGORIES[activeCategory]?.desc}</span>
          </p>
        )}

        {/* Interactive Skills Grid */}
        <div className="flex flex-wrap gap-2.5 min-h-[120px]">
          {filteredSkills.map((skill) => {
            const isSeen = inspectedSkills.has(skill.name);
            const catColor = SKILL_CATEGORIES[skill.category]?.color || '#00e5ff';
            return (
              <button
                key={skill.name}
                type="button"
                onClick={() => handleInspect(skill.name)}
                className={`font-pixel text-[8px] px-3 py-2 border-2 cursor-pointer transition-all flex items-center gap-1.5 active:translate-y-0.5 ${
                  isSeen
                    ? 'bg-current text-[#05030f] border-black shadow-none'
                    : 'bg-[#0a0817] hover:-translate-y-0.5'
                }`}
                style={{
                  color: isSeen ? '#05030f' : catColor,
                  borderColor: isSeen ? '#000' : catColor,
                  backgroundColor: isSeen ? catColor : '#0a0817',
                  boxShadow: isSeen ? 'none' : undefined,
                }}
                title={`Click to inspect (+5 XP) · Category: ${SKILL_CATEGORIES[skill.category]?.label}`}
              >
                {skill.rare && <span className="text-[#ffd23f]">★</span>}
                {isSeen && <span className="font-bold">✓</span>}
                <span>{skill.name.toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Completionist Trophy Alert */}
        {trophyUnlocked && (
          <div className="mt-8 p-4 bg-[#0a0817] border-2 border-[#ffd23f] text-[#ffd23f] font-pixel text-xs shadow-[0_0_20px_rgba(255,210,63,0.3)] animate-bounce flex items-center justify-between">
            <span>🏆 TROPHY UNLOCKED: COMPLETIONIST // ALL 44 SKILLS INSPECTED!</span>
            <span className="text-[#3dffa2]">+500 PTS BONUS</span>
          </div>
        )}
      </div>
    </section>
  );
};
