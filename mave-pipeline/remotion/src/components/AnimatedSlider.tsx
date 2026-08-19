import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface AnimatedSliderProps {
  startLap?: number;
  targetLap?: number;
  endLap?: number;
  totalLaps?: number;
  statusText?: string;
  isCleanAir?: boolean;
  label?: string;
}

export const AnimatedSlider: React.FC<AnimatedSliderProps> = ({
  startLap = 18,
  targetLap,
  endLap,
  totalLaps = 70,
  statusText,
  isCleanAir = true,
  label = 'SIMULATED PIT STOP LAP',
}) => {
  const frame = useCurrentFrame();

  const effectiveStart = typeof startLap === 'number' && !isNaN(startLap) ? startLap : 18;
  const effectiveTarget = typeof targetLap === 'number' && !isNaN(targetLap)
    ? targetLap
    : (typeof endLap === 'number' && !isNaN(endLap) ? endLap : 24);

  // Scrubbing animation over frame 120 to 600 (2s to 10s)
  const currentLap = Math.round(
    interpolate(frame, [120, 600], [effectiveStart, effectiveTarget], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const progress = Math.min(1, Math.max(0, currentLap / totalLaps));
  const statusColor = isCleanAir ? MURETTO_TOKENS.colors.green : MURETTO_TOKENS.colors.accentRed;

  return (
    <div
      style={{
        backgroundColor: MURETTO_TOKENS.colors.surface,
        borderRadius: 16,
        border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
        padding: '16px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span
            style={{
              fontFamily: MURETTO_TOKENS.typography.monospace,
              fontSize: 13,
              fontWeight: 700,
              color: MURETTO_TOKENS.colors.titaniumGrey,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
          <div
            style={{
              fontFamily: MURETTO_TOKENS.typography.display,
              fontSize: 40,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            LAP {currentLap}
            <span style={{ fontSize: 18, color: MURETTO_TOKENS.colors.titaniumGrey, marginLeft: 8 }}>
              / {totalLaps}
            </span>
          </div>
        </div>

        {statusText && (
          <div
            style={{
              backgroundColor: isCleanAir ? 'rgba(0, 229, 117, 0.15)' : 'rgba(232, 0, 45, 0.15)',
              border: `1px solid ${statusColor}`,
              borderRadius: 8,
              padding: '6px 14px',
              fontFamily: MURETTO_TOKENS.typography.monospace,
              fontSize: 13,
              fontWeight: 700,
              color: statusColor,
            }}
          >
            {statusText}
          </div>
        )}
      </div>

      {/* THE SLIDER TRACK */}
      <div
        style={{
          width: '100%',
          height: 10,
          backgroundColor: '#090B0E',
          borderRadius: 5,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Filled active range */}
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: MURETTO_TOKENS.colors.telemetryCyan,
            borderRadius: 5,
            boxShadow: `0 0 10px ${MURETTO_TOKENS.colors.telemetryCyan}`,
          }}
        />

        {/* Scrubbing Thumb */}
        <div
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: `3px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            boxShadow: `0 0 14px #FFFFFF`,
          }}
        />
      </div>
    </div>
  );
};
