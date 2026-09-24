import React from 'react';
import { QUESTS_DATA, QuestItem } from '../data/portfolioData';

export const QuestLog: React.FC = () => {
  const getTagColor = (type: QuestItem['type']) => {
    switch (type) {
      case 'main':
        return 'text-[#ff2d78] border-[#ff2d78] shadow-[0_0_8px_rgba(255,45,120,0.5)]';
      case 'ai':
        return 'text-[#3dffa2] border-[#3dffa2] shadow-[0_0_8px_rgba(61,255,162,0.5)]';
      case 'side':
        return 'text-[#00e5ff] border-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.5)]';
      case 'tut':
        return 'text-[#ffd23f] border-[#ffd23f] shadow-[0_0_8px_rgba(255,210,63,0.5)]';
      default:
        return 'text-[#7d7aa3] border-[#7d7aa3]';
    }
  };

  return (
    <section id="quests" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto scroll-mt-16">
      {/* Header */}
      <div className="flex items-center gap-4 mb-12 flex-wrap">
        <span className="font-pixel text-xs px-3 py-2 bg-[#0a0817] border-2 border-[#ff2d78] text-[#ff2d78]">
          LEVEL 3
        </span>
        <h2 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
          QUEST LOG (CAREER TIMELINE)
        </h2>
        <div className="flex-1 border-t-2 border-dashed border-[#241c42] min-w-[60px]" />
      </div>

      {/* Quest Timeline */}
      <div className="relative space-y-8 before:absolute before:left-4 md:before:left-[210px] before:top-4 before:bottom-4 before:w-0.5 before:bg-[repeating-linear-gradient(to_bottom,#241c42_0_10px,transparent_10px_20px)]">
        {QUESTS_DATA.map((quest, index) => (
          <article
            key={index}
            className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-4 md:gap-10 relative pl-8 md:pl-0"
          >
            {/* Timeline Period */}
            <div className="md:text-right pt-2 md:pr-8">
              <span className="font-retro text-lg text-[#ffd23f] md:text-[#7d7aa3] block tracking-wide whitespace-nowrap">
                {quest.period}
              </span>
            </div>

            {/* Glowing Quest Dot */}
            <span
              className="absolute left-[9px] md:left-[203px] top-4 w-3.5 h-3.5 bg-[#ff2d78] border-2 border-black z-10 shadow-[0_0_10px_rgba(255,45,120,0.8)]"
              style={{
                backgroundColor:
                  quest.type === 'ai'
                    ? '#3dffa2'
                    : quest.type === 'side'
                    ? '#00e5ff'
                    : quest.type === 'tut'
                    ? '#ffd23f'
                    : '#ff2d78',
              }}
            />

            {/* Quest Card */}
            <div className="bg-[#110d24] border-2 border-[#241c42] p-6 shadow-[6px_6px_0_#000] hover:border-[#00e5ff] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[9px_9px_0_#000] transition-all">
              <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                <span className={`font-pixel text-[8px] px-2.5 py-1 border-2 bg-[#0a0817] ${getTagColor(quest.type)}`}>
                  {quest.tag}
                </span>
                <span className="font-retro text-xl text-[#ffd23f]">
                  {quest.org}
                </span>
              </div>

              <h3 className="font-pixel text-xs sm:text-sm text-white mb-2 leading-relaxed">
                {quest.title}
              </h3>

              <p className="text-slate-300 font-retro text-xl leading-relaxed mb-4">
                {quest.desc}
              </p>

              {/* Unlocked Rewards List */}
              <div className="border-t border-[#241c42]/80 pt-3">
                <p className="font-pixel text-[8px] text-[#7d7aa3] mb-2">UNLOCKED REWARDS / CAPABILITIES:</p>
                <ul className="space-y-1">
                  {quest.rewards.map((reward, rIndex) => (
                    <li
                      key={rIndex}
                      className="font-retro text-lg text-[#efedf7] flex items-center gap-2"
                    >
                      <span className="text-[#3dffa2] font-pixel text-[9px]">+</span>
                      <span>{reward}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
