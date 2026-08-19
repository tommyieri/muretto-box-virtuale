import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface OnTrackApexCameraProps {
  cornerName: string;
  driverP1: string;
  driverP2: string;
  colorP1: string;
  colorP2: string;
  p1Speed: number;
  p2Speed: number;
  p1Throttle: number;
  p2Throttle: number;
  deltaGain: string;
  freezeFrameStart?: number;
  freezeFrameEnd?: number;
}

export const OnTrackApexCamera: React.FC<OnTrackApexCameraProps> = ({
  cornerName = 'TURN 4 · UPHILL APEX (1450m)',
  driverP1 = 'NOR',
  driverP2 = 'HAM',
  colorP1 = '#FF8000',
  colorP2 = '#E8002D',
  p1Speed = 234,
  p2Speed = 226,
  p1Throttle = 100,
  p2Throttle = 85,
  deltaGain = '-0.124s GAIN IN T4',
  freezeFrameStart = 240,
  freezeFrameEnd = 480,
}) => {
  const frame = useCurrentFrame();

  // Camera scale zoom
  const cameraZoom = interpolate(frame, [0, 600], [1.0, 1.14], {
    extrapolateRight: 'clamp',
  });

  // Micro-pause / freeze logic
  const isFrozen = frame >= freezeFrameStart && frame <= freezeFrameEnd;
  const freezeProgress = interpolate(frame, [freezeFrameStart, freezeFrameStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: 480,
        backgroundColor: '#090B0E',
        borderRadius: 20,
        border: `2px solid ${isFrozen ? MURETTO_TOKENS.colors.telemetryCyan : MURETTO_TOKENS.colors.surfaceBorder}`,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: isFrozen ? `0 0 40px rgba(36, 227, 210, 0.25)` : 'none',
        transition: 'border 0.2s ease',
      }}
    >
      {/* 1. PHOTOREALISTIC ON-TRACK APEX IMAGE */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${cameraZoom})`,
          transformOrigin: '55% 65%',
          position: 'relative',
        }}
      >
        <Img
          src={staticFile('images/hungaroring_turn4_apex.jpg')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Dark vignette overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, rgba(14,17,22,0.7) 0%, rgba(14,17,22,0.1) 40%, rgba(14,17,22,0.85) 100%)',
          }}
        />
      </div>

      {/* 2. ON-SCREEN TRACK PERSPECTIVE HUD */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: isFrozen ? MURETTO_TOKENS.colors.accentRed : MURETTO_TOKENS.colors.telemetryCyan,
              boxShadow: `0 0 12px ${isFrozen ? MURETTO_TOKENS.colors.accentRed : MURETTO_TOKENS.colors.telemetryCyan}`,
            }}
          />
          <span
            style={{
              fontFamily: MURETTO_TOKENS.typography.monospace,
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {isFrozen ? '⏸️ TELEMETRY FREEZE @ APEX' : '🎥 ON-TRACK APEX TRACKING'}
          </span>
        </div>

        <span
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            border: `1px solid ${MURETTO_TOKENS.colors.telemetryCyan}`,
            borderRadius: 6,
            padding: '4px 12px',
            fontFamily: MURETTO_TOKENS.typography.monospace,
            fontSize: 15,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.telemetryCyan,
          }}
        >
          {cornerName}
        </span>
      </div>

      {/* 3. DYNAMIC HUD TELEMETRY OVERLAY AT THE APEX (APPEARS DURING FREEZE) */}
      {isFrozen && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 20,
            right: 20,
            opacity: freezeProgress,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Driver Telemetry Comparison Pills */}
          <div style={{ display: 'flex', gap: 14 }}>
            {/* Driver P1 (Norris) */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'rgba(9, 11, 14, 0.92)',
                border: `1.5px solid ${colorP1}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.8)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colorP1, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 16, fontWeight: 700 }}>
                  ● {driverP1} (POLE)
                </span>
                <span style={{ color: MURETTO_TOKENS.colors.green, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 16, fontWeight: 700 }}>
                  +{p1Speed - p2Speed} KM/H
                </span>
              </div>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 32, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
                {p1Speed} KM/H
              </div>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.green }}>
                {p1Throttle}% THROTTLE (EARLY ONSET)
              </div>
            </div>

            {/* Driver P2 (Hamilton / Verstappen) */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'rgba(9, 11, 14, 0.92)',
                border: `1.5px solid ${colorP2}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.8)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colorP2, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 16, fontWeight: 700 }}>
                  ● {driverP2}
                </span>
                <span style={{ color: MURETTO_TOKENS.colors.titaniumGrey, fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14 }}>
                  P2 (+0.012s)
                </span>
              </div>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 32, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
                {p2Speed} KM/H
              </div>
              <div style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, color: MURETTO_TOKENS.colors.accentRed }}>
                {p2Throttle}% THROTTLE (SNAP LIFT)
              </div>
            </div>
          </div>

          {/* Key Delta Badge */}
          <div
            style={{
              backgroundColor: 'rgba(36, 227, 210, 0.95)',
              borderRadius: 8,
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: MURETTO_TOKENS.typography.display, fontSize: 22, fontWeight: 700, color: '#090B0E' }}>
              📍 {deltaGain} · 1.14M DISTANCE GAP
            </span>
            <span style={{ fontFamily: MURETTO_TOKENS.typography.monospace, fontSize: 14, fontWeight: 700, color: '#090B0E' }}>
              TELEMETRY PROVEN
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
