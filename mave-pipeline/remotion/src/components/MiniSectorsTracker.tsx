import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export type SectorColor = 'purple' | 'green' | 'yellow' | 'pending';

export interface MiniSectorsTrackerProps {
  totalMiniSectors?: number;
  driverP1Code?: string;
  driverP2Code?: string;
  p1MiniSectors?: SectorColor[];
  p2MiniSectors?: SectorColor[];
  totalFrames?: number;
}

const COLOR_MAP: Record<SectorColor, string> = {
  purple: '#BD53ED', // Session best / overall fastest
  green: '#00E575',  // Personal improvement
  yellow: '#FFE600', // Slower / no improvement
  pending: '#1F2937', // Not reached yet
};

export const MiniSectorsTracker: React.FC<MiniSectorsTrackerProps> = ({
  totalMiniSectors = 25,
  driverP1Code = 'NOR',
  driverP2Code = 'HAM',
  p1MiniSectors = [
    'green', 'green', 'green', 'green', 'green', 'green', 'green', 'green',
    'purple', 'purple', 'purple', 'purple', 'purple', 'purple', 'purple', 'purple', 'green',
    'green', 'green', 'green', 'green', 'green', 'green', 'purple', 'purple'
  ],
  p2MiniSectors = [
    'purple', 'purple', 'purple', 'green', 'green', 'green', 'green', 'green',
    'green', 'yellow', 'green', 'green', 'green', 'green', 'green', 'green', 'purple',
    'green', 'green', 'purple', 'green', 'green', 'purple', 'green', 'green'
  ],
  totalFrames = 1500,
}) => {
  const frame = useCurrentFrame();

  // Progress of current lap (0 to 25 mini sectors)
  const currentMiniSector = Math.floor(
    interpolate(frame, [0, totalFrames], [0, totalMiniSectors], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: MURETTO_TOKENS.colors.surface,
        borderRadius: 14,
        border: `1px solid ${MURETTO_TOKENS.colors.surfaceBorder}`,
        padding: '12px 18px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* HEADER & LEGEND */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 14,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.telemetryCyan,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ⏱️ 25 MINI-SECTOR TRACKER
        </span>

        {/* F1 COLOR LEGEND */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#BD53ED' }} />
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 11, color: '#BD53ED' }}>OVERALL BEST</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#00E575' }} />
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 11, color: '#00E575' }}>PERSONAL BEST</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#FFE600' }} />
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 11, color: '#FFE600' }}>NO IMPROV</span>
          </div>
        </div>
      </div>

      {/* DRIVER P1 ROW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 42,
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 13,
            fontWeight: 700,
            color: '#FF8000',
          }}
        >
          {driverP1Code}
        </span>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {Array.from({ length: totalMiniSectors }).map((_, idx) => {
            const isCompleted = idx <= currentMiniSector;
            const secColor = isCompleted ? (p1MiniSectors[idx] || 'green') : 'pending';
            const bg = COLOR_MAP[secColor];
            return (
              <div
                key={`p1-mini-${idx}`}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: bg,
                  boxShadow: isCompleted && secColor === 'purple' ? '0 0 6px #BD53ED' : 'none',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* DRIVER P2 ROW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 42,
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 13,
            fontWeight: 700,
            color: '#E8002D',
          }}
        >
          {driverP2Code}
        </span>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {Array.from({ length: totalMiniSectors }).map((_, idx) => {
            const isCompleted = idx <= currentMiniSector;
            const secColor = isCompleted ? (p2MiniSectors[idx] || 'green') : 'pending';
            const bg = COLOR_MAP[secColor];
            return (
              <div
                key={`p2-mini-${idx}`}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: bg,
                  boxShadow: isCompleted && secColor === 'purple' ? '0 0 6px #BD53ED' : 'none',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
