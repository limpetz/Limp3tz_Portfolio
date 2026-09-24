import React, { useState } from 'react';
import { PROJECT_CARTRIDGES, ProjectCartridge } from '../data/portfolioData';
import { sound } from '../utils/soundEngine';

interface ProjectLibraryProps {
  onAddScore: (amount: number) => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({ onAddScore }) => {
  const [selectedProject, setSelectedProject] = useState<ProjectCartridge | null>(null);

  const handleOpenModal = (project: ProjectCartridge) => {
    setSelectedProject(project);
    onAddScore(25);
    if (project.id === 'github-activity') {
      sound.playPower();
    } else {
      sound.playBlip(680, 0.08, 0.08);
    }
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
    sound.playBlip(440, 0.04, 0.05);
  };

  return (
    <section id="projects" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto scroll-mt-16">
      {/* Header */}
      <div className="flex items-center gap-4 mb-12 flex-wrap">
        <span className="font-pixel text-xs px-3 py-2 bg-[#0a0817] border-2 border-[#8f6cff] text-[#8f6cff]">
          LEVEL 4
        </span>
        <h2 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
          GAME LIBRARY &amp; CARTRIDGES
        </h2>
        <div className="flex-1 border-t-2 border-dashed border-[#241c42] min-w-[60px]" />
      </div>

      {/* Cartridge Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {PROJECT_CARTRIDGES.map((cartridge, idx) => {
          const isGitHubActivity = cartridge.id === 'github-activity';

          return (
            <article
              key={cartridge.id}
              tabIndex={0}
              role="button"
              onClick={() => handleOpenModal(cartridge)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleOpenModal(cartridge);
                }
              }}
              className={`group relative bg-[#151029] border-2 p-3.5 pb-6 cursor-pointer shadow-[6px_6px_0_#000] hover:-translate-y-2 hover:shadow-[10px_10px_0_#000] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] ${
                isGitHubActivity
                  ? 'border-[#00e5ff]/80 hover:border-[#3dffa2]'
                  : 'border-[#241c42] hover:border-[#ffd23f]/70'
              }`}
            >
              {/* Cartridge Top Grip Ridges */}
              <div className="h-3.5 border-2 border-black mb-3 bg-[repeating-linear-gradient(90deg,#100c20_0_8px,transparent_8px_16px)]" />

              {/* Cartridge Label */}
              <div
                className="border-2 bg-[#0a0817] p-4 flex flex-col min-h-[240px] shadow-[inset_0_0_14px_rgba(0,0,0,0.8)] relative"
                style={{ borderColor: cartridge.color }}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className="font-pixel text-[8px] bg-black px-2 py-1 border self-start"
                    style={{ color: cartridge.color, borderColor: cartridge.color }}
                  >
                    {cartridge.genre}
                  </span>

                  {isGitHubActivity && (
                    <span className="font-pixel text-[7px] bg-[#00ff88]/20 text-[#3dffa2] border border-[#3dffa2] px-1.5 py-0.5">
                      LIVE IN L1
                    </span>
                  )}
                </div>

                <h3
                  className="font-pixel text-xs text-white mb-2 leading-tight"
                  style={{ textShadow: `0 0 8px ${cartridge.color}` }}
                >
                  {cartridge.title}
                </h3>

                <p className="font-retro text-lg text-slate-300 line-clamp-3 mb-4">
                  {cartridge.desc}
                </p>

                {/* Pixel Art Mini Cartridge Graphic */}
                <div
                  className="mt-auto h-14 border-2 border-black relative overflow-hidden flex items-center justify-center shadow-inner"
                  style={{
                    background: isGitHubActivity
                      ? 'linear-gradient(135deg, #051a24 0%, #00e5ff44 50%, #3dffa2 100%)'
                      : `linear-gradient(135deg, #0a0817 0%, ${cartridge.color}35 50%, ${cartridge.color} 100%)`,
                  }}
                >
                  <span className="font-pixel text-[8px] text-black bg-white/90 px-2 py-0.5 border border-black">
                    {isGitHubActivity ? 'CART #2' : `CART #${idx + 1}`}
                  </span>
                </div>
              </div>

              {/* Hover Insert Button */}
              <div className="absolute left-1/2 bottom-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <span className="font-pixel text-[8px] bg-[#3dffa2] text-[#001016] px-3 py-1.5 border-2 border-black font-bold whitespace-nowrap">
                  PLAY / INSPECT &gt;
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Cartridge Modal */}
      {selectedProject && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleCloseModal}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-[#110d24] border-2 p-5 sm:p-7 relative max-h-[92vh] overflow-y-auto ${
              selectedProject.id === 'github-activity' ? 'max-w-4xl' : 'max-w-2xl'
            }`}
            style={{
              borderColor: selectedProject.color,
              boxShadow: `0 0 35px ${selectedProject.color}40, 12px 12px 0 #000`,
            }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#241c42] pb-4 mb-4">
              <div>
                <span
                  className="font-pixel text-[8px] px-2 py-1 border bg-black mb-2 inline-block"
                  style={{
                    color: selectedProject.color,
                    borderColor: selectedProject.color,
                  }}
                >
                  {selectedProject.genre}
                </span>
                <h3 className="font-pixel text-base sm:text-lg text-white">
                  {selectedProject.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-9 h-9 bg-[#0a0817] border-2 border-[#ff2d78] text-[#ff2d78] hover:bg-[#ff2d78] hover:text-black font-pixel text-sm flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* GitHub Activity now lives live in the L1 character card; its
                cartridge shows the standard overview instead of a duplicate. */}
            <div className="py-4 space-y-4 font-retro text-xl text-slate-300 leading-relaxed">              <p>{selectedProject.fullOverview}</p>

              <div>
                <p className="font-pixel text-[9px] text-[#ffd23f] mb-2">
                  KEY CAPABILITIES &amp; HIGHLIGHTS:
                </p>
                <ul className="space-y-1.5">
                  {selectedProject.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-white">
                      <span className="text-[#3dffa2] font-pixel text-[9px]">★</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech Badges */}
              <div className="pt-2">
                <p className="font-pixel text-[8px] text-[#7d7aa3] mb-2">TECH ARSENAL:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.tech.map((t, i) => (
                    <span
                      key={i}
                      className="font-pixel text-[8px] px-2.5 py-1.5 bg-[#0a0817] border border-[#241c42] text-[#00e5ff]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

                {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#241c42] pt-4 mt-6">
                <a
                  href={selectedProject.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto font-pixel text-xs px-6 py-3 bg-[#0a0817] border-2 transition-colors shadow-[0_4px_0_#000] text-center"
                  style={{
                    borderColor: selectedProject.color,
                    color: selectedProject.color,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = selectedProject.color;
                    e.currentTarget.style.color = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0a0817';
                    e.currentTarget.style.color = selectedProject.color;
                  }}
                >
                  VIEW ON GITHUB &gt;
                </a>                <span className="font-pixel text-[8px] text-[#7d7aa3]">
                  PRESS ESC OR CLICK OUTSIDE TO CLOSE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
