import React, { useState, useEffect } from 'react';
import { CONTACT_LINKS, PORTFOLIO_CONFIG } from '../data/portfolioData';
import { sound } from '../utils/soundEngine';

interface ArcadeContactProps {
  onAddScore: (amount: number) => void;
}

export const ArcadeContact: React.FC<ArcadeContactProps> = ({ onAddScore }) => {
  const [countdown, setCountdown] = useState(9);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('AdOps Enablement & Training');

  // Arcade countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          sound.playBlip(220, 0.1, 0.05);
          return 9;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const resetTimer = () => {
    setCountdown(9);
    sound.playCoin();
    onAddScore(50);
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    sound.playBlip(540, 0.03, 0.05);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playPower();
    onAddScore(250);

    const subject = encodeURIComponent(`PORTFOLIO QUEST: [${selectedTopic}] from ${name || 'Operator'}`);
    const body = encodeURIComponent(
      `Hello LIMP3TZ,\n\nTopic: ${selectedTopic}\nSender: ${name}\n\nMessage:\n${message}\n\n— Sent from Limp3tz Arcade Terminal`
    );

    window.location.href = `mailto:${PORTFOLIO_CONFIG.email}?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="py-24 px-4 sm:px-8 max-w-4xl mx-auto scroll-mt-16 text-center">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10 justify-center">
        <span className="font-pixel text-xs px-3 py-2 bg-[#0a0817] border-2 border-[#3dffa2] text-[#3dffa2]">
          FINAL LEVEL
        </span>
        <h2 className="font-pixel text-xl sm:text-2xl text-white tracking-wide">
          CONTINUE?
        </h2>
      </div>

      {/* Retro Countdown */}
      <div className="my-8">
        <div
          role="button"
          tabIndex={0}
          onClick={resetTimer}
          onMouseEnter={resetTimer}
          className="inline-block cursor-pointer group"
          title="Click to reset timer and add score!"
        >
          <p className="font-retro text-7xl sm:text-9xl text-[#ff2d78] animate-glitch select-none tracking-widest leading-none">
            CONTINUE? <span className="text-[#ffd23f]">{countdown}</span>
          </p>
          <p className="font-pixel text-[9px] text-[#00e5ff] mt-2 group-hover:text-[#3dffa2] transition-colors">
            [ CLICK TIMER TO INSERT COIN &amp; RESET ]
          </p>
        </div>
      </div>

      <p className="font-pixel text-xs text-[#00e5ff] tracking-widest mb-8 animate-pulse">
        INSERT COIN TO CONNECT WITH LIMP3TZ
      </p>

      {/* Main Action Links — pixel-art contact icons, one per channel. The
          accent colour is passed as a CSS variable so the border, label and
          hover fill all stay in sync per link without five duplicated blocks. */}
      <ul className="flex flex-wrap gap-3 sm:gap-4 justify-center mb-8 list-none">
        {CONTACT_LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              aria-label={link.ariaLabel}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => (link.id === 'email' ? sound.playPower() : sound.playCoin())}
              style={{ '--accent': link.color } as React.CSSProperties}
              className="group flex w-20 sm:w-24 flex-col items-center gap-2 px-2 py-3 bg-[#0a0817] border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#001016] transition-all shadow-[0_5px_0_#000] active:translate-y-1 active:shadow-none"
            >
              <img
                src={link.icon}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="w-10 h-10 sm:w-12 sm:h-12 select-none [image-rendering:pixelated] transition-transform duration-100 group-hover:scale-110"
              />
              <span className="font-pixel text-[8px] tracking-wide">{link.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="font-retro text-xl text-[#7d7aa3] mb-8">
        Direct Email Transmission: <span className="text-[#00e5ff]">{PORTFOLIO_CONFIG.email}</span>
      </p>

      {/* Transmission Terminal Form */}
      <div className="bg-[#110d24] border-2 border-[#241c42] p-6 sm:p-8 text-left shadow-[8px_8px_0_#000] max-w-2xl mx-auto">
        <h3 className="font-pixel text-xs text-[#ffd23f] mb-4">
          ARCADE COMMS TERMINAL // QUICK DISPATCH
        </h3>

        {/* Preset Topic Selection */}
        <div className="mb-6">
          <p className="font-pixel text-[8px] text-[#7d7aa3] mb-2">SELECT QUEST OBJECTIVE:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'AdOps Enablement & Training',
              'Applied AI & LLM Systems',
              'QA Frameworks / RCA',
              'Speaking & Consulting',
            ].map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => handleTopicSelect(topic)}
                className={`font-pixel text-[8px] px-3 py-1.5 border-2 transition-all cursor-pointer ${
                  selectedTopic === topic
                    ? 'border-[#3dffa2] bg-[#3dffa2]/10 text-[#3dffa2] shadow-[0_0_8px_rgba(61,255,162,0.4)]'
                    : 'border-[#241c42] bg-[#0a0817] text-[#7d7aa3] hover:text-white'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-pixel text-[8px] text-[#7d7aa3] mb-1">
              YOUR NAME / COGNOMEN:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elena Vance"
              className="w-full bg-[#0a0817] border-2 border-[#241c42] focus:border-[#00e5ff] text-white font-retro text-xl px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="block font-pixel text-[8px] text-[#7d7aa3] mb-1">
              MESSAGE TRANSMISSION:
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Let's build high-impact AdOps training systems, deploy local LLM automation, or review campaign QA frameworks..."
              className="w-full bg-[#0a0817] border-2 border-[#241c42] focus:border-[#00e5ff] text-white font-retro text-xl px-3 py-2 outline-none resize-y"
            />
          </div>

          <button
            type="submit"
            className="w-full font-pixel text-xs py-4 bg-[#0a0817] border-2 border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-[#001016] transition-colors cursor-pointer shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none"
          >
            TRANSMIT QUEST PROPOSAL &gt;
          </button>
        </form>

        <p className="font-retro text-base text-[#7d7aa3] mt-3 text-center">
          * Opens your local email client with your message cleanly encoded
        </p>
      </div>
    </section>
  );
};
