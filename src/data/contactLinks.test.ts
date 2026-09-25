import { describe, expect, it } from 'vitest';
import { CONTACT_LINKS, PORTFOLIO_CONFIG } from './portfolioData';

describe('CONTACT_LINKS', () => {
  it('lists the five arcade contact channels in display order', () => {
    expect(CONTACT_LINKS.map((l) => l.id)).toEqual([
      'email',
      'linkedin',
      'github',
      'discord',
      'steam',
    ]);
  });

  it('ships a distinct icon and accent colour per channel', () => {
    const icons = new Set(CONTACT_LINKS.map((l) => l.icon));
    const colors = new Set(CONTACT_LINKS.map((l) => l.color));
    expect(icons.size).toBe(CONTACT_LINKS.length);
    expect(colors.size).toBe(CONTACT_LINKS.length);
  });

  it('gives every channel a non-empty href, icon, label and colour', () => {
    for (const link of CONTACT_LINKS) {
      expect(link.href.length).toBeGreaterThan(0);
      expect(link.icon.length).toBeGreaterThan(0);
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.ariaLabel.length).toBeGreaterThan(0);
      expect(link.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps email as a mailto and opens every web channel in a new tab', () => {
    for (const link of CONTACT_LINKS) {
      if (link.id === 'email') {
        expect(link.href).toBe(`mailto:${PORTFOLIO_CONFIG.email}`);
        expect(link.external).toBe(false);
      } else {
        expect(link.href).toMatch(/^https:\/\//);
        expect(link.external).toBe(true);
      }
    }
  });

  it('wires the configurable profile URLs straight through', () => {
    const byId = Object.fromEntries(CONTACT_LINKS.map((l) => [l.id, l]));
    expect(byId.linkedin.href).toBe(PORTFOLIO_CONFIG.linkedin);
    expect(byId.github.href).toBe(PORTFOLIO_CONFIG.github);
    expect(byId.discord.href).toBe(PORTFOLIO_CONFIG.discord);
    expect(byId.steam.href).toBe(PORTFOLIO_CONFIG.steam);
  });

  it('resolves the Discord user and Steam vanity URLs', () => {
    expect(PORTFOLIO_CONFIG.discord).toMatch(/^https:\/\/discord\.com\/users\/\d+$/);
    expect(PORTFOLIO_CONFIG.steam).toMatch(/^https:\/\/steamcommunity\.com\/id\/[\w-]+\/?$/);
  });
});
