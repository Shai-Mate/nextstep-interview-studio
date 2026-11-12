export function BrandMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path
        d="M9 27V14H13.5L20 22L26.5 14H31V27H26.5V20.5L20 28L13.5 20.5V27H9Z"
        fill="#D8EEAE"
      />
    </svg>
  );
}
export function MomentumArt() {
  return (
    <svg
      viewBox="0 0 400 320"
      fill="none"
      className="prism-art"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="plane-a"
          x1="153"
          y1="50"
          x2="228"
          y2="280"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EFFFD9" />
          <stop offset="1" stopColor="#A6CD72" />
        </linearGradient>
        <linearGradient
          id="plane-b"
          x1="220"
          y1="50"
          x2="330"
          y2="250"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C8E6A5" />
          <stop offset="1" stopColor="#6C955A" />
        </linearGradient>
        <linearGradient
          id="plane-c"
          x1="100"
          y1="170"
          x2="300"
          y2="270"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#66884D" />
          <stop offset="1" stopColor="#304F3F" />
        </linearGradient>
        <filter id="prism-shadow">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <ellipse
        cx="216"
        cy="277"
        rx="103"
        ry="13"
        fill="#1C3626"
        opacity=".12"
        filter="url(#prism-shadow)"
      />
      <ellipse
        cx="208"
        cy="164"
        rx="159"
        ry="92"
        transform="rotate(-28 208 164)"
        stroke="#A9BE94"
        strokeDasharray="3 6"
        opacity=".75"
      />
      <path d="M207 39L103 232L222 264L207 39Z" fill="url(#plane-a)" />
      <path d="M207 39L222 264L322 216L207 39Z" fill="url(#plane-b)" />
      <path
        d="M103 232L222 264L322 216L206 186L103 232Z"
        fill="url(#plane-c)"
        opacity=".77"
      />
      <path
        d="M207 39L222 264M207 39L103 232L222 264L322 216L207 39Z"
        stroke="#F8FFE9"
        strokeWidth="1.5"
        opacity=".7"
      />
      <circle cx="76" cy="205" r="7" fill="#FAFFF1" stroke="#A3BA8C" />
      <path d="M323 73V88M315.5 80.5H330.5" stroke="#6B8D55" strokeWidth="2" />
      <circle cx="297" cy="273" r="3" fill="#8DA775" />
    </svg>
  );
}
