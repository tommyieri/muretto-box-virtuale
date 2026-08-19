import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';
import { DynamicTrackMap } from '../components/DynamicTrackMap';
import { WordHighlightCaptions } from '../components/WordHighlightCaptions';

export interface PreRaceStrategyProps {
  circuit?: string;
  year?: number;
  headline?: string;
  lap_total?: number;
  contenders?: Array<{
    driver: string;
    team: string;
    grid: number;
    color: string;
    strategy: string;
    win_prob: number;
  }>;
  key_battleground?: string;
  track_data?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  alignment?: {
    words: Array<{ word: string; start: number; end: number }>;
  };
}

export const PreRaceStrategyVideo: React.FC<PreRaceStrategyProps> = ({
  circuit = 'Ungheria',
  year = 2026,
  headline = 'RACE WIN PREDICTOR // STRATEGY CLASH',
  lap_total = 70,
  contenders = [
    { driver: 'NOR', team: 'McLaren', grid: 1, color: '#FF8000', strategy: '1-STOP (MEDIUM -> HARD)', win_prob: 44 },
    { driver: 'HAM', team: 'Ferrari', grid: 2, color: '#E8002D', strategy: '2-STOP (SOFT -> MED -> MED)', win_prob: 38 },
    { driver: 'VER', team: 'Red Bull Racing', grid: 3, color: '#2B478F', strategy: 'OVERCUT 1-STOP (HARD -> SOFT)', win_prob: 18 },
  ],
  key_battleground = 'Turn 1 sprint & Lap 18 undercut crossover window.',
  track_data,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const bgScale = interpolate(frame, [0, 1800], [1.0, 1.05]);

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
              SUNDAY PRE-RACE STRATEGY CLASH
            </span>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 18,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.titaniumGrey,
              }}
            >
              {circuit.toUpperCase()} GP · {lap_total} LAPS
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
            WHO WINS TODAY? 1-STOP VS 2-STOP BATTLE
          </h1>
        </div>

        {/* 1. REAL TRACK MAP */}
        <DynamicTrackMap
          circuitName={circuit}
          p1Code="NOR"
          p1Color="#FF8000"
          p2Code="HAM"
          p2Color="#E8002D"
          trackData={track_data}
          activeCorner="GRID BATTLE // FRONT ROW DUEL"
          totalFrames={1800}
        />

        {/* 2. THREE CONTENDERS WIN PROBABILITY & STRATEGY CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contenders.map((c, idx) => {
            const probWidth = interpolate(frame, [60 + idx * 60, 180 + idx * 60], [0, c.win_prob], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={`contender-${c.driver}`}
                style={{
                  backgroundColor: MURETTO_TOKENS.colors.surface,
                  borderRadius: 12,
                  border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
                  padding: '12px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 22, fontWeight: 700, color: c.color }}>
                      P{c.grid} · {c.driver}
                    </span>
                    <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: MURETTO_TOKENS.colors.titaniumGrey }}>
                      {c.strategy}
                    </span>
                  </div>
                  <span style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                    {c.win_prob}% WIN PROB
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: 6, backgroundColor: '#090B0E', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${probWidth}%`, height: '100%', backgroundColor: c.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. KEY BATTLEGROUND INSIGHT */}
        <div
          style={{
            backgroundColor: '#090B0E',
            borderRadius: 14,
            border: `1.5px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.textPrimary }}>
            <span style={{ color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>DECISIVE WINDOW: </span>
            {key_battleground}
          </span>
          <span style={{ backgroundColor: 'rgba(36,227,210,0.15)', border: `1px solid ${MURETTO_TOKENS.colors.telemetryCyan}`, borderRadius: 6, padding: '4px 10px', fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, fontWeight: 700, color: MURETTO_TOKENS.colors.telemetryCyan }}>
            LIVE PREDICTOR
          </span>
        </div>

        {/* 4. WORD SUBTITLES */}
        <WordHighlightCaptions words={alignment?.words} fallbackText="Who wins today? The strategic battle between 1-stop and aggressive 2-stop." />

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
            RUN YOUR RACE STRATEGY LIVE ON
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
