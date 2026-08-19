import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface TechnicalCornerInsightProps {
  cornerName: string;
  metricSpeedDelta: string;
  metricThrottleDelta: string;
  cornerTimeGain: string;
  technicalReason: string;
  driverP1: string;
  driverP2: string;
  colorP1: string;
  colorP2: string;
  showFrameStart?: number;
}

export const TechnicalCornerInsight: React.FC<TechnicalCornerInsightProps> = ({
  cornerName = 'TURN 4 · FAST UPHILL LEFT',
  metricSpeedDelta = '+6 KM/H MINIMUM APEX SPEED',
  metricThrottleDelta = '100% FULL THROTTLE +0.22s EARLIER',
  cornerTimeGain = '-0.124s GAIN IN T4',
  technicalReason = 'McLaren high-downforce floor & aggressive curb riding without destabilizing aerodynamic platform.',
  driverP1 = 'NOR',
  driverP2 = 'VER',
  colorP1 = '#FF8000',
  colorP2 = '#2B478F',
  showFrameStart = 300,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [showFrameStart, showFrameStart + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(frame, [showFrameStart, showFrameStart + 30], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        backgroundColor: '#090B0E',
        borderRadius: 16,
        border: `1.5px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
        padding: '20px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: `0 8px 32px rgba(36, 227, 210, 0.12)`,
      }}
    >
      {/* CORNER TITLE & GAIN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 16,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.telemetryCyan,
            letterSpacing: '0.12em',
          }}
        >
          🔍 DECISIVE APEX: {cornerName}
        </span>
        <span
          style={{
            backgroundColor: 'rgba(36, 227, 210, 0.15)',
            border: `1px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            borderRadius: 6,
            padding: '4px 12px',
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 16,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.telemetryCyan,
          }}
        >
          {cornerTimeGain}
        </span>
      </div>

      {/* METRIC BADGES */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div
          style={{
            flex: 1,
            backgroundColor: MURETTO_TOKENS.colors.surface,
            borderRadius: 10,
            border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
            padding: '10px 14px',
          }}
        >
          <div style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: MURETTO_TOKENS.colors.titaniumGrey }}>
            APEX SPEED DELTA
          </div>
          <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 26, fontWeight: 700, color: colorP1, marginTop: 2 }}>
            {metricSpeedDelta}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: MURETTO_TOKENS.colors.surface,
            borderRadius: 10,
            border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
            padding: '10px 14px',
          }}
        >
          <div style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 13, color: MURETTO_TOKENS.colors.titaniumGrey }}>
            TRACTION EXIT DELTA
          </div>
          <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 26, fontWeight: 700, color: MURETTO_TOKENS.colors.green, marginTop: 2 }}>
            {metricThrottleDelta}
          </div>
        </div>
      </div>

      {/* TECHNICAL REASONING */}
      <div style={{ fontFamily: MURETTO_TOKENS.typography.body, fontSize: 18, color: MURETTO_TOKENS.colors.textPrimary, lineHeight: 1.3 }}>
        <span style={{ color: MURETTO_TOKENS.colors.telemetryCyan, fontWeight: 700 }}>ENGINEERING VERDICT: </span>
        {technicalReason}
      </div>
    </div>
  );
};
