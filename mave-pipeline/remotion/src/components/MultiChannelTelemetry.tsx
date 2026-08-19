import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface TelemetryGridProps {
  distance_m: number[];
  speed_p1: number[];
  speed_p2: number[];
  throttle_p1: number[];
  throttle_p2: number[];
  brake_p1: number[];
  brake_p2: number[];
}

export interface MultiChannelTelemetryProps {
  telemetry: TelemetryGridProps;
  colorP1: string;
  colorP2: string;
  codeP1: string;
  codeP2: string;
  activeCornerDistance?: number;
}

export const MultiChannelTelemetry: React.FC<MultiChannelTelemetryProps> = ({
  telemetry,
  colorP1,
  colorP2,
  codeP1,
  codeP2,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [20, 200], [0.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const numPoints = Math.max(2, Math.floor(telemetry.distance_m.length * progress));
  const distSlice = telemetry.distance_m.slice(0, numPoints);
  const maxDist = telemetry.distance_m[telemetry.distance_m.length - 1] || 4300;

  const width = 940;
  const speedHeight = 180;
  const throttleHeight = 70;
  const brakeHeight = 60;

  const getSpeedPolyline = (data: number[]) => {
    return distSlice
      .map((d, i) => {
        const x = (d / maxDist) * width;
        const y = speedHeight - ((data[i] - 60) / (340 - 60)) * speedHeight;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getBarPolyline = (data: number[], height: number) => {
    return distSlice
      .map((d, i) => {
        const x = (d / maxDist) * width;
        const y = height - (data[i] / 100) * height;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const currentX = (distSlice[distSlice.length - 1] / maxDist) * width;

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: MURETTO_TOKENS.colors.surface,
        borderRadius: 16,
        border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
        padding: '20px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* 1. SPEED TRACE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span
            style={{
              fontFamily: MURETTO_TOKENS.typography.monospace,
              fontSize: 16,
              fontWeight: 700,
              color: MURETTO_TOKENS.colors.textPrimary,
              letterSpacing: '0.1em',
            }}
          >
            SPEED TRACE (0 – 340 KM/H)
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ color: colorP1, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 16, fontWeight: 700 }}>
              ● {codeP1}
            </span>
            <span style={{ color: colorP2, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 16, fontWeight: 700 }}>
              ● {codeP2}
            </span>
          </div>
        </div>

        <svg width="100%" height={speedHeight} viewBox={`0 0 ${width} ${speedHeight}`} style={{ overflow: 'visible' }}>
          <rect width={width} height={speedHeight} fill="#090B0E" rx="6" />
          <line x1="0" y1={speedHeight / 2} x2={width} y2={speedHeight / 2} stroke={MURETTO_TOKENS.colors.surfaceBorder} strokeWidth="1" strokeDasharray="4 4" />

          {/* Speed trace P2 */}
          <polyline fill="none" stroke={colorP2} strokeWidth="2.5" strokeOpacity="0.75" points={getSpeedPolyline(telemetry.speed_p2)} />
          {/* Speed trace P1 */}
          <polyline fill="none" stroke={colorP1} strokeWidth="4" points={getSpeedPolyline(telemetry.speed_p1)} />

          {/* Cursor line */}
          <line x1={currentX} y1="0" x2={currentX} y2={speedHeight} stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      </div>

      {/* 2. THROTTLE TRACE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.telemetryCyan }}>
            THROTTLE % (GREEN)
          </span>
        </div>
        <svg width="100%" height={throttleHeight} viewBox={`0 0 ${width} ${throttleHeight}`}>
          <rect width={width} height={throttleHeight} fill="#090B0E" rx="6" />
          <polyline fill="none" stroke={colorP2} strokeWidth="2" strokeOpacity="0.6" points={getBarPolyline(telemetry.throttle_p2, throttleHeight)} />
          <polyline fill="none" stroke={MURETTO_TOKENS.colors.telemetryCyan} strokeWidth="3" points={getBarPolyline(telemetry.throttle_p1, throttleHeight)} />
        </svg>
      </div>

      {/* 3. BRAKE TRACE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.accentRed }}>
            BRAKE PRESSURE % (RED)
          </span>
        </div>
        <svg width="100%" height={brakeHeight} viewBox={`0 0 ${width} ${brakeHeight}`}>
          <rect width={width} height={brakeHeight} fill="#090B0E" rx="6" />
          <polyline fill="none" stroke={colorP2} strokeWidth="2" strokeOpacity="0.6" points={getBarPolyline(telemetry.brake_p2.map(b => b * 100), brakeHeight)} />
          <polyline fill="none" stroke={MURETTO_TOKENS.colors.accentRed} strokeWidth="3" points={getBarPolyline(telemetry.brake_p1.map(b => b * 100), brakeHeight)} />
        </svg>
      </div>
    </div>
  );
};
