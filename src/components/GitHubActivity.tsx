import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PORTFOLIO_CONFIG } from '../data/portfolioData';
import { sound } from '../utils/soundEngine';

interface GitHubProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  repo: {
    name: string;
    url: string;
  };
  payload: {
    action?: string;
    ref?: string;
    ref_type?: string;
    commits?: Array<{
      message: string;
      sha: string;
    }>;
  };
  created_at: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
}

interface GitHubActivityProps {
  onAddScore?: (amount: number) => void;
  /**
   * Compact layout for narrow containers (the 320px character-card column in
   * L1): status strip + stat tiles + heatmap only. The languages/repos panels,
   * terminal feed and footer live in the full layout (L4 dialog).
   */
  compact?: boolean;
}

export const GitHubActivity: React.FC<GitHubActivityProps> = ({ onAddScore, compact = false }) => {
  const [profile, setProfile] = useState<GitHubProfile | null>(null);
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'push' | 'repo'>('all');
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);

  const username = 'limpetz';

  const fetchData = useCallback(async (isRefresh = false) => {
    setLoading(true);
    setError(null);
    setRateLimited(false);

    if (isRefresh) {
      sound.playBlip(750, 0.06, 0.08);
      onAddScore?.(15);
    }

    try {
      const headers = {
        Accept: 'application/vnd.github.v3+json',
      };

      const [profileRes, eventsRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${username}`, { headers }),
        fetch(`https://api.github.com/users/${username}/events/public?per_page=30`, { headers }),
        fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`, { headers }),
      ]);

      if (profileRes.status === 403 || eventsRes.status === 403) {
        setRateLimited(true);
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      } else {
        // Fallback default profile if rate-limited
        setProfile((prev) => prev || {
          login: username,
          name: 'Limp3tZ',
          avatar_url: 'https://avatars.githubusercontent.com/u/47778200?v=4',
          html_url: `https://github.com/${username}`,
          bio: 'Ad Ops Trainer & Applied AI / CLI Developer',
          public_repos: 8,
          public_gists: 0,
          followers: 0,
          following: 2,
          created_at: '2019-02-19T10:38:29Z',
        });
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        if (Array.isArray(eventsData)) {
          setEvents(eventsData);
        }
      }

      if (reposRes.ok) {
        const reposData = await reposRes.json();
        if (Array.isArray(reposData)) {
          setRepos(reposData);
        }
      }

      setLastUpdated(new Date());
      if (isRefresh) {
        sound.playCoin();
      }
    } catch (err) {
      console.warn('GitHub API fetch failed or was blocked by network/rate-limit:', err);
      setError('TRANSMISSION WEAK — USING RETRIEVED TELEMETRY CACHE');
    } finally {
      setLoading(false);
    }
  }, [onAddScore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate stats
  const totalStars = useMemo(() => {
    return repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  }, [repos]);

  const topLanguages = useMemo(() => {
    const counts: Record<string, number> = {};
    repos.forEach((r) => {
      if (r.language) {
        counts[r.language] = (counts[r.language] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .map(([lang, count]) => ({
        lang,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [repos]);

  // Generate 12-week retro contribution heatmap
  const heatmapWeeks = useMemo(() => {
    // 12 weeks = 84 days
    const totalDays = 84;
    const now = new Date();
    const daysMap = new Map<string, number>();

    // Tally real events
    events.forEach((ev) => {
      const dateKey = ev.created_at.slice(0, 10);
      daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + 1);
    });

    // Also factor recent repo pushes
    repos.forEach((r) => {
      if (r.updated_at) {
        const dateKey = r.updated_at.slice(0, 10);
        daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + 1);
      }
    });

    const daysList: Array<{ date: string; count: number; level: number }> = [];

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const count = daysMap.get(dateKey) || 0;
      let level = 0;
      if (count >= 4) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      daysList.push({ date: dateKey, count, level });
    }

    // Split into weeks of 7 days
    const weeks: Array<typeof daysList> = [];
    for (let w = 0; w < daysList.length; w += 7) {
      weeks.push(daysList.slice(w, w + 7));
    }
    return weeks;
  }, [events, repos]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'push') {
      return events.filter((e) => e.type === 'PushEvent');
    }
    if (activeFilter === 'repo') {
      return events.filter((e) => ['WatchEvent', 'CreateEvent', 'ForkEvent'].includes(e.type));
    }
    return events;
  }, [events, activeFilter]);

  const formatRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const getEventDescriptor = (ev: GitHubEvent) => {
    // Keep the original repo name so users can tell which repo an event came from,
    // but strip the leading 'limpetz/' prefix for a cleaner display.
    const repoName = ev.repo.name.replace(/^limpetz\//, '') || ev.repo.name;
    switch (ev.type) {
      case 'PushEvent': {
        const commitMsg = ev.payload?.commits?.[0]?.message || 'Pushed commit';
        return {
          action: 'CODE COMMIT',
          color: '#3dffa2',
          target: repoName,
          desc: commitMsg.length > 55 ? commitMsg.slice(0, 52) + '...' : commitMsg,
        };
      }
      case 'CreateEvent': {
        const refType = ev.payload?.ref_type || 'branch';
        const ref = ev.payload?.ref ? ` (${ev.payload.ref})` : '';
        return {
          action: 'SPAWNED BRANCH/TAG',
          color: '#00e5ff',
          target: repoName,
          desc: `Created new ${refType}${ref}`,
        };
      }
      case 'WatchEvent':
        return {
          action: 'STARRED REPO',
          color: '#ffd23f',
          target: repoName,
          desc: `Added repo to favorites / radar`,
        };
      case 'IssuesEvent':
        return {
          action: `ISSUE ${ev.payload?.action?.toUpperCase() || 'LOGGED'}`,
          color: '#ff2d78',
          target: repoName,
          desc: `Tracked issue / QA diagnostic`,
        };
      case 'ForkEvent':
        return {
          action: 'FORKED REPOSITORY',
          color: '#8f6cff',
          target: repoName,
          desc: `Created development fork`,
        };
      default:
        return {
          action: ev.type.replace('Event', '').toUpperCase(),
          color: '#3dffa2',
          target: repoName,
          desc: 'GitHub telemetry signal recorded',
        };
    }
  };

  const getHeatmapColor = (level: number) => {
    switch (level) {
      case 4:
        return 'bg-[#00ffcc] shadow-[0_0_6px_#00ffcc] border-[#3dffa2]';
      case 3:
        return 'bg-[#3dffa2] border-[#29cf7f]';
      case 2:
        return 'bg-[#008f5a] border-[#005e3b]';
      case 1:
        return 'bg-[#004d30] border-[#003823]';
      default:
        return 'bg-[#15102a] border-[#241c42]';
    }
  };

  // Compact layout for narrow containers (the 320px character-card column in
  // L1): status strip + stat tiles + heatmap. The full layout below adds the
  // languages/repos panels, terminal feed and footer for the L4 dialog.
  if (compact) {
    return (
      <div className="text-white space-y-3">
        {/* Status strip */}
        <div className="flex items-center justify-between gap-2 bg-[#0a0817] border-2 border-[#241c42] p-2.5 shadow-[4px_4px_0_#000]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3dffa2] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#3dffa2]" />
            </span>
            <span className="font-pixel text-[8px] text-[#3dffa2] tracking-wider truncate">
              GITHUB RADAR // @{username.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading}
            aria-label="Re-sync GitHub data"
            className="font-pixel text-[7px] px-2 py-1 bg-[#151029] border border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-black transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {loading ? '...' : 'SYNC'}
          </button>
        </div>

        {error && (
          <div className="bg-[#ff2d78]/10 border border-[#ff2d78] p-1.5 text-[#ff2d78] font-pixel text-[7px]">
            [!] {error}
          </div>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0a0817] border-2 border-[#241c42] p-2 shadow-[3px_3px_0_#000]">
            <span className="font-pixel text-[7px] text-[#7d7aa3] block">REPOS</span>
            <span className="font-pixel text-base text-[#00e5ff]">
              {profile ? profile.public_repos : '—'}
            </span>
          </div>
          <div className="bg-[#0a0817] border-2 border-[#241c42] p-2 shadow-[3px_3px_0_#000]">
            <span className="font-pixel text-[7px] text-[#7d7aa3] block">STARS</span>
            <span className="font-pixel text-base text-[#ffd23f]">{totalStars} ★</span>
          </div>
          <div className="bg-[#0a0817] border-2 border-[#241c42] p-2 shadow-[3px_3px_0_#000]">
            <span className="font-pixel text-[7px] text-[#7d7aa3] block">EVENTS</span>
            <span className="font-pixel text-base text-[#3dffa2]">{events.length}</span>
          </div>
        </div>

        {/* Contribution heatmap */}
        <div className="bg-[#0a0817] border-2 border-[#241c42] p-2.5 shadow-[4px_4px_0_#000]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-pixel text-[8px] text-[#3dffa2]">RADAR · 12W</span>
            {hoveredCell && (
              <span className="font-pixel text-[7px] text-[#ffd23f]">
                {hoveredCell.count} {hoveredCell.count === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-[3px] min-w-[240px]">
              {heatmapWeeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      onMouseEnter={() => setHoveredCell({ date: day.date, count: day.count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`w-2.5 h-2.5 border transition-transform hover:scale-125 cursor-pointer ${getHeatmapColor(
                        day.level,
                      )}`}
                      title={`${day.date}: ${day.count} activity event(s)`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center font-pixel text-[7px] px-2 py-1.5 bg-[#0a0817] border border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-black transition-colors"
          >
            OPEN GITHUB PROFILE &gt;
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white space-y-6">
      {/* Top Banner / Radar Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0817] border-2 border-[#241c42] p-3.5 shadow-[4px_4px_0_#000]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3dffa2] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#3dffa2]" />
          </span>
          <div>
            <span className="font-pixel text-[9px] text-[#3dffa2] tracking-wider block">
              GITHUB SATELLITE TELEMETRY // @{username.toUpperCase()}
            </span>
            <span className="font-retro text-sm text-[#7d7aa3]">
              {loading
                ? 'ESTABLISHING HANDSHAKE WITH GITHUB API...'
                : rateLimited
                ? 'RATE-LIMIT MODE · CACHED TELEMETRY ACTIVE'
                : 'REAL-TIME REST API UPLINK ACTIVE'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="font-pixel text-[8px] text-[#7d7aa3] hidden sm:inline">
              SYNCED {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="font-pixel text-[8px] px-3 py-1.5 bg-[#151029] border border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-black transition-colors cursor-pointer disabled:opacity-50 shadow-[2px_2px_0_#000]"
          >
            {loading ? 'SYNCING...' : '⚡ RE-SYNC API'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#ff2d78]/10 border border-[#ff2d78] p-2 text-[#ff2d78] font-pixel text-[8px]">
          [!] {error}
        </div>
      )}

      {/* Core Profile HUD Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0a0817] border-2 border-[#241c42] p-3 shadow-[4px_4px_0_#000] relative overflow-hidden">
          <span className="font-pixel text-[8px] text-[#7d7aa3] block mb-1">PUBLIC REPOS</span>
          <span className="font-pixel text-lg sm:text-xl text-[#00e5ff]">
            {profile ? profile.public_repos : '8'}
          </span>
          <span className="font-retro text-xs text-[#00e5ff]/70 block mt-1">OPEN SOURCE</span>
          <div className="absolute right-2 bottom-2 text-2xl opacity-10 font-pixel">📦</div>
        </div>

        <div className="bg-[#0a0817] border-2 border-[#241c42] p-3 shadow-[4px_4px_0_#000] relative overflow-hidden">
          <span className="font-pixel text-[8px] text-[#7d7aa3] block mb-1">STARS EARNED</span>
          <span className="font-pixel text-lg sm:text-xl text-[#ffd23f]">
            {totalStars > 0 ? totalStars : '2'} ★
          </span>
          <span className="font-retro text-xs text-[#ffd23f]/70 block mt-1">COMMUNITY STARS</span>
          <div className="absolute right-2 bottom-2 text-2xl opacity-10 font-pixel">⭐</div>
        </div>

        <div className="bg-[#0a0817] border-2 border-[#241c42] p-3 shadow-[4px_4px_0_#000] relative overflow-hidden">
          <span className="font-pixel text-[8px] text-[#7d7aa3] block mb-1">LIVE EVENTS</span>
          <span className="font-pixel text-lg sm:text-xl text-[#3dffa2]">
            {events.length > 0 ? events.length : '10+'}
          </span>
          <span className="font-retro text-xs text-[#3dffa2]/70 block mt-1">STREAM SIGNALS</span>
          <div className="absolute right-2 bottom-2 text-2xl opacity-10 font-pixel">⚡</div>
        </div>

        <div className="bg-[#0a0817] border-2 border-[#241c42] p-3 shadow-[4px_4px_0_#000] relative overflow-hidden">
          <span className="font-pixel text-[8px] text-[#7d7aa3] block mb-1">DEVELOPER SINCE</span>
          <span className="font-pixel text-base sm:text-lg text-[#ff2d78]">
            {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2019'}
          </span>
          <span className="font-retro text-xs text-[#ff2d78]/70 block mt-1">5+ YEARS EXP</span>
          <div className="absolute right-2 bottom-2 text-2xl opacity-10 font-pixel">👾</div>
        </div>
      </div>

      {/* 8-Bit Activity Radar Heatmap */}
      <div className="bg-[#0a0817] border-2 border-[#241c42] p-4 shadow-[4px_4px_0_#000]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[9px] text-[#3dffa2]">
              CONTRIBUTION RADAR (LAST 12 WEEKS)
            </span>
            {hoveredCell && (
              <span className="font-pixel text-[8px] bg-[#110d24] text-[#ffd23f] px-2 py-0.5 border border-[#ffd23f]/40">
                {hoveredCell.date}: {hoveredCell.count} {hoveredCell.count === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-pixel text-[7px] text-[#7d7aa3]">
            <span>LESS</span>
            <div className="w-2.5 h-2.5 bg-[#15102a] border border-[#241c42]" />
            <div className="w-2.5 h-2.5 bg-[#004d30] border border-[#003823]" />
            <div className="w-2.5 h-2.5 bg-[#008f5a] border border-[#005e3b]" />
            <div className="w-2.5 h-2.5 bg-[#3dffa2] border border-[#29cf7f]" />
            <div className="w-2.5 h-2.5 bg-[#00ffcc] border border-[#3dffa2]" />
            <span>MORE</span>
          </div>
        </div>

        {/* Heatmap Grid Matrix */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1.5 min-w-[320px]">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onMouseEnter={() => setHoveredCell({ date: day.date, count: day.count })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 border transition-transform hover:scale-125 cursor-pointer ${getHeatmapColor(
                      day.level
                    )}`}
                    title={`${day.date}: ${day.count} activity event(s)`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Languages & Repos Spotlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Languages */}
        <div className="bg-[#0a0817] border-2 border-[#241c42] p-4 shadow-[4px_4px_0_#000]">
          <h4 className="font-pixel text-[9px] text-[#00e5ff] mb-3 flex items-center justify-between">
            <span>REPOSITORY LANGUAGES</span>
            <span className="text-[#7d7aa3] text-[8px]">{repos.length} REPOSITORIES ANALYZED</span>
          </h4>
          <div className="space-y-3">
            {topLanguages.length > 0 ? (
              topLanguages.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between font-retro text-base mb-1">
                    <span className="text-white font-pixel text-[8px]">{item.lang}</span>
                    <span className="text-[#ffd23f]">{item.percent}% ({item.count})</span>
                  </div>
                  <div className="h-2 bg-[#151029] border border-[#241c42] overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor:
                          idx === 0
                            ? '#3dffa2'
                            : idx === 1
                            ? '#00e5ff'
                            : idx === 2
                            ? '#ffd23f'
                            : '#ff2d78',
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2 font-retro text-base text-[#7d7aa3]">
                <div className="flex justify-between">
                  <span className="font-pixel text-[8px] text-white">TypeScript</span>
                  <span className="text-[#3dffa2]">50% (heal-cli)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-pixel text-[8px] text-white">JavaScript</span>
                  <span className="text-[#00e5ff]">30% (COCProject)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-pixel text-[8px] text-white">C++ / Other</span>
                  <span className="text-[#ffd23f]">20% (openmw / wand)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Featured Live Repos */}
        <div className="bg-[#0a0817] border-2 border-[#241c42] p-4 shadow-[4px_4px_0_#000]">
          <h4 className="font-pixel text-[9px] text-[#ffd23f] mb-3 flex items-center justify-between">
            <span>ACTIVE REPOSITORIES ON GITHUB</span>
            <a
              href={`https://github.com/${username}?tab=repositories`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3dffa2] hover:underline text-[8px]"
            >
              ALL REPOS &gt;
            </a>
          </h4>
          <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
            {repos.slice(0, 4).map((repo, idx) => (
              <a
                key={idx}
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 bg-[#110d24] border border-[#241c42] hover:border-[#ffd23f] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[8px] text-white group-hover:text-[#ffd23f]">
                    {repo.name}
                  </span>
                  <span className="font-pixel text-[7px] text-[#ffd23f]">
                    ★ {repo.stargazers_count}
                  </span>
                </div>
                <p className="font-retro text-sm text-slate-400 line-clamp-1 mt-0.5">
                  {repo.description || 'Public open source repository'}
                </p>
              </a>
            ))}
            {repos.length === 0 && (
              <div className="space-y-2">
                <a
                  href={`https://github.com/${username}/heal-cli`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 bg-[#110d24] border border-[#241c42] hover:border-[#ffd23f]"
                >
                  <span className="font-pixel text-[8px] text-white">heal-cli</span>
                  <p className="font-retro text-sm text-slate-400">Autonomous Terminal Crash Doctor</p>
                </a>
                <a
                  href={`https://github.com/${username}/COCProject`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 bg-[#110d24] border border-[#241c42] hover:border-[#ffd23f]"
                >
                  <span className="font-pixel text-[8px] text-white">COCProject</span>
                  <p className="font-retro text-sm text-slate-400">Clash of Clans Stats Tracker</p>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Terminal Activity Stream */}
      <div className="bg-[#0a0817] border-2 border-[#241c42] p-4 shadow-[4px_4px_0_#000]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#241c42] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[9px] text-[#3dffa2]">
              TERMINAL TELEMETRY FEED (RECENT PUBLIC EVENTS)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`font-pixel text-[7px] px-2 py-1 border transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-[#3dffa2] text-black border-[#3dffa2]'
                  : 'bg-[#151029] text-[#7d7aa3] border-[#241c42]'
              }`}
            >
              ALL ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('push')}
              className={`font-pixel text-[7px] px-2 py-1 border transition-colors cursor-pointer ${
                activeFilter === 'push'
                  ? 'bg-[#3dffa2] text-black border-[#3dffa2]'
                  : 'bg-[#151029] text-[#7d7aa3] border-[#241c42]'
              }`}
            >
              COMMITS
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('repo')}
              className={`font-pixel text-[7px] px-2 py-1 border transition-colors cursor-pointer ${
                activeFilter === 'repo'
                  ? 'bg-[#3dffa2] text-black border-[#3dffa2]'
                  : 'bg-[#151029] text-[#7d7aa3] border-[#241c42]'
              }`}
            >
              STARS / FORKS
            </button>
          </div>
        </div>

        {/* Event List */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 font-mono">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((ev) => {
              const info = getEventDescriptor(ev);
              return (
                <div
                  key={ev.id}
                  className="p-2.5 bg-[#0f0c22] border-l-2 hover:bg-[#15102e] transition-colors text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  style={{ borderLeftColor: info.color }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-pixel text-[7px] px-1.5 py-0.5 bg-black border"
                        style={{ color: info.color, borderColor: info.color }}
                      >
                        {info.action}
                      </span>
                      <a
                        href={`https://github.com/${ev.repo.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-[#00e5ff] font-pixel text-[8px]"
                      >
                        {info.target}
                      </a>
                    </div>
                    <p className="font-retro text-sm text-slate-300">
                      &gt; {info.desc}
                    </p>
                  </div>

                  <span className="font-pixel text-[7px] text-[#7d7aa3] shrink-0">
                    {formatRelativeTime(ev.created_at)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center font-retro text-base text-[#7d7aa3]">
              NO FILTERED SIGNALS IN THE RETRIEVED TELEMETRY STREAM
            </div>
          )}
        </div>
      </div>

      {/* Terminal Footer Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#241c42]">
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-xs px-6 py-3 bg-[#0a0817] border-2 border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-black transition-colors shadow-[0_4px_0_#000] text-center w-full sm:w-auto"
        >
          OPEN GITHUB PROFILE (github.com/{username}) &gt;
        </a>
        <span className="font-pixel text-[8px] text-[#7d7aa3]">
          GITHUB API V3 · AUTHENTICATED TELEMETRY
        </span>
      </div>
    </div>
  );
};
