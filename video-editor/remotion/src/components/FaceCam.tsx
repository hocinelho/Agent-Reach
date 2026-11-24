import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile} from 'remotion';
import type {Plan} from '../types';

// Plays the kept segments back-to-back (silences removed).
// Python aligns segment edges to whole frames so the timeline adds up exactly.
export const FaceCam: React.FC<{plan: Plan; style: React.CSSProperties}> = ({plan, style}) => {
  const {fps} = plan;
  if (!plan.src) {
    return (
      <AbsoluteFill
        style={{...style, background: `linear-gradient(160deg, #444 0%, #222 100%)`}}
      />
    );
  }
  let cursor = 0;
  return (
    <AbsoluteFill style={{...style, overflow: 'hidden'}}>
      {plan.segments.map((seg, i) => {
        const from = Math.round(seg.from * fps);
        const len = Math.max(1, Math.round(seg.to * fps) - from);
        const at = cursor;
        cursor += len;
        return (
          <Sequence key={i} from={at} durationInFrames={len} premountFor={fps}>
            <OffthreadVideo
              src={staticFile(plan.src)}
              startFrom={from}
              endAt={from + len}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${plan.faceZoom})`,
              }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
