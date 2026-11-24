import React from 'react';
import type {Theme} from '../types';

// Segmented progress bar + "STEP n/N" label, shown while a numbered beat is on screen.
export const StepHeader: React.FC<{step: number; total: number; th: Theme; top: number; visible: number; fill: number}> = ({
  step,
  fill,
  total,
  th,
  top,
  visible,
}) => {
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top, opacity: visible}}>
      <div style={{display: 'flex', gap: 10}}>
        {Array.from({length: total}).map((_, i) => (
          <div key={i} style={{flex: 1, height: 6, borderRadius: 3, background: `${th.muted}55`, overflow: 'hidden'}}>
            <div
              style={{
                height: '100%',
                width: i < step - 1 ? '100%' : i === step - 1 ? `${fill * 100}%` : '0%',
                background: th.accent,
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          textAlign: 'right',
          fontFamily: th.fontMono,
          fontSize: 24,
          letterSpacing: 4,
          color: th.accent,
        }}
      >
        {th.stepLabel} {step}/{total}
      </div>
    </div>
  );
};
