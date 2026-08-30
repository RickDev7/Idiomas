// Ícones SVG line, consistentes entre plataformas. Stroke currentColor.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const IconHome = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
);
export const IconChat = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.8A8 8 0 1 1 21 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>
);
export const IconBrain = (p: IconProps) => (
  <svg {...base(p)}><path d="M9.5 4.5a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0-1.5 4 2.5 2.5 0 0 0 .5 4 2.5 2.5 0 0 0 3.5 1.5Z" /><path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 1.5 4 2.5 2.5 0 0 1-.5 4 2.5 2.5 0 0 1-3.5 1.5Z" /><path d="M9.5 4.5v15M14.5 4.5v15" /></svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20h16" /><path d="M7 20v-6M12 20V8M17 20v-9" /></svg>
);
export const IconMic = (p: IconProps) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
);
export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 4.5v15l13-7.5-13-7.5Z" /></svg>
);
export const IconBack = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconGear = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);
export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v4h-4" /></svg>
);
export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" /></svg>
);
export const IconFlame = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 11 8 9 12 3Z" /></svg>
);
export const IconEar = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 9a5 5 0 0 1 10 0c0 3-2 4-3 5s-1 3 1 4" /><path d="M9 9a3 3 0 0 1 6 0" /></svg>
);
export const IconStop = (p: IconProps) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /></svg>
);
export const IconBriefcase = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></svg>
);
export const IconHouse = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
);
export const IconPlane = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 12l18-8-8 18-2-7-8-3Z" /></svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>
);
export const IconSprout = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21V11" /><path d="M12 11c-4-1-6-5-6-8 5 0 8 3 8 8" /><path d="M12 11c4-1 6-5 6-8-5 0-8 3-8 8" /></svg>
);
export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
);
export const IconLightbulb = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 18h6" /><path d="M10 21h4" /><path d="M8 14a5 5 0 1 1 8 0c-.8.9-1.2 1.6-1.3 3H9.3c-.1-1.4-.5-2.1-1.3-3Z" /></svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconTrophy = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 5h8v4a4 4 0 0 1-8 0V5Z" /><path d="M8 7H5a2 2 0 0 0 2 4" /><path d="M16 7h3a2 2 0 0 1-2 4" /><path d="M12 13v3" /><path d="M9 21h6" /><path d="M10 18h4" /></svg>
);
export const IconRocket = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3c4 3 6 7 6 11l-6 4-6-4c0-4 2-8 6-11Z" /><circle cx="12" cy="11" r="1.5" /><path d="M8 19c.5-1.5 1.2-2.5 2-3M16 19c-.5-1.5-1.2-2.5-2-3" /></svg>
);
export const IconArrowUp = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 19V6" /><path d="M6 12l6-6 6 6" /></svg>
);
export const IconSignal = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 18h3v-4H4v4Z" /><path d="M10.5 18h3V10h-3v8Z" /><path d="M17 18h3V6h-3v12Z" /></svg>
);
export const IconLaptop = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></svg>
);
export const IconWrench = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 6a4 4 0 0 0-5.6 5.6L4 17l3 3 5.4-5.4A4 4 0 0 0 18 9l-3 3-2-2 3-3Z" /></svg>
);
export const IconGlobe = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M4 12h16" /><path d="M12 4a14 14 0 0 1 0 16 14 14 0 0 1 0-16Z" /></svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.5" /><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></svg>
);
export const IconSun = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19" /></svg>
);
export const IconMoon = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></svg>
);
export const IconUtensils = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 3v8a2 2 0 0 0 4 0V3" /><path d="M7 11v10" /><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5Z" /><path d="M17 12v9" /></svg>
);
export const IconBag = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8h16l-1.2 12H5.2L4 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M18 20c0-2.5-1-4.5-3-5.5" /></svg>
);
export const IconBook = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" /><path d="M5 18a2 2 0 0 1 2-2h11" /></svg>
);
export const IconGearSmall = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconHangup = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 15.5c2.5 2.5 5.5 2.5 8 0l2.2 2.2c-3.5 3.2-8.9 3.2-12.4 0L8 15.5Z" /><path d="M7.5 17.5 5 21M16.5 17.5 19 21" /></svg>
);
export const IconKeyboard = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 13h10" /></svg>
);
export const IconTurtle = (p: IconProps) => (
  <svg {...base(p)}><ellipse cx="12" cy="13" rx="7" ry="4.5" /><path d="M7 12c0-3 2-5 5-5s5 2 5 5" /><path d="M5 14.5 3.5 16M19 14.5l1.5 1.5M9 17.5v2M15 17.5v2" /></svg>
);
export const IconSpeaker = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /><path d="M18 7a6 6 0 0 1 0 10" /></svg>
);
export const IconHelp = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1.3.9-1.3 1.6V14" /><path d="M12 17h.01" /></svg>
);
export const IconWave = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 12v0M8 8v8M12 5v14M16 8v8M20 12v0" /></svg>
);
