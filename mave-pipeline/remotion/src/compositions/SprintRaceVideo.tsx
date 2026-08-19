import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';
import { DynamicTrackMap } from '../components/DynamicTrackMap';
import { WordHighlightCaptions } from '../components/WordHighlightCaptions';

export interface SprintRaceProps {
  circuit?: string;
  year?: number;
  winner?: { code: string; team: string; color: string; points: number };
  p2?: { code: string; team: string; color: string; points: number };
  laps?: number;
  key_tyre_finding?: string;
  sunday_impact?: string;
  track_data?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  alignment?: {
    words: Array<{ word: string; start: number; end: number }>;
  };
}

export const SprintRaceVideo: React.FC<SprintRaceProps> = ({
  circuit = 'Zandvoort',
  year = 2026,
  winner = { code: 'NOR', team: 'McLaren', color: '#FF8000', points: 8 },
  p2 = { code: 'VER', team: 'Red Bull Racing', color: '#2B478F', points: 7 },
  laps = 19,
  key_tyre_finding = 'Medium tyres hit severe blistering on Lap 14, causing a 0.85s/lap pace drop.',
  sunday_impact = 'Proves a 1-stop strategy in Sunday Grand Prix is high risk without aggressive tyre management.',
  track_data,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const bgScale = interpolate(frame, [0, 1500], [1.0, 1.05]);

  // Lap progress 1 to 19
  const animatedLap = Math.floor(
    interpolate(frame, [0, 1500], [1, laps], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <AbsoluteFill style={{ backgroundColor: MURETTO_TOKENS.colors.bgDark, overflow: 'hidden' }}>
      {/* 1. CINEMATIC AI PIT WALL BACKGROUND */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})`, opacity: 0.16, filter: 'blur(3px)' }}>
        <Img src={staticFile('images/f1_pitwall_ai_bg.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>

      {/* 2. AUDIO VOICEOVER */}
      <Audio src={staticFile('audio/voiceover.mp3')} />

      {/* 3. MAIN CONTENT CONTAINER */}
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
                color: MURETTO_TOKENS.colors.accentRed,
                letterSpacing: '0.14em',
              }}
            >
              100KM SPRINT RACE AUTOPSY
            </span>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 18,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.titaniumGrey,
              }}
            >
              {laps} LAPS · ZERO PIT STOPS
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
            {winner.code} WINS SPRINT: THE TYRE CLIFF
          </h1>
        </div>

        {/* 1. REAL TRACK MAP */}
        <DynamicTrackMap
          circuitName={circuit}
          p1Code={winner.code}
          p1Color={winner.color}
          p2Code={p2.code}
          p2Color={p2.color}
          trackData={track_data}
          activeCorner={`SPRINT LAP ${animatedLap} / ${laps}`}
          totalFrames={1500}
        />

        {/* 2. SPRINT POINTS & CLIFF BADGES */}
        <div style={{ display: 'flex', gap: 14 }}>
          {/* Winner */}
          <div
            style={{
              flex: 1,
              backgroundColor: MURETTO_TOKENS.colors.surface,
              borderRadius: 14,
              border: `1.5px solid ${winner.color}`,
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: winner.color, fontWeight: 700 }}>
                P1 · {winner.code}
              </span>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.green, fontWeight: 700 }}>
                +8 PTS
              </span>
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 26, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
              {winner.team}
            </div>
          </div>

          {/* P2 */}
          <div
            style={{
              flex: 1,
              backgroundColor: MURETTO_TOKENS.colors.surface,
              borderRadius: 14,
              border: `1.5px solid ${p2.color}`,
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: p2.color, fontWeight: 700 }}>
                P2 · {p2.code}
              </span>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.titaniumGrey, fontWeight: 700 }}>
                +7 PTS
              </span>
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 26, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
              {p2.team}
            </div>
          </div>
        </div>

        {/* 3. TECHNICAL VERDICT & SUNDAY IMPACT */}
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
              ⚠️ SPRINT TYRE CLIFF DISCOVERY
            </span>
            <span style={{ backgroundColor: 'rgba(232,0,45,0.2)', border: `1px solid ${MURETTO_TOKENS.colors.accentRed}`, borderRadius: 6, padding: '3px 10px', fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, fontWeight: 700, color: MURETTO_TOKENS.colors.accentRed }}>
              LAP 14 CLIFF
            </span>
          </div>

          <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 16, color: MURETTO_TOKENS.colors.textPrimary, lineHeight: 1.25 }}>
            <span style={{ color: MURETTO_TOKENS.colors.accentRed, fontWeight: 700 }}>TYRE CLIFF: </span>
            {key_tyre_finding}
          </div>

          <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 16, color: MURETTO_TOKENS.colors.textPrimary, lineHeight: 1.25 }}>
            <span style={{ color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>SUNDAY GP IMPACT: </span>
            {sunday_impact}
          </div>
        </div>

        {/* 4. WORD SUBTITLES */}
        <WordHighlightCaptions words={alignment?.words} fallbackText="The 100km sprint race gives the ultimate tyre degradation telemetry for Sunday." />

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
            REPLAY SPRINT STRATEGY ON
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
