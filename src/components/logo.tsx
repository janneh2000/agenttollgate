import * as React from "react";

/** Stylised tollgate barrier — two posts + a gate bar with a coin notch. */
export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.5" />
      </linearGradient>
    </defs>
    {/* posts */}
    <rect x="3" y="6" width="3" height="22" rx="1" fill="url(#tg)" />
    <rect x="26" y="6" width="3" height="22" rx="1" fill="url(#tg)" />
    {/* base */}
    <rect x="2" y="26" width="28" height="3" rx="1.2" fill="currentColor" opacity="0.5" />
    {/* gate bar */}
    <rect x="6" y="11" width="20" height="3" rx="1.2" fill="currentColor" />
    {/* coin slot in middle */}
    <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M14.5 20h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
