import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';
import { DynamicTrackMap } from '../components/DynamicTrackMap';
import { WordHighlightCaptions } from '../components/WordHighlightCaptions';

export interface FP2RacePaceProps {
  circuit?: string;
  compound?: string;
  track_data?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  driver_p1?: {
    driver: string;
    team: string;
    color: string;
    avg_lap_s: number;
    deg_slope_s_per_lap: number;
    lap_times: number[];
  };
  driver_p2?: {
    driver: string;
    team: string;
    color: string;
    avg_lap_s: number;
    deg_slope_s_per_lap: number;
    lap_times: number[];
  };
  delta_15_laps_s?: number;
  alignment?: {
    words: Array<{ word: string; start: number; end: number }>;
  };
}

export const FP2RacePaceVideo: React.FC<FP2RacePaceProps> = ({
  circuit = 'Ungheria',
  compound = 'MEDIUM',
  track_data,
  driver_p1 = {
    driver: 'LEC',
    team: 'Ferrari',
    color: '#E8002D',
    avg_lap_s: 80.534,
    deg_slope_s_per_lap: 0.024,
    lap_times: [80.42, 80.45, 80.41, 80.48, 80.52, 80.55, 80.58, 80.61, 80.64, 80.68],
  },
  driver_p2 = {
    driver: 'NOR',
    team: 'McLaren',
    color: '#FF8000',
    avg_lap_s: 81.004,
    deg_slope_s_per_lap: 0.088,
    lap_times: [80.58, 80.64, 80.72, 80.81, 80.92, 81.04, 81.15, 81.28, 81.39, 81.51],
  },
  delta_15_laps_s = 2.41,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const bgScale = interpolate(frame, [0, 1500], [1.0, 1.05]);

  // Stint lap progress (animating from lap 1 to 10)
  const animatedLapCount = Math.floor(
    interpolate(frame, [0, 1500], [1, 10], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Dynamic Scene Phases
  let phaseTitle = 'STINT BASELINE PACE (LAPS 1–5)';
  let insightCard = {
    title: 'OPENING STINT PACE MATCH',
    metric1: `${driver_p1.team}: ${driver_p1.avg_lap_s.toFixed(3)}s`,
    metric2: `${driver_p2.team}: ${driver_p2.avg_lap_s.toFixed(3)}s`,
    delta: `-0.16s/lap baseline advantage for ${driver_p1.team}`,
    verdict: `Both teams start with equivalent thermal grip, but tyre wear divergence begins on Lap 5.`,
  };

  if (frame >= 450 && frame < 1000) {
    phaseTitle = 'DEGRADATION SLOPE (Δs/LAP)';
    insightCard = {
      title: 'TYRE THERMAL DEGRADATION SLOPE',
      metric1: `${driver_p1.team}: +${driver_p1.deg_slope_s_per_lap.toFixed(3)}s/lap`,
      metric2: `${driver_p2.team}: +${driver_p2.deg_slope_s_per_lap.toFixed(3)}s/lap`,
      delta: `McLaren degradation rate is 3.6x higher`,
      verdict: `${driver_p2.team} suffers rear tyre overheating on high-fuel long run, causing a progressive pace drop.`,
    };
  } else if (frame >= 1000) {
    phaseTitle = '15-LAP RACE SIMULATION VERDICT';
    insightCard = {
      title: 'PROJECTED 15-LAP RACE GAP',
      metric1: `PROJECTED DELTA: +${delta_15_laps_s.toFixed(2)}s`,
      metric2: `UNDERCUT THREAT: ELIMINATED`,
      delta: `${driver_p1.team} +${delta_15_laps_s.toFixed(2)}s clear of undercut window`,
      verdict: `This pace slope guarantees ${driver_p1.team} pit stop window protection in the opening race stint.`,
    };
  }

  return (
    <AbsoluteFill style={{ backgroundColor: MURETTO_TOKENS.colors.bgDark, overflow: 'hidden' }}>
      {/* 1. CINEMATIC AI PIT WALL BACKGROUND */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})`, opacity: 0.16, filter: 'blur(3px)' }}>
        <Img src={staticFile('images/f1_pitwall_ai_bg.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>

      {/* 2. AUDIO VOICEOVER */}
      <Audio src={staticFile('audio/voiceover.mp3')} />

      {/* 3. MAIN SAFE ZONE CONTENT */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '130px 48px 210px 48px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* HEADER */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 20,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.telemetryCyan,
                letterSpacing: '0.14em',
              }}
            >
              FP2 RACE PACE VERDICT // {compound} TYRES
            </span>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 18,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.titaniumGrey,
              }}
            >
              10-LAP FUEL-CORRECTED LONG RUN
            </span>
          </div>

          <h1
            style={{
              fontFamily: MURETTO_TOKENS.typography.display,
              fontSize: 64,
              fontWeight: 700,
              color: MURETTO_TOKENS.colors.textPrimary,
              letterSpacing: '0.02em',
              margin: '8px 0 0 0',
              lineHeight: 1.05,
            }}
          >
            {driver_p1.team.toUpperCase()} VS {driver_p2.team.toUpperCase()}: TRUE RACE PACE
          </h1>
        </div>

        {/* 1. DYNAMIC TRACK MAP WITH LONG RUN CAR */}
        <DynamicTrackMap
          circuitName={circuit}
          p1Code={driver_p1.driver}
          p1Color={driver_p1.color}
          p2Code={driver_p2.driver}
          p2Color={driver_p2.color}
          trackData={track_data}
          activeCorner={phaseTitle}
          totalFrames={1500}
        />

        {/* 2. DYNAMIC DEGRADATION LAP-BY-LAP COMPARISON CHART */}
        <div
          style={{
            backgroundColor: MURETTO_TOKENS.colors.surface,
            borderRadius: 16,
            border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
            padding: '16px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, fontWeight: 700, color: MURETTO_TOKENS.colors.telemetryCyan }}>
              📈 LAP-BY-LAP PACE PROGRESSION (LAP {animatedLapCount} / 10)
            </span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: driver_p1.color, fontWeight: 700 }}>
                ● {driver_p1.driver} ({driver_p1.team})
              </span>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: driver_p2.color, fontWeight: 700 }}>
                ● {driver_p2.driver} ({driver_p2.team})
              </span>
            </div>
          </div>

          {/* Lap Time Bars */}
          <div style={{ display: 'flex', gap: 6, height: 80, alignItems: 'flex-end', paddingTop: 10 }}>
            {Array.from({ length: 10 }).map((_, idx) => {
              const isActive = idx < animatedLapCount;
              const t1 = driver_p1.lap_times[idx] || driver_p1.avg_lap_s;
              const t2 = driver_p2.lap_times[idx] || driver_p2.avg_lap_s;
              const h1 = Math.min(75, Math.max(25, (t1 - 79.5) * 20));
              const h2 = Math.min(75, Math.max(25, (t2 - 79.5) * 20));

              return (
                <div key={`lap-bar-${idx}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', opacity: isActive ? 1 : 0.2 }}>
                  <div style={{ display: 'flex', gap: 2, width: '100%', height: 60, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, height: `${h1}px`, backgroundColor: driver_p1.color, borderRadius: '2px 2px 0 0' }} />
                    <div style={{ flex: 1, height: `${h2}px`, backgroundColor: driver_p2.color, borderRadius: '2px 2px 0 0' }} />
                  </div>
                  <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 10, color: MURETTO_TOKENS.colors.titaniumGrey }}>
                    L{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. DYNAMIC TECHNICAL INSIGHT CARD */}
        <div
          style={{
            backgroundColor: '#090B0E',
            borderRadius: 16,
            border: `1.5px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            padding: '16px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 15, fontWeight: 700, color: MURETTO_TOKENS.colors.telemetryCyan }}>
              🔍 {insightCard.title}
            </span>
            <span style={{ backgroundColor: 'rgba(36,227,210,0.15)', border: `1px solid ${MURETTO_TOKENS.colors.telemetryCyan}`, borderRadius: 6, padding: '3px 10px', fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, fontWeight: 700, color: MURETTO_TOKENS.colors.telemetryCyan }}>
              {insightCard.delta}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1, backgroundColor: MURETTO_TOKENS.colors.surface, borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 22, fontWeight: 700, color: driver_p1.color }}>
                {insightCard.metric1}
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: MURETTO_TOKENS.colors.surface, borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 22, fontWeight: 700, color: driver_p2.color }}>
                {insightCard.metric2}
              </div>
            </div>
          </div>

          <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 16, color: MURETTO_TOKENS.colors.textPrimary, lineHeight: 1.25 }}>
            <span style={{ color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>VERDICT: </span>
            {insightCard.verdict}
          </div>
        </div>

        {/* 4. WORD SUBTITLES */}
        <WordHighlightCaptions words={alignment?.words} fallbackText="Forget single-lap headline times: long run race simulations tell the true story." />

        {/* 5. FOOTER */}
        <div
          style={{
            borderTop: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
            paddingTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 18, color: MURETTO_TOKENS.colors.titaniumGrey }}>
            SIMULATE FULL RACE PACE ON
          </span>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 32, fontWeight: 700, color: MURETTO_TOKENS.colors.textPrimary }}>
            murettobox.com
          </span>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 18, fontWeight: 700, color: MURETTO_TOKENS.colors.accentRed }}>
            LINK IN BIO
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
