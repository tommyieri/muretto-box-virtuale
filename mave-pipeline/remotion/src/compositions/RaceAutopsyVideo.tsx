import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';
import { DynamicTrackMap } from '../components/DynamicTrackMap';
import { AnimatedSlider } from '../components/AnimatedSlider';
import { DeltaCounter } from '../components/DeltaCounter';
import { WordHighlightCaptions } from '../components/WordHighlightCaptions';

export interface RaceAutopsyProps {
  circuit?: string;
  year?: number;
  team?: string;
  driver?: string;
  color?: string;
  actual_pit_lap?: number;
  actual_rejoin_pos?: number;
  safety_car_lap?: number;
  safety_car_pit_loss_s?: number;
  normal_pit_loss_s?: number;
  simulated_pit_lap?: number;
  simulated_rejoin_pos?: number;
  projected_lead_s?: number;
  counterfactual_verdict?: string;
  track_data?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  alignment?: {
    words: Array<{ word: string; start: number; end: number }>;
  };
}

export const RaceAutopsyVideo: React.FC<RaceAutopsyProps> = ({
  circuit = 'Ungheria',
  year = 2026,
  team = 'Ferrari',
  driver = 'LEC',
  color = '#E8002D',
  actual_pit_lap = 18,
  actual_rejoin_pos = 4,
  safety_car_lap = 20,
  safety_car_pit_loss_s = 11.5,
  normal_pit_loss_s = 20.2,
  simulated_pit_lap = 20,
  simulated_rejoin_pos = 1,
  projected_lead_s = 3.8,
  counterfactual_verdict = 'If Ferrari had extended Leclerc by 2 laps to pit under the Lap 20 Safety Car, the 8.7s pit loss discount would have guaranteed a P1 rejoin and a race win.',
  track_data,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const bgScale = interpolate(frame, [0, 1800], [1.0, 1.05]);

  // Scrubbing animation from actual pit lap (18) to Safety Car pit lap (20)
  const currentScrubbedLap = Math.floor(
    interpolate(frame, [240, 800], [actual_pit_lap, simulated_pit_lap], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const isSimulatedPhase = frame >= 600;

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
                color: MURETTO_TOKENS.colors.accentRed,
                letterSpacing: '0.14em',
              }}
            >
              MURETTO WHAT-IF SIMULATOR // POST-RACE AUTOPSY
            </span>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 18,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.titaniumGrey,
              }}
            >
              {team.toUpperCase()} · {circuit.toUpperCase()} GP
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
            DID THE SAFETY CAR COST {driver} THE VICTORY?
          </h1>
        </div>

        {/* 1. REAL TRACK MAP */}
        <DynamicTrackMap
          circuitName={circuit}
          p1Code={driver}
          p1Color={color}
          trackData={track_data}
          activeCorner={`SIMULATING PIT STOP: LAP ${currentScrubbedLap}`}
          totalFrames={1800}
        />

        {/* 2. ANIMATED SLIDER SCRUBBER */}
        <AnimatedSlider
          startLap={actual_pit_lap}
          targetLap={simulated_pit_lap}
          totalLaps={70}
          label={`MURETTO WHAT-IF: MOVING ${driver} PIT STOP`}
        />

        {/* 3. CONTRASTING SCENARIO CARDS */}
        <div style={{ display: 'flex', gap: 14 }}>
          {/* Actual Reality */}
          <div
            style={{
              flex: 1,
              backgroundColor: !isSimulatedPhase ? 'rgba(232,0,45,0.15)' : MURETTO_TOKENS.colors.surface,
              borderRadius: 14,
              border: `1.5px solid ${!isSimulatedPhase ? MURETTO_TOKENS.colors.accentRed : MURETTO_TOKENS.colors.surfaceBorder}`,
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: MURETTO_TOKENS.colors.titaniumGrey }}>
                REALITY: LAP {actual_pit_lap} PIT
              </span>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.accentRed, fontWeight: 700 }}>
                REJOIN P{actual_rejoin_pos}
              </span>
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
              TRAFFIC REJOIN (P{actual_rejoin_pos})
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 13, color: MURETTO_TOKENS.colors.titaniumGrey, marginTop: 4 }}>
              Pit loss: {normal_pit_loss_s}s under green flag.
            </div>
          </div>

          {/* Counterfactual What-If */}
          <div
            style={{
              flex: 1,
              backgroundColor: isSimulatedPhase ? 'rgba(36,227,210,0.15)' : MURETTO_TOKENS.colors.surface,
              borderRadius: 14,
              border: `1.5px solid ${isSimulatedPhase ? MURETTO_TOKENS.colors.telemetryCyan : MURETTO_TOKENS.colors.surfaceBorder}`,
              padding: '14px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>
                WHAT-IF: LAP {safety_car_lap} (SAFETY CAR)
              </span>
              <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.green, fontWeight: 700 }}>
                REJOIN P{simulated_rejoin_pos} (LEAD)
              </span>
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
              PROJECTED RACE WIN (+{projected_lead_s}s)
            </div>
            <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 13, color: MURETTO_TOKENS.colors.green, marginTop: 4 }}>
              Pit loss: {safety_car_pit_loss_s}s (-8.7s cheap pit stop discount).
            </div>
          </div>
        </div>

        {/* 4. VERDICT */}
        <div
          style={{
            backgroundColor: '#090B0E',
            borderRadius: 14,
            border: `1.5px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            padding: '12px 18px',
          }}
        >
          <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 15, color: MURETTO_TOKENS.colors.textPrimary, lineHeight: 1.3 }}>
            <span style={{ color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>MURETTO SIMULATOR VERDICT: </span>
            {counterfactual_verdict}
          </div>
        </div>

        {/* 5. WORD SUBTITLES */}
        <WordHighlightCaptions words={alignment?.words} fallbackText="Did Ferrari pit stop timing cost Leclerc the race victory? Let's run the exact simulation on Muretto." />

        {/* 6. FOOTER */}
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
            PLAY WITH WHAT-IF COUNTERFACTUALS ON
          </span>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 32, fontWeight: 700, color: MURETTO_TOKENS.colors.textPrimary }}>
            murettobox.com/whatif
          </span>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 18, fontWeight: 700, color: MURETTO_TOKENS.colors.accentRed }}>
            LINK IN BIO
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
