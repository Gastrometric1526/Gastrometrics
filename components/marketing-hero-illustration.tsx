// Ilustración del hero de la landing — un mockup abstracto del panel de costeo de
// Gastrometrics (ficha técnica + desglose de costos + estado de inventario), no una
// foto de stock genérica de "chef sonriendo". Usa los mismos tokens de color que el
// resto de la app (--chart-1..7, --card, --border) para adaptarse automáticamente a
// modo claro/oscuro, igual que components/ui/chart.tsx.
export function MarketingHeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 460" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Panel de costeo de Gastrometrics">
      <defs>
        <linearGradient id="gm-hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.10" />
          <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="gm-hero-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--chart-3))" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="560" height="460" rx="28" fill="url(#gm-hero-bg)" />

      {/* Tarjeta principal: ficha técnica */}
      <g>
        <rect x="40" y="52" width="300" height="356" rx="16" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <rect x="64" y="80" width="140" height="14" rx="4" fill="hsl(var(--foreground))" opacity="0.85" />
        <rect x="64" y="102" width="90" height="9" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.6" />

        <rect x="64" y="128" width="252" height="1" fill="hsl(var(--border))" />

        {/* filas de ingredientes */}
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(64, ${146 + i * 30})`}>
            <circle cx="6" cy="6" r="6" fill={`hsl(var(--chart-${(i % 7) + 1}))`} opacity="0.85" />
            <rect x="20" y="1" width={90 - i * 6} height="9" rx="3" fill="hsl(var(--foreground))" opacity="0.55" />
            <rect x="200" y="1" width="52" height="9" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.55" />
          </g>
        ))}

        <rect x="64" y="312" width="252" height="1" fill="hsl(var(--border))" />

        <rect x="64" y="332" width="70" height="10" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.7" />
        <rect x="230" y="328" width="86" height="20" rx="6" fill="hsl(var(--primary))" opacity="0.15" />
        <rect x="240" y="333" width="66" height="10" rx="3" fill="hsl(var(--primary))" />

        <rect x="64" y="366" width="252" height="30" rx="8" fill="hsl(var(--chart-2))" opacity="0.12" />
        <rect x="76" y="376" width="130" height="10" rx="3" fill="hsl(var(--chart-2))" opacity="0.9" />
      </g>

      {/* Tarjeta flotante: desglose de costos (barras) */}
      <g transform="translate(322, 40)">
        <rect x="0" y="0" width="200" height="176" rx="16" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <rect x="20" y="20" width="110" height="10" rx="3" fill="hsl(var(--foreground))" opacity="0.8" />
        {[0, 1, 2, 3, 4].map((i) => {
          const widths = [120, 92, 150, 70, 108]
          return (
            <g key={i} transform={`translate(20, ${46 + i * 24})`}>
              <rect x="0" y="0" width="160" height="8" rx="4" fill="hsl(var(--muted))" />
              <rect x="0" y="0" width={widths[i]} height="8" rx="4" fill="url(#gm-hero-bar)" />
            </g>
          )
        })}
      </g>

      {/* Tarjeta flotante: pastel de composición */}
      <g transform="translate(322, 236)">
        <rect x="0" y="0" width="200" height="172" rx="16" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <rect x="20" y="20" width="90" height="10" rx="3" fill="hsl(var(--foreground))" opacity="0.8" />

        <g transform="translate(60, 96)">
          <circle r="42" fill="hsl(var(--chart-1))" opacity="0.9" />
          <path d="M0 0 L0 -42 A42 42 0 0 1 36 21 Z" fill="hsl(var(--chart-4))" />
          <path d="M0 0 L36 21 A42 42 0 0 1 -20 36 Z" fill="hsl(var(--chart-2))" />
          <circle r="18" fill="hsl(var(--card))" />
        </g>

        <g transform="translate(126, 66)">
          {[1, 4, 2].map((c, i) => (
            <g key={i} transform={`translate(0, ${i * 20})`}>
              <rect width="10" height="10" rx="2" fill={`hsl(var(--chart-${c}))`} />
              <rect x="16" y="1" width={40 - i * 6} height="8" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.6" />
            </g>
          ))}
        </g>
      </g>

      {/* Chip flotante: alerta de stock, refuerza el modulo de inventario */}
      <g transform="translate(30, 26)">
        <rect x="0" y="0" width="150" height="34" rx="17" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <circle cx="20" cy="17" r="6" fill="hsl(var(--chart-4))" />
        <rect x="34" y="12" width="100" height="10" rx="3" fill="hsl(var(--foreground))" opacity="0.6" />
      </g>
    </svg>
  )
}
