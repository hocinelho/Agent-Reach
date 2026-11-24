import {interpolate, spring} from 'remotion';

// House motion: blur 6→0, scale 0.96→1 and fade-in over ~6 frames, with no bounce.
export const enter = (frame: number, fps: number, delay = 0, dur = 7) => {
  const f = frame - delay;
  const p = spring({frame: f, fps, config: {damping: 200, mass: 0.6}, durationInFrames: dur});
  return {
    opacity: interpolate(f, [0, dur * 0.7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    filter: `blur(${interpolate(p, [0, 1], [6, 0])}px)`,
    transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`,
  } as const;
};

// Fade/blur out over the last `dur` frames before `endFrame`.
export const exit = (frame: number, endFrame: number, dur = 5) => {
  const t = interpolate(frame, [endFrame - dur, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {opacity: 1 - t, filter: `blur(${t * 6}px)`};
};

export const mergeStyles = (a: Record<string, string | number>, b: Record<string, string | number>) => ({
  ...a,
  ...b,
  filter: [a.filter, b.filter].filter(Boolean).join(' '),
  opacity: (Number(a.opacity ?? 1) * Number(b.opacity ?? 1)) as number,
});
