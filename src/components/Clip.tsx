import { useId } from "react";

/**
 * Clip, the CutCheck barber bot: stone head, glowing eyes, handlebar moustache, a glossy pompadour
 * with a coral streak and a comb stuck in it, faded sides with two shaved lines, a coral barber cape,
 * scissors in one hand and the other waving. Parts carry data-clip-* hooks for the GSAP motion.
 */
export function Clip({ className, decorative }: { className?: string; decorative?: boolean }) {
  // Unique gradient ids: Clip can be on the page twice (intro + banner).
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  return (
    <svg
      viewBox="0 0 260 320"
      className={className}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Clip, the CutCheck barber bot, waving hello" })}
    >
      <defs>
        <linearGradient id={id("stone")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9d2cf" />
          <stop offset="1" stopColor="#9d9592" />
        </linearGradient>
        <linearGradient id={id("hair")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a2752" />
          <stop offset="0.55" stopColor="#2a1330" />
          <stop offset="1" stopColor="#170a1b" />
        </linearGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1330" stopOpacity="0.85" />
          <stop offset="1" stopColor="#2a1330" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3540" />
          <stop offset="1" stopColor="#24202a" />
        </linearGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="130" cy="308" rx="78" ry="9" fill="#2a1330" opacity="0.18" />

      <g data-clip-body>
        {/* legs */}
        <rect x="102" y="250" width="18" height="52" rx="9" fill="#24202a" />
        <rect x="140" y="250" width="18" height="52" rx="9" fill="#24202a" />
        <ellipse cx="111" cy="301" rx="14" ry="7" fill="#170a1b" />
        <ellipse cx="149" cy="301" rx="14" ry="7" fill="#170a1b" />

        {/* torso + barber cape */}
        <rect x="76" y="176" width="108" height="92" rx="32" fill={`url(#${id("body")})`} />
        <path d="M84 186 Q130 214 176 186 L182 252 Q130 274 78 252 Z" fill="#f07a63" />
        <path d="M84 186 Q130 214 176 186" stroke="#b83a27" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* cape pocket with a comb */}
        <rect x="112" y="226" width="36" height="20" rx="6" fill="#e2604a" />
        <rect x="117" y="219" width="26" height="9" rx="2" fill="#2a1330" />
        <path d="M120 228v-4M124 228v-4M128 228v-4M132 228v-4M136 228v-4M140 228v-4" stroke="#2a1330" strokeWidth="1.6" />

        {/* left arm with scissors */}
        <path d="M84 196 Q62 214 58 240" stroke="#24202a" strokeWidth="17" fill="none" strokeLinecap="round" />
        <g transform="translate(40 232) rotate(-28)">
          <path d="M14 10 L40 0 M14 14 L40 24" stroke="#c9ccd4" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="8" cy="6" r="6.5" stroke="#b83a27" strokeWidth="3.5" fill="none" />
          <circle cx="8" cy="19" r="6.5" stroke="#b83a27" strokeWidth="3.5" fill="none" />
        </g>
        <circle cx="57" cy="243" r="11" fill="#2d2832" />

        {/* waving arm (rotates around the shoulder) */}
        <g data-clip-arm>
          <path d="M176 196 Q206 182 214 148" stroke="#24202a" strokeWidth="17" fill="none" strokeLinecap="round" />
          <circle cx="216" cy="138" r="13" fill="#2d2832" />
          <path d="M207 128 q-3 -9 3 -11 M216 125 q0 -10 6 -10 M224 130 q4 -8 9 -5" stroke="#2d2832" strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
      </g>

      <g data-clip-head>
        {/* neck + collar */}
        <rect x="112" y="160" width="36" height="22" rx="8" fill="#24202a" />
        <rect x="96" y="170" width="68" height="14" rx="7" fill="#b83a27" />

        {/* head */}
        <rect x="56" y="64" width="148" height="112" rx="36" fill={`url(#${id("stone")})`} />
        <rect x="56" y="64" width="148" height="112" rx="36" fill="none" stroke="#8a827f" strokeOpacity="0.35" />
        {/* faded sides with two shaved lines */}
        <rect x="56" y="76" width="22" height="48" rx="10" fill={`url(#${id("fade")})`} />
        <rect x="182" y="76" width="22" height="48" rx="10" fill={`url(#${id("fade")})`} />
        <path d="M60 92 l12 -6 M61 100 l12 -6" stroke="#d9d2cf" strokeWidth="2.4" strokeLinecap="round" />

        {/* face */}
        <g data-clip-eyes>
          <circle cx="104" cy="116" r="15" fill={`url(#${id("glow")})`} opacity="0.8" />
          <circle cx="156" cy="116" r="15" fill={`url(#${id("glow")})`} opacity="0.8" />
          <circle cx="104" cy="116" r="7.5" fill="#ffffff" />
          <circle cx="156" cy="116" r="7.5" fill="#ffffff" />
        </g>
        <ellipse cx="84" cy="138" rx="9" ry="5" fill="#f07a63" opacity="0.55" />
        <ellipse cx="176" cy="138" rx="9" ry="5" fill="#f07a63" opacity="0.55" />
        {/* handlebar moustache */}
        <path
          d="M130 140 C122 133 108 133 102 140 C98 144 92 144 90 139 C92 150 106 151 116 146 C122 143 127 142 130 144 C133 142 138 143 144 146 C154 151 168 150 170 139 C168 144 162 144 158 140 C152 133 138 133 130 140 Z"
          fill="#2a1330"
        />
        <path d="M116 155 Q130 163 144 155" stroke="#2a1330" strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* pompadour with a coral streak and a comb stuck in it */}
        <g data-clip-quiff>
          <path
            d="M56 100 C46 54 84 14 134 12 C184 10 218 36 208 86 C202 76 192 72 184 76 C178 66 166 64 158 72 C146 62 128 64 120 74 C108 66 90 70 82 82 C72 76 62 84 56 100 Z"
            fill={`url(#${id("hair")})`}
          />
          {/* the swept-up front flick */}
          <path d="M120 22 C150 -6 214 -4 222 30 C224 44 214 54 206 58 C210 40 196 24 172 24 C156 24 138 28 120 22 Z" fill={`url(#${id("hair")})`} />
          <path d="M84 52 C104 30 146 24 176 34" stroke="#f07a63" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M96 64 C118 46 150 42 182 50" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="4" fill="none" strokeLinecap="round" />
          <g transform="translate(166 26) rotate(16)">
            <rect x="0" y="0" width="34" height="11" rx="3" fill="#f07a63" />
            <path d="M4 11v9M9 11v9M14 11v9M19 11v9M24 11v9M29 11v9" stroke="#f07a63" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
