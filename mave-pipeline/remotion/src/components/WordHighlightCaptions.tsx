import React from 'react';
import { useCurrentFrame } from 'remotion';
import { MURETTO_TOKENS } from '../styles/tokens';

export interface AlignmentWord {
  word: string;
  start: number;
  end: number;
}

export interface WordHighlightCaptionsProps {
  words?: AlignmentWord[];
  fallbackText?: string;
  fps?: number;
}

export const WordHighlightCaptions: React.FC<WordHighlightCaptionsProps> = ({
  words = [],
  fallbackText = '',
  fps = 60,
}) => {
  const frame = useCurrentFrame();
  const currentTimeS = frame / fps;

  if (!words.length && fallbackText) {
    return (
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontFamily: MURETTO_TOKENS.typography.display,
            fontSize: 36,
            fontWeight: 700,
            color: MURETTO_TOKENS.colors.textPrimary,
            letterSpacing: '0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          {fallbackText}
        </span>
      </div>
    );
  }

  // Find active 4-6 word chunk around current time
  const activeIndex = words.findIndex(
    (w) => currentTimeS >= w.start && currentTimeS <= w.end
  );

  const chunkStart = Math.max(0, (activeIndex !== -1 ? activeIndex : 0) - 2);
  const chunkEnd = Math.min(words.length, chunkStart + 6);
  const currentChunk = words.slice(chunkStart, chunkEnd);

  return (
    <div
      style={{
        width: '100%',
        textAlign: 'center',
        padding: '0 32px',
        boxSizing: 'border-box',
        minHeight: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px 12px',
        }}
      >
        {currentChunk.map((w, idx) => {
          const isWordActive = currentTimeS >= w.start && currentTimeS <= w.end;
          return (
            <span
              key={idx}
              style={{
                fontFamily: MURETTO_TOKENS.typography.display,
                fontSize: 38,
                fontWeight: 700,
                color: isWordActive ? MURETTO_TOKENS.colors.telemetryCyan : MURETTO_TOKENS.colors.textPrimary,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                backgroundColor: isWordActive ? 'rgba(36, 227, 210, 0.15)' : 'transparent',
                padding: '2px 6px',
                borderRadius: 6,
                transition: 'color 0.1s ease',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
