import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BeatCard, HookOverlay} from './components/BeatCard';
import {Captions} from './components/Captions';
import {FaceCam} from './components/FaceCam';
import {StepHeader} from './components/StepHeader';
import type {Beat, Plan} from './types';

const SPLIT = 0.46; // share of the height the face takes when a card is on screen
const RAMP = 0.3; // seconds for the face to shrink / grow

// Merge card beats separated by short gaps so the layout does not bounce between them.
const panelSpans = (beats: Beat[]) => {
  const spans: {start: number; end: number}[] = [];
  beats
    .filter((b) => b.type !== 'hook')
    .sort((a, b) => a.start - b.start)
    .forEach((b) => {
      const last = spans[spans.length - 1];
      if (last && b.start - last.end < 0.8) last.end = Math.max(last.end, b.end);
      else spans.push({start: b.start, end: b.end});
    });
  return spans;
};

const defaultSfx = (b: Beat, prev?: Beat) => {
  if (b.sfx !== undefined) return b.sfx;
  if (b.type === 'hook') return 'sfx/riser.wav';
  if (b.step && b.step !== prev?.step) return 'sfx/whoosh.wav';
  if (b.type === 'stat' || b.type === 'cta') return 'sfx/ding.wav';
  return 'sfx/pop.wav';
};

export const Reel: React.FC<Plan> = (plan) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = frame / fps;
  const th = plan.theme;
  const spans = useMemo(() => panelSpans(plan.beats), [plan.beats]);
  const beats = useMemo(() => [...plan.beats].sort((a, b) => a.start - b.start), [plan.beats]);

  const split = Math.max(
    0,
    ...spans.map((s) =>
      Math.min(
        interpolate(t, [s.start - RAMP * 0.5, s.start + RAMP * 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)}),
        interpolate(t, [s.end - RAMP * 0.5, s.end + RAMP * 0.5], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)}),
      ),
    ),
  );
  const faceH = interpolate(split, [0, 1], [height, height * SPLIT]);
  const captionTop = interpolate(split, [0, 1], [height * 0.74, faceH]);

  const active = beats.find((b) => b.type !== 'hook' && t >= b.start && t < b.end);
  const stepBeat = active?.step ? active : undefined;
  const stepFill = stepBeat ? interpolate(t, [stepBeat.start, stepBeat.start + 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;

  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${th.bg} 0%, ${th.bg2} 100%)`}}>
      {/* soft accent glow behind the panel */}
      {th.glow && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 70% 30% at 50% 78%, ${th.accent}22 0%, transparent 70%)`,
            opacity: split,
          }}
        />
      )}

      {/* lower panel cards */}
      <div style={{position: 'absolute', left: 0, right: 0, top: faceH, bottom: 0}}>
        {beats
          .filter((b) => b.type !== 'hook')
          .map((b, i) => (
            <Sequence key={i} from={Math.round(b.start * fps)} durationInFrames={Math.max(1, Math.round((b.end - b.start) * fps))} layout="none">
              <div style={{position: 'absolute', inset: 0, top: 130, bottom: 90}}>
                <BeatCard beat={b} plan={plan} />
              </div>
            </Sequence>
          ))}
      </div>

      {/* face cam */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: faceH,
          overflow: 'hidden',
          borderBottomLeftRadius: 40 * split,
          borderBottomRightRadius: 40 * split,
          boxShadow: split > 0 ? `0 20px 60px rgba(0,0,0,${0.5 * split})` : undefined,
        }}
      >
        <FaceCam plan={plan} style={{}} />
        {/* bottom fade so captions stay readable on full-screen face */}
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 60%, rgba(0,0,0,0.55) 100%)'}} />
      </div>

      {/* hook titles over the face */}
      {beats
        .filter((b) => b.type === 'hook')
        .map((b, i) => (
          <Sequence key={`h${i}`} from={Math.round(b.start * fps)} durationInFrames={Math.max(1, Math.round((b.end - b.start) * fps))} layout="none">
            <HookOverlay beat={b} plan={plan} />
          </Sequence>
        ))}

      {stepBeat && plan.totalSteps > 0 && (
        <StepHeader step={stepBeat.step!} total={plan.totalSteps} th={th} top={faceH + 70} visible={split} fill={stepFill} />
      )}

      <Captions plan={plan} top={captionTop} />

      {/* sound */}
      {beats.map((b, i) => {
        const sfx = defaultSfx(b, beats[i - 1]);
        if (!sfx) return null;
        return (
          <Sequence key={`s${i}`} from={Math.max(0, Math.round(b.start * fps) - 2)} durationInFrames={fps * 2} layout="none">
            <Audio src={staticFile(sfx)} volume={plan.sfxVolume} />
          </Sequence>
        );
      })}
      {plan.music && <Audio src={staticFile(plan.music)} volume={plan.musicVolume} loop />}
    </AbsoluteFill>
  );
};
