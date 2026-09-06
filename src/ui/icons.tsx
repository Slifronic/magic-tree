const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SpringIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 9.6V4M12 14.4V20M9.6 12H4M14.4 12H20" />
    <path d="M8.3 8.3 5.6 5.6M15.7 8.3l2.7-2.7M8.3 15.7l-2.7 2.7M15.7 15.7l2.7 2.7" />
  </svg>
);

export const SummerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </svg>
);

export const AutumnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M18.5 10.5a4.5 4.5 0 0 0-8.7-1.6A3.6 3.6 0 1 0 8.4 16h9.6a3.5 3.5 0 0 0 .5-6.98Z" />
    <path d="M8 19.5 7 21.5M12 19.5 11 21.5M16 19.5 15 21.5" />
  </svg>
);

export const ShareIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={1.8}>
    <path d="M12 15V3.5M12 3.5 8.2 7.3M12 3.5l3.8 3.8" />
    <path d="M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5" />
  </svg>
);

export const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const SoundOnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4Z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4" />
  </svg>
);

export const SoundOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4Z" />
    <path d="m16 10 4 4M20 10l-4 4" />
  </svg>
);

/** Pixel mark: a canopy drawn on a QR-like grid. */
export const BrandMark = () => (
  <svg className="brand__mark" viewBox="0 0 24 24" aria-hidden="true">
    <g fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1" opacity="0.28" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="17" y="1" width="6" height="6" rx="1" opacity="0.28" />
      <rect x="19" y="3" width="2" height="2" />
      <rect x="1" y="17" width="6" height="6" rx="1" opacity="0.28" />
      <rect x="3" y="19" width="2" height="2" />
    </g>
    <g fill="#6aa84f">
      <rect x="10" y="4" width="4" height="3" rx="1" />
      <rect x="7" y="7" width="10" height="3" rx="1" />
      <rect x="8.5" y="10" width="7" height="3" rx="1" />
    </g>
    <rect x="11" y="13" width="2" height="6" rx="0.6" fill="#8a6a4e" />
    <rect x="8" y="19" width="8" height="2" rx="1" fill="currentColor" opacity="0.42" />
  </svg>
);

/* ------------------------------------------------------------------ trees */

export const OakIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M12 21v-6.5" />
    <path d="M6.6 13.4a4 4 0 0 1 .7-7.2 4.3 4.3 0 0 1 8-1 3.8 3.8 0 0 1 2.9 6.6 3.9 3.9 0 0 1-3.3 1.9H8.4a3.7 3.7 0 0 1-1.8-.3Z" />
    <path d="m12 17-2.2-2M12 15.6l2-1.8" />
  </svg>
);

export const PineIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M12 21v-3" />
    <path d="M12 2.6 8.2 8.4h7.6L12 2.6Z" />
    <path d="M12 7.6 6.6 14h10.8L12 7.6Z" />
    <path d="M12 12.4 5.4 18.4h13.2L12 12.4Z" />
  </svg>
);

export const WillowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M12 21v-7" />
    <path d="M5.4 10.6a4.2 4.2 0 0 1 3.1-6.4 4.1 4.1 0 0 1 7 0 4.2 4.2 0 0 1 3.1 6.4" />
    <path d="M5.6 10.4c0 2.4.6 4 1.4 5M12 10.2c0 3 .1 5 .6 6.4M18.4 10.4c0 2.4-.7 4-1.5 5M9 10.6c-.1 2.6.2 4.3.8 5.5M15 10.6c.1 2.6-.2 4.3-.8 5.5" />
  </svg>
);

export const BirchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M12 21V6" />
    <path d="M12 2.8c2.7 0 4.6 2.3 4.6 5.3S14.5 14 12 14s-4.6-2.9-4.6-5.9S9.3 2.8 12 2.8Z" />
    <path d="m12 9.5 2.4-2.2M12 12.4 9.6 10.2" />
  </svg>
);
