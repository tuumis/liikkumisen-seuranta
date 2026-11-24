// Yhtenäinen ikonisto: 24 px ruudukko, 1,75 px viiva, pyöristetyt päät. Ikonit perivät värin
// tekstistä (currentColor) ja koon className-luokasta (oletus 1.25rem).

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function base({ size = '1.25rem', ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const IconWeek = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h2M14 14h2M8 17h2" />
  </svg>
);
export const IconBall = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m12 7.5 3.6 2.6-1.4 4.2H9.8L8.4 10.1z" />
    <path d="M12 3.5v4M15.6 10.1l4.3-1.3M14.2 14.3l2.6 3.6M9.8 14.3l-2.6 3.6M8.4 10.1 4.1 8.8" />
  </svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6" rx="1.2" />
    <rect x="10.5" y="6" width="3" height="11" rx="1.2" />
    <rect x="15.5" y="9" width="3" height="8" rx="1.2" />
  </svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="10" cy="17" r="2.2" />
  </svg>
);
export const IconHelp = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.4M12 16.8v.2" />
  </svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
);
export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
);
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </svg>
);
export const IconCalendarClock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="13" height="13" rx="3" />
    <path d="M3.5 9.5h13M7 3v3.5M13 3v3.5" />
    <circle cx="17.5" cy="17.5" r="3.5" />
    <path d="M17.5 16v1.6l1 .9" />
  </svg>
);
export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13 3 5.5 13.2h5.6L10.5 21 18 10.8h-5.6z" />
  </svg>
);
export const IconBone = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8.6 15.4 15.4 8.6M6.2 13a2.3 2.3 0 1 1-1.6 3.9 2.3 2.3 0 1 1 3.4-1.4M17.8 11a2.3 2.3 0 1 1 1.6-3.9 2.3 2.3 0 1 1-3.4 1.4" />
  </svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconHistory = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4l2.8 1.8" />
  </svg>
);
export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5zM18.5 15.5c.3 1.6 1 2.4 2.5 2.5-1.6.3-2.3 1-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" />
  </svg>
);
export const IconLeaf = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14z" />
    <path d="M5 19 13 11" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
  </svg>
);
export const IconRepeat = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17 3.5 20 6.5l-3 3" />
    <path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3" />
    <path d="M20 12.5v1a4 4 0 0 1-4 4H4" />
  </svg>
);
export const IconSync = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19.5 9A8 8 0 0 0 5.2 7.2L3.5 9" />
    <path d="M3.5 4.5V9H8" />
    <path d="M4.5 15a8 8 0 0 0 14.3 1.8l1.7-1.8" />
    <path d="M20.5 19.5V15H16" />
  </svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IconSun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
);
export const IconMoon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5 7.8 7.8 0 1 0 19.5 14.6Z" />
  </svg>
);
export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.8" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </svg>
);
export const IconDevices = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="13" height="9.5" rx="2" />
    <path d="M6.5 18h6" />
    <rect x="16.5" y="9" width="4.5" height="10" rx="1.5" />
  </svg>
);
export const IconContrast = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
  </svg>
);
export const IconShare = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15V4M8 7.5 12 3.5l4 4" />
    <path d="M8.5 10.5H7a2.5 2.5 0 0 0-2.5 2.5v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5h-1.5" />
  </svg>
);
export const IconTrophy = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5" />
  </svg>
);
export const IconPencil = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 5.5 18.5 9.5M4.5 19.5l1-4.2L15.8 5a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.7 18.5z" />
  </svg>
);
export const IconWarning = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z" />
    <path d="M12 9.5v4M12 16.8v.2" />
  </svg>
);
/** Päällekkäisyys: kaksi limittäistä ympyrää. */
export const IconOverlap = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="12" r="5.5" />
    <circle cx="15" cy="12" r="5.5" />
  </svg>
);
export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);
export const IconPause = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={3} />
  </svg>
);
export const IconComment = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
  </svg>
);
export const IconImport = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
  </svg>
);
export const IconExternal = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10" />
  </svg>
);
export const IconExpand = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />
  </svg>
);
export const IconReport = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3.5h7l4.5 4.5v10A2.5 2.5 0 0 1 16 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z" />
    <path d="M14 3.5V8h4.5M8.5 17v-3M12 17v-5M15.5 17v-2" />
  </svg>
);
