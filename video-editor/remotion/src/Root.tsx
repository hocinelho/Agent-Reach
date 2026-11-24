import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/900.css';
import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {defaultPlan} from './defaultPlan';
import type {Plan} from './types';

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel as unknown as React.FC<Record<string, unknown>>}
    defaultProps={defaultPlan as unknown as Record<string, unknown>}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={300}
    calculateMetadata={({props}) => {
      const p = props as unknown as Plan;
      return {
        fps: p.fps,
        width: p.width,
        height: p.height,
        durationInFrames: Math.max(1, Math.round(p.durationInSeconds * p.fps)),
      };
    }}
  />
);
