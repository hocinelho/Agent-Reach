import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enter} from '../motion';
import type {Plan, Word} from '../types';

type Chunk = {words: Word[]; s: number; e: number};

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');

export const chunkWords = (words: Word[], max: number): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({words: cur, s: cur[0].s, e: cur[cur.length - 1].e});
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= max || (prev && w.s - prev.e > 0.35))) flush();
    cur.push(w);
    if (/[.!?،,;:]$/.test(w.w.trim())) flush();
  });
  flush();
  // hold each chunk until the next one starts (if the gap is short)
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i + 1].s - chunks[i].e < 0.4) chunks[i].e = chunks[i + 1].s;
  }
  return chunks;
};

export const Captions: React.FC<{plan: Plan; top: number}> = ({plan, top}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const chunks = useMemo(() => chunkWords(plan.words, plan.captionWords), [plan.words, plan.captionWords]);
  const hl = useMemo(() => new Set(plan.highlight.map((h) => h.toLowerCase())), [plan.highlight]);
  const chunk = chunks.find((c) => t >= c.s - 0.03 && t < c.e + 0.08);
  if (!chunk) return null;
  const th = plan.theme;
  const startFrame = Math.round(chunk.s * fps);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        display: 'flex',
        justifyContent: 'center',
        transform: 'translateY(-50%)',
      }}
    >
      <div
        style={{
          ...enter(frame, fps, startFrame - 2, 5),
          direction: plan.rtl ? 'rtl' : 'ltr',
          background: th.captionBg,
          color: th.captionText,
          fontFamily: plan.rtl ? 'Cairo' : th.fontBody,
          fontWeight: 900,
          fontSize: 66,
          lineHeight: 1.15,
          padding: '14px 30px',
          borderRadius: 18,
          maxWidth: 940,
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          letterSpacing: plan.rtl ? 0 : -1,
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = t >= w.s - 0.02;
          const isHl = hl.has(clean(w.w));
          return (
            <span
              key={i}
              style={{
                color: isHl ? th.captionHighlight : th.captionText,
                opacity: spoken ? 1 : 0.4,
                marginInlineEnd: i < chunk.words.length - 1 ? '0.28em' : 0,
              }}
            >
              {w.w.trim()}
            </span>
          );
        })}
      </div>
    </div>
  );
};
