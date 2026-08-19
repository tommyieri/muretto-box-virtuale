import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface DynamicTrackMapProps {
  circuitName: string;
  p1Code: string;
  p1Color: string;
  p2Code?: string;
  p2Color?: string;
  activeCorner?: string;
  trackData?: {
    viewBox: number[];
    punti: Array<[number, number]>;
    pitlane?: { punti: Array<[number, number]> };
  };
  totalFrames?: number;
}

export const DynamicTrackMap: React.FC<DynamicTrackMapProps> = ({
  circuitName,
  p1Code,
  p1Color,
  p2Code = 'HAM',
  p2Color = '#E8002D',
  activeCorner,
  trackData,
  totalFrames = 1500,
}) => {
  const frame = useCurrentFrame();

  const rawPunti = trackData?.punti || [
    [180, 340], [120, 220], [190, 100], [480, 100], [620, 230],
    [520, 320], [280, 430], [420, 520], [660, 650], [480, 780],
    [220, 780], [80, 640], [180, 340]
  ];

  const vb = trackData?.viewBox || [0, 0, 1000, 1000];
  const minX = vb[0];
  const minY = vb[1];
  const vbW = vb[2] - vb[0];
  const vbH = vb[3] - vb[1];

  const polylineStr = rawPunti.map(([x, y]) => `${x},${y}`).join(' ');

  // EXACT SINGLE FLYING LAP PROGRESSION (0.0 to 1.0 from start to finish)
  const lapProgressP1 = interpolate(frame, [0, totalFrames], [0.0, 0.999], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // P2 trailing slightly behind on the metric line (offset by 0.004 of a lap ~ 18m)
  const lapProgressP2 = Math.max(0, lapProgressP1 - 0.005);

  const nPts = rawPunti.length;

  // Car 1 coordinates
  const idx1 = Math.min(nPts - 2, Math.floor(lapProgressP1 * (nPts - 1)));
  const sub1 = (lapProgressP1 * (nPts - 1)) - idx1;
  const p1Cur = rawPunti[idx1] || rawPunti[0];
  const p1Next = rawPunti[idx1 + 1] || p1Cur;
  const car1X = p1Cur[0] + (p1Next[0] - p1Cur[0]) * sub1;
  const car1Y = p1Cur[1] + (p1Next[1] - p1Cur[1]) * sub1;

  // Car 2 coordinates
  const idx2 = Math.min(nPts - 2, Math.floor(lapProgressP2 * (nPts - 1)));
  const sub2 = (lapProgressP2 * (nPts - 1)) - idx2;
  const p2Cur = rawPunti[idx2] || rawPunti[0];
  const p2Next = rawPunti[idx2 + 1] || p2Cur;
  const car2X = p2Cur[0] + (p2Next[0] - p2Cur[0]) * sub2;
  const car2Y = p2Cur[1] + (p2Next[1] - p2Cur[1]) * sub2;

  return (
    <div
      style={{
        width: '100%',
        height: 280,
        backgroundColor: MURETTO_TOKENS.colors.surface,
        borderRadius: 16,
        border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '14px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* HEADER WITH REAL GPS STATUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: MURETTO_TOKENS.colors.telemetryCyan,
              display: 'inline-block',
              boxShadow: `0 0 10px ${MURETTO_TOKENS.colors.telemetryCyan}`,
            }}
          />
          <span
            style={{
              fontFamily: MURETTO_TOKENS.typography.monospace,
              fontSize: 16,
              fontWeight: 700,
              color: MURETTO_TOKENS.colors.telemetryCyan,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {circuitName} · LIVE GPS TRACK RADAR (Q3)
          </span>
        </div>

        {activeCorner && (
          <span
            style={{
              fontFamily: MURETTO_TOKENS.typography.display,
              fontSize: 20,
              fontWeight: 700,
              color: MURETTO_TOKENS.colors.accentRed,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {activeCorner}
          </span>
        )}
      </div>

      {/* SVG REAL CIRCUIT GEOMETRY */}
      <svg
        width="100%"
        height="210"
        viewBox={`${minX - 50} ${minY - 50} ${vbW + 100} ${vbH + 100}`}
        style={{ margin: 'auto' }}
      >
        {/* Glow */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="#1A2433"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Main asphalt */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="#2B3648"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Centerline */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="#3D4D66"
          strokeWidth="3"
          strokeDasharray="8 8"
        />

        {/* Start-Finish Line */}
        {rawPunti[0] && (
          <circle cx={rawPunti[0][0]} cy={rawPunti[0][1]} r="6" fill="#FFFFFF" />
        )}

        {/* DRIVER P2 DOT (Ferrari Red / Blue) */}
        <circle cx={car2X} cy={car2Y} r="22" fill={p2Color} fillOpacity="0.25" />
        <circle cx={car2X} cy={car2Y} r="14" fill={p2Color} stroke="#FFFFFF" strokeWidth="3" />
        <rect
          x={car2X - 54}
          y={car2Y - 14}
          width="48"
          height="24"
          rx="4"
          fill="#090B0E"
          stroke={p2Color}
          strokeWidth="1.2"
        />
        <text
          x={car2X - 30}
          y={car2Y + 3}
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily={MURETTO_TOKENS.typography.monospace}
          fontSize="14"
          fontWeight="700"
        >
          {p2Code}
        </text>

        {/* DRIVER P1 DOT (Papaya / Pole) */}
        <circle cx={car1X} cy={car1Y} r="26" fill={p1Color} fillOpacity="0.3" />
        <circle cx={car1X} cy={car1Y} r="16" fill={p1Color} stroke="#FFFFFF" strokeWidth="3.5" />
        <rect
          x={car1X + 18}
          y={car1Y - 16}
          width="50"
          height="26"
          rx="4"
          fill="#090B0E"
          stroke={p1Color}
          strokeWidth="1.5"
        />
        <text
          x={car1X + 43}
          y={car1Y + 3}
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily={MURETTO_TOKENS.typography.monospace}
          fontSize="15"
          fontWeight="700"
        >
          {p1Code}
        </text>
      </svg>
    </div>
  );
};
