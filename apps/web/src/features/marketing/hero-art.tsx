export function HeroArt() {
  return (
    <div className="relative isolate aspect-square w-full max-w-[34rem]" aria-hidden="true">
      <div className="hero-mesh absolute inset-[-12%] rounded-full bg-[radial-gradient(circle_at_30%_20%,rgb(153_69_255/0.45),transparent_42%),radial-gradient(circle_at_70%_75%,rgb(20_241_149/0.28),transparent_46%)] blur-2xl" />
      <div className="pulse-glow absolute inset-[18%] rounded-full border border-brand-purple/30" />
      <div className="float-slow absolute inset-[8%] rounded-[2rem] border border-white/10 bg-[#22222B]/40 shadow-[0_0_80px_rgb(153_69_255/0.18)] backdrop-blur-sm" />
      <svg viewBox="0 0 320 320" className="relative z-10 h-full w-full">
        <defs>
          <linearGradient id="sb-hero-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="100%" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <g className="orbit" style={{ transformOrigin: "160px 160px" }}>
          <circle cx="160" cy="48" r="7" fill="#14F195" />
          <circle cx="272" cy="160" r="5" fill="#9945FF" />
          <circle cx="160" cy="272" r="6" fill="#14F195" />
          <circle cx="48" cy="160" r="5" fill="#9945FF" />
        </g>
        <circle cx="160" cy="160" r="54" fill="none" stroke="url(#sb-hero-stroke)" strokeWidth="1.5" opacity="0.9" />
        <circle cx="160" cy="160" r="88" fill="none" stroke="#9945FF" strokeWidth="1" opacity="0.35" />
        <circle cx="160" cy="160" r="118" fill="none" stroke="#14F195" strokeWidth="1" opacity="0.2" strokeDasharray="6 10" />
        <path
          d="M160 106 L206 160 L160 214 L114 160 Z"
          fill="none"
          stroke="url(#sb-hero-stroke)"
          strokeWidth="1.75"
        />
        <circle cx="160" cy="160" r="10" fill="#111116" stroke="#14F195" strokeWidth="2" />
        <circle cx="206" cy="160" r="6" fill="#9945FF" />
        <circle cx="114" cy="160" r="6" fill="#14F195" />
        <circle cx="160" cy="106" r="6" fill="#9945FF" />
        <circle cx="160" cy="214" r="6" fill="#14F195" />
      </svg>
    </div>
  );
}
