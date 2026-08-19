import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';
import { MultiChannelTelemetry, TelemetryGridProps } from '../components/MultiChannelTelemetry';
import { DynamicTrackMap } from '../components/DynamicTrackMap';
import { MiniSectorsTracker } from '../components/MiniSectorsTracker';
import { TechnicalCornerInsight } from '../components/TechnicalCornerInsight';
import { WordHighlightCaptions } from '../components/WordHighlightCaptions';

export interface QualiForensicsProps {
  circuit?: string;
  driver_p1?: {
    code: string;
    team: string;
    lap_time: string;
    color: string;
  };
  driver_p2?: {
    code: string;
    team: string;
    lap_time: string;
    color: string;
  };
  delta_final?: string;
  track_data?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  verified_telemetry_metrics?: {
    main_straight_top_speed?: { p1_kmh: number; p2_kmh: number; delta_kmh: number; advantage_driver: string; analysis: string };
    turn_1_braking_and_apex?: { corner_name: string; p1_apex_kmh: number; p2_apex_kmh: number; delta_kmh: number; analysis: string };
    turn_4_uphill_high_speed?: { corner_name: string; p1_apex_kmh: number; p2_apex_kmh: number; delta_kmh: number; analysis: string };
    turn_11_downhill_sweep?: { corner_name: string; p1_apex_kmh: number; p2_apex_kmh: number; delta_kmh: number; analysis: string };
  };
  telemetry_grid?: TelemetryGridProps;
  alignment?: {
    words: Array<{ word: string; start: number; end: number }>;
  };
}

