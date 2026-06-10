'use client'

/**
 * Ambient walkthrough backdrop: drifting grid, accent gradient orbs and a soft
 * noise layer. All motion is pure CSS (see globals.css `htw-*`) so it stays at
 * 60fps and is automatically disabled under `prefers-reduced-motion`.
 */
export default function Background({ accentRgb }: { accentRgb: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ '--htw-accent': accentRgb } as React.CSSProperties}
    >
      {/* Base vignette */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-[#070709]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(var(--htw-accent)/0.10),transparent_55%)] transition-[background] duration-1000" />

      {/* Drifting grid */}
      <div
        className="htw-grid absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(120 120 135 / 0.10) 1px, transparent 1px), linear-gradient(to bottom, rgb(120 120 135 / 0.10) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(110% 90% at 50% 30%, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(110% 90% at 50% 30%, black 30%, transparent 75%)',
        }}
      />

      {/* Accent orbs */}
      <div
        className="htw-orb-a absolute -left-[12%] top-[8%] h-[42vmax] w-[42vmax] rounded-full blur-[100px] opacity-60 transition-[background] duration-1000"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgb(var(--htw-accent)/0.55), transparent 65%)',
        }}
      />
      <div
        className="htw-orb-b absolute -right-[10%] top-[2%] h-[34vmax] w-[34vmax] rounded-full blur-[100px] opacity-50"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgb(59 130 246 / 0.40), transparent 65%)',
        }}
      />
      <div
        className="htw-orb-c absolute bottom-[-14%] left-[28%] h-[38vmax] w-[38vmax] rounded-full blur-[110px] opacity-45"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgb(16 185 129 / 0.32), transparent 65%)',
        }}
      />

      {/* Fine noise */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
