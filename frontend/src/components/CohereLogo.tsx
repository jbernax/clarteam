import React from 'react';

interface CohereLogoProps {
  className?: string;
  size?: number;
}

export function CohereLogo({ className = 'w-9 h-9', size = 36 }: CohereLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cohere-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#181A1E" />
          <stop offset="1" stopColor="#0E1013" />
        </linearGradient>
        <linearGradient id="cohere-node-1" x1="11" y1="7" x2="29" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="cohere-node-2" x1="20" y1="16" x2="34" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A5C" />
          <stop offset="1" stopColor="#E85332" />
        </linearGradient>
        <linearGradient id="cohere-node-3" x1="6" y1="16" x2="22" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      {/* Volcanic Obsidian Squircle Frame */}
      <rect width="40" height="40" rx="11" fill="url(#cohere-bg)" />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10.5"
        stroke="white"
        strokeOpacity="0.14"
      />

      {/* Orbital Connection Ring */}
      <circle
        cx="20"
        cy="20.5"
        r="10.5"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1"
        strokeDasharray="2 2"
      />

      {/* Top Node (Focus / Maker Time) */}
      <circle cx="20" cy="13.2" r="6.8" fill="url(#cohere-node-1)" fillOpacity="0.92" />

      {/* Bottom-Right Node (Warm Human Inclusion / Coral) */}
      <circle cx="26.2" cy="24.2" r="6.8" fill="url(#cohere-node-2)" fillOpacity="0.9" />

      {/* Bottom-Left Node (Shared Context / Network) */}
      <circle cx="13.8" cy="24.2" r="6.8" fill="url(#cohere-node-3)" fillOpacity="0.88" />

      {/* Harmonic Central Cohesion Core */}
      <circle cx="20" cy="20.6" r="3.4" fill="#FAF9F5" />
      <circle cx="20" cy="20.6" r="1.4" fill="#141517" />
    </svg>
  );
}