export const QualiForensicsVideo: React.FC<QualiForensicsProps> = ({
  circuit = 'Ungheria',
  driver_p1 = {
    code: 'NOR',
    team: 'McLaren',
    lap_time: '1:17.207',
    color: '#FF8000',
  },
  driver_p2 = {
    code: 'HAM',
    team: 'Ferrari',
    lap_time: '1:17.219',
    color: '#E8002D',
  },
  delta_final = '+0.012',
  track_data,
  verified_telemetry_metrics,
  telemetry_grid = {
    distance_m: Array.from({ length: 100 }, (_, i) => i * 43),
    speed_p1: Array.from({ length: 100 }, (_, i) => 220 + 80 * Math.sin(i * 0.2)),
    speed_p2: Array.from({ length: 100 }, (_, i) => 216 + 78 * Math.sin(i * 0.2)),
    throttle_p1: Array.from({ length: 100 }, (_, i) => (i % 20 > 5 ? 100 : 0)),
    throttle_p2: Array.from({ length: 100 }, (_, i) => (i % 20 > 7 ? 100 : 0)),
    brake_p1: Array.from({ length: 100 }, (_, i) => (i % 20 < 5 ? 1 : 0)),
    brake_p2: Array.from({ length: 100 }, (_, i) => (i % 20 < 7 ? 1 : 0)),
  },
  alignment,
}) => {
  const frame = useCurrentFrame();
  const bgScale = interpolate(frame, [0, 1500], [1.0, 1.05]);

  // Dynamic Scene Phases over the 25s (1500 frames)
  let activeCorner = 'TURN 1 (TARZANBOCHT)';
  let cornerInsightProps = {
    cornerName: 'MAIN STRAIGHT & TURN 1',
    metricSpeedDelta: 'HAM +2.0 KM/H TOP (333.0 vs 331.0)',
    metricThrottleDelta: 'HAM +4.1 KM/H APEX (96.7 vs 92.6)',
    cornerTimeGain: '-0.052s TO HAM IN S1',
    technicalReason: 'Ferrari low-drag wing gives straight-line efficiency and strong mechanical front-end bite in T1.',
  };

  if (frame >= 360 && frame < 960) {
    // Sector 2: The decisive high speed Turn 4
    activeCorner = 'TURN 4 · UPHILL SWEEP (DECISIVE)';
    cornerInsightProps = {
      cornerName: 'TURN 4 · UPHILL SWEEP',
      metricSpeedDelta: 'NOR +3.5 KM/H APEX (256.0 vs 252.5)',
      metricThrottleDelta: '100% FULL THROTTLE +0.18s EARLIER',
      cornerTimeGain: '-0.098s GAIN IN S2 (POLE MARGIN)',
      technicalReason: 'McLaren floor aero load allows flat-out curb riding where Ferrari suffers snap understeer.',
    };
  } else if (frame >= 960) {
    // Sector 3: Turn 11 & Final Line
    activeCorner = 'SECTOR 3 · THE LINE (+0.012s)';
    cornerInsightProps = {
      cornerName: 'TURN 11 & FINAL CAROUSEL',
      metricSpeedDelta: 'HAM +4.9 KM/H IN T11 (226.0 vs 221.1)',
      metricThrottleDelta: 'POLE TIME: 1:17.207 vs 1:17.219',
      cornerTimeGain: '+0.012s (12 MILLISECONDS POLE GAP)',
      technicalReason: 'Hamilton claws back time in T11, but Norris carries enough S2 delta across the finish line.',
    };
  }

  return (
    <AbsoluteFill style={{ backgroundColor: MURETTO_TOKENS.colors.bgDark, overflow: 'hidden' }}>
      {/* 1. CINEMATIC AI PIT WALL BACKGROUND LAYER */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})`, opacity: 0.16, filter: 'blur(3px)' }}>
        <Img src={staticFile('images/f1_pitwall_ai_bg.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>

      {/* 2. AUDIO VOICEOVER */}
      <Audio src={staticFile('audio/voiceover.mp3')} />

      {/* 3. MAIN UI CONTENT (SAFE ZONE ALIGNED) */}
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
              QUALIFYING FORENSICS // Q3 POLE DUEL
            </span>
            <span
              style={{
                fontFamily: MURETTO_TOKENS.typography.monospace,
                fontSize: 18,
                fontWeight: 700,
                color: MURETTO_TOKENS.colors.titaniumGrey,
              }}
            >
              POLE DELTA: {delta_final}s (12ms)
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
            {driver_p1.code} VS {driver_p2.code}: WHERE POLE WAS WON
          </h1>
        </div>

        {/* 1. DYNAMIC SINGLE FLYING LAP RADAR MAP WITH DUAL DOTS */}
        <DynamicTrackMap
          circuitName={circuit}
          p1Code={driver_p1.code}
          p1Color={driver_p1.color}
          p2Code={driver_p2.code}
          p2Color={driver_p2.color}
          trackData={track_data}
          activeCorner={activeCorner}
          totalFrames={1500}
        />

        {/* 2. DYNAMIC 25 MINI-SECTORS TRACKER (F1 OFFICIAL COLORS: PURPLE, GREEN, YELLOW) */}
        <MiniSectorsTracker
          driverP1Code={driver_p1.code}
          driverP2Code={driver_p2.code}
          totalFrames={1500}
        />

        {/* 3. DYNAMIC TECHNICAL CORNER INSIGHT (CHANGES ACROSS S1, S2, S3) */}
        <TechnicalCornerInsight
          cornerName={cornerInsightProps.cornerName}
          metricSpeedDelta={cornerInsightProps.metricSpeedDelta}
          metricThrottleDelta={cornerInsightProps.metricThrottleDelta}
          cornerTimeGain={cornerInsightProps.cornerTimeGain}
          technicalReason={cornerInsightProps.technicalReason}
          driverP1={driver_p1.code}
          driverP2={driver_p2.code}
          colorP1={driver_p1.color}
          colorP2={driver_p2.color}
          showFrameStart={0}
        />

        {/* 4. MULTI-CHANNEL TELEMETRY */}
        <MultiChannelTelemetry
          telemetry={telemetry_grid}
          colorP1={driver_p1.color}
          colorP2={driver_p2.color}
          codeP1={driver_p1.code}
          codeP2={driver_p2.code}
        />

        {/* 5. WORD SUBTITLES */}
        <WordHighlightCaptions words={alignment?.words} fallbackText="Separated by just 12 milliseconds: Norris versus Hamilton telemetry breakdown." />

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
            COMPARE FULL TELEMETRY ON
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
