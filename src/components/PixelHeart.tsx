import React from 'react';

export interface PixelHeartProps {
  size?: number;
  className?: string;
  delay?: number;
  filled?: boolean;
}

/**
 * Authentic 8-bit / 16-bit arcade pixel heart with cyber-magenta neon glow,
 * specular glint highlight, and heartbeat animation.
 * When `filled === false`, renders as a depleted/empty retro pixel heart.
 */
export const PixelHeart: React.FC<PixelHeartProps> = ({
  size = 16,
  className = '',
  delay = 0,
  filled = true,
}) => {
  if (!filled) {
    return (
      <svg
        viewBox="0 0 10 9"
        width={size}
        height={size * 0.9}
        className={`pixel-art shrink-0 opacity-40 grayscale select-none ${className}`}
        style={{
          imageRendering: 'pixelated',
        }}
        aria-hidden="true"
      >
        {/* Dark pixel drop outline */}
        <path
          d="M1 0h3v1h2v-1h3v1h1v3h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-1h-1v-3h1z"
          fill="#1c1829"
        />
        {/* Depleted hollow heart interior */}
        <path
          d="M1 1h3v1h2v-1h3v2h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-2h1z"
          fill="#2b2342"
        />
        {/* Faint inner shade */}
        <rect x="2" y="2" width="1" height="2" fill="#3f3560" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 10 9"
      width={size}
      height={size * 0.9}
      className={`pixel-art shrink-0 animate-heart-beat select-none ${className}`}
      style={{
        imageRendering: 'pixelated',
        animationDelay: `${delay}s`,
      }}
      aria-hidden="true"
    >
      {/* Dark pixel drop outline */}
      <path
        d="M1 0h3v1h2v-1h3v1h1v3h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-1h-1v-3h1z"
        fill="#26000d"
      />
      {/* Heart Body - Neon Magenta */}
      <path
        d="M1 1h3v1h2v-1h3v2h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1v-2h1z"
        fill="#ff2d78"
      />
      {/* Top bevel glint */}
      <rect x="2" y="1" width="2" height="1" fill="#ff7ea8" />
      <rect x="6" y="1" width="2" height="1" fill="#ff7ea8" />
      {/* Specular White Highlights */}
      <rect x="2" y="2" width="1" height="2" fill="#ffffff" />
      <rect x="3" y="2" width="1" height="1" fill="#ffffff" />
      {/* Shading edge */}
      <rect x="7" y="3" width="1" height="1" fill="#88002d" opacity="0.6" />
      <rect x="6" y="4" width="1" height="1" fill="#88002d" opacity="0.6" />
    </svg>
  );
};
