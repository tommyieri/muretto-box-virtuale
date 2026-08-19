// murettobox-design-tokens.ts
export const MURETTO_TOKENS = {
  colors: {
    bgDark: '#0E1116',        // Deep Carbon Void
    surface: '#161B22',       // Slate Console Panel
    surfaceBorder: '#30363D', // Muted Carbon Border
    accentRed: '#FF1E3C',     // Ferrari Red / Critical Braking / Loss
    telemetryCyan: '#24E3D2', // Optimal Path / Full Throttle / Rejoin
    titaniumGrey: '#8B949E',  // Muted Telemetry Readouts
    textPrimary: '#F0F6FC',   // High-contrast data readout
    textSecondary: '#A7B0BF', // Secondary muted text
    warningYellow: '#E3B341', // Safety Car / Traffic Hazard
    green: '#2FD576',         // Advantage / Clean Air
  },
  typography: {
    display: "'Barlow Condensed', -apple-system, sans-serif",
    monospace: "'JetBrains Mono', monospace",
    label: "'Space Grotesk', -apple-system, sans-serif",
    body: "'Barlow', -apple-system, sans-serif",
  },
  curves: {
    hudSnap: [0.0, 0.0, 0.2, 1.0],      // Transizioni secche HUD
    smoothScrub: [0.25, 1.0, 0.5, 1.0], // Scorrimento cursore telemetria
  }
};
