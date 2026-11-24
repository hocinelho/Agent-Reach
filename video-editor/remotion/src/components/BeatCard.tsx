import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {enter, exit} from '../motion';
import type {Beat, Plan, Theme} from '../types';

const Display: React.FC<{th: Theme; size: number; children: React.ReactNode; color?: string}> = ({
  th,
  size,
  children,
  color,
}) => (
  <div
    style={{
      fontFamily: th.fontDisplay,
      fontStyle: th.displayItalic ? 'italic' : 'normal',
      fontSize: size,
      lineHeight: 1.02,
      color: color ?? th.text,
      letterSpacing: -1,
    }}
  >
    {children}
  </div>
);

const Kicker: React.FC<{th: Theme; children: React.ReactNode}> = ({th, children}) => (
  <div
    style={{
      fontFamily: th.fontMono,
      fontSize: 26,
      letterSpacing: 4,
      textTransform: 'uppercase',
      color: th.accent,
      marginBottom: 18,
    }}
  >
    {children}
  </div>
);

const Card: React.FC<{th: Theme; style?: React.CSSProperties; active?: boolean; children: React.ReactNode}> = ({
  th,
  style,
  active,
  children,
}) => (
  <div
    style={{
      background: th.card,
      border: `2px solid ${active ? th.accent : th.cardBorder}`,
      borderRadius: th.radius,
      padding: '26px 32px',
      boxShadow: active && th.glow ? `0 0 46px ${th.accent}55` : '0 14px 40px rgba(0,0,0,0.35)',
      ...style,
    }}
  >
    {children}
  </div>
);

