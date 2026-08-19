import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface DeltaCounterProps {
  finalDelta: string | number;
  label?: string;
  isPositiveAdvantage?: boolean;
}

export const DeltaCounter: React.FC<DeltaCounterProps> = ({
  finalDelta,
  label = 'DELTA TO POLE',
  isPositiveAdvantage = true,
}) => {
  const frame = useCurrentFrame();

  const numVal = typeof finalDelta === 'number' ? finalDelta : parseFloat(finalDelta.toString().replace('+', ''));
  const currentDelta = interpolate(frame, [0, 60], [0, numVal], {
    extrapolateRight: 'clamp',
  });

  const displayColor = isPositiveAdvantage ? MURETTO_TOKENS.colors.telemetryCyan : MURETTO_TOKENS.colors.accentRed;

  return (
    <div
      style={{
        backgroundColor: MURETTO_TOKENS.colors.surface,
        borderRadius: 14,
        border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 14,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.titaniumGrey,
            letterSpacing: '0.12em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: MURETTO_TOKENS.typography.display,
            fontSize: 48,
            fontWeight: 700,
            color: displayColor,
            letterSpacing: '0.02em',
            lineHeight: 1.1,
            marginTop: 4,
          }}
        >
          {currentDelta >= 0 ? `+${currentDelta.toFixed(3)}s` : `${currentDelta.toFixed(3)}s`}
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#090B0E',
          borderRadius: 8,
          border: `1px solid ${displayColor}`,
          padding: '8px 16px',
          fontFamily: MURETTO_TOKENS.typography.monospace,
          fontSize: 16,
          fontWeight: 700,
          color: displayColor,
          letterSpacing: '0.08em',
        }}
      >
        TELEMETRY VERIFIED
      </div>
    </div>
  );
};