// Content of the lower panel for one beat. Rendered inside a <Sequence> so frame 0 = beat start.
export const BeatCard: React.FC<{beat: Beat; plan: Plan}> = ({beat, plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const th = plan.theme;
  const len = Math.round((beat.end - beat.start) * fps);
  const out = exit(frame, len, 6);
  const wrap: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 70px',
    opacity: out.opacity,
    filter: out.filter,
  };
  const items = beat.items ?? [];

  switch (beat.type) {
    case 'list': {
      const span = Math.max(1, len * 0.55);
      return (
        <div style={wrap}>
          <div style={enter(frame, fps, 0)}>
            {beat.kicker && <Kicker th={th}>{beat.kicker}</Kicker>}
            {beat.title && <Display th={th} size={78}>{beat.title}</Display>}
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 34}}>
            {items.map((it, i) => {
              const at = 6 + Math.round((i * span) / Math.max(1, items.length));
              const nextAt = 6 + Math.round(((i + 1) * span) / Math.max(1, items.length));
              const active = frame >= at && (i === items.length - 1 || frame < nextAt);
              return (
                <Card key={i} th={th} active={active} style={{...enter(frame, fps, at), display: 'flex', gap: 24, alignItems: 'center'}}>
                  <div
                    style={{
                      fontFamily: th.fontMono,
                      fontSize: 28,
                      color: th.bg,
                      background: th.accent,
                      borderRadius: 12,
                      minWidth: 52,
                      height: 52,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{fontFamily: th.fontBody, fontWeight: 700, fontSize: 44, color: th.text}}>{it}</div>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }
    case 'stat': {
      const p = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'});
      return (
        <div style={{...wrap, alignItems: 'center', textAlign: 'center'}}>
          {beat.kicker && <div style={enter(frame, fps, 0)}><Kicker th={th}>{beat.kicker}</Kicker></div>}
          <div style={{...enter(frame, fps, 2), transform: `scale(${0.85 + 0.15 * p})`}}>
            <Display th={th} size={260} color={th.accent}>{beat.value}</Display>
          </div>
          {beat.title && (
            <div style={{...enter(frame, fps, 8), fontFamily: th.fontBody, fontWeight: 700, fontSize: 48, color: th.text, marginTop: 10}}>
              {beat.title}
            </div>
          )}
        </div>
      );
    }
    case 'quote':
      return (
        <div style={wrap}>
          <div style={{...enter(frame, fps, 0), fontFamily: th.fontDisplay, fontSize: 200, color: th.accent, height: 120, lineHeight: 1}}>“</div>
          <div style={enter(frame, fps, 4)}>
            <Display th={th} size={84}>{beat.title}</Display>
          </div>
          {beat.subtitle && (
            <div style={{...enter(frame, fps, 10), fontFamily: th.fontMono, fontSize: 30, color: th.muted, marginTop: 26}}>— {beat.subtitle}</div>
          )}
        </div>
      );
    case 'compare': {
      const [a, b] = [items[0] ?? '', items[1] ?? ''];
      return (
        <div style={wrap}>
          {beat.title && <div style={enter(frame, fps, 0)}><Display th={th} size={72}>{beat.title}</Display></div>}
          <div style={{display: 'flex', gap: 24, marginTop: 34}}>
            <Card th={th} style={{...enter(frame, fps, 6), flex: 1, opacity: 0.7}}>
              <div style={{fontSize: 54, color: th.muted}}>✕</div>
              <div style={{fontFamily: th.fontBody, fontWeight: 700, fontSize: 40, color: th.muted, textDecoration: 'line-through'}}>{a}</div>
            </Card>
            <Card th={th} active style={{...enter(frame, fps, 14), flex: 1}}>
              <div style={{fontSize: 54, color: th.accent}}>✓</div>
              <div style={{fontFamily: th.fontBody, fontWeight: 700, fontSize: 40, color: th.text}}>{b}</div>
            </Card>
          </div>
        </div>
      );
    }
    case 'cta':
      return (
        <div style={{...wrap, alignItems: 'center', textAlign: 'center'}}>
          <div style={enter(frame, fps, 0)}><Display th={th} size={96}>{beat.title}</Display></div>
          {beat.subtitle && (
            <div
              style={{
                ...enter(frame, fps, 8),
                marginTop: 36,
                background: th.accent,
                color: th.bg,
                fontFamily: th.fontBody,
                fontWeight: 900,
                fontSize: 44,
                padding: '20px 44px',
                borderRadius: 999,
                boxShadow: th.glow ? `0 0 60px ${th.accent}88` : undefined,
              }}
            >
              {beat.subtitle}
            </div>
          )}
        </div>
      );
    case 'title':
    default:
      return (
        <div style={wrap}>
          <div style={enter(frame, fps, 0)}>
            {beat.kicker && <Kicker th={th}>{beat.kicker}</Kicker>}
            <Display th={th} size={104}>{beat.title}</Display>
          </div>
          {beat.subtitle && (
            <div style={{...enter(frame, fps, 7), fontFamily: th.fontBody, fontSize: 42, color: th.muted, marginTop: 24}}>{beat.subtitle}</div>
          )}
        </div>
      );
  }
};

// Big title floating over the full-screen face during the hook.
export const HookOverlay: React.FC<{beat: Beat; plan: Plan}> = ({beat, plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const th = plan.theme;
  const len = Math.round((beat.end - beat.start) * fps);
  const out = exit(frame, len, 6);
  return (
    <div
      style={{
        position: 'absolute',
        top: 150,
        left: 60,
        right: 60,
        textAlign: 'center',
        opacity: out.opacity,
        filter: out.filter,
          }}
    >
      {beat.kicker && <div style={enter(frame, fps, 0)}><Kicker th={th}>{beat.kicker}</Kicker></div>}
      <div style={{...enter(frame, fps, 3), textShadow: '0 6px 40px rgba(0,0,0,0.7)'}}>
        <Display th={th} size={120}>{beat.title}</Display>
      </div>
      {beat.subtitle && (
        <div
          style={{
            ...enter(frame, fps, 9),
            display: 'inline-block',
            marginTop: 22,
            padding: '10px 26px',
            borderRadius: 999,
            border: `2px solid ${th.accent}`,
            background: 'rgba(0,0,0,0.45)',
            fontFamily: th.fontMono,
            fontSize: 30,
            color: th.text,
          }}
        >
          {beat.subtitle}
        </div>
      )}
    </div>
  );
};
