// The edit plan: produced by ve.py (+ Claude), consumed by <Reel/>.
// All times are in seconds on the OUTPUT timeline (after silence cuts).

export type Word = {w: string; s: number; e: number};

export type Segment = {
  // a kept piece of the source video, in source seconds
  from: number;
  to: number;
};

export type BeatType = 'hook' | 'title' | 'list' | 'stat' | 'quote' | 'compare' | 'cta';

export type Beat = {
  start: number;
  end: number;
  type: BeatType;
  step?: number; // shows "STEP n/N" + progress bar when set
  kicker?: string; // small label above the title
  title?: string;
  subtitle?: string;
  items?: string[]; // list / compare (two items: left|right)
  value?: string; // stat
  sfx?: string | null; // override; null = silent
};

export type Theme = {
  name: string;
  bg: string; // panel background
  bg2: string; // gradient end
  accent: string;
  text: string;
  muted: string;
  card: string; // card fill
  cardBorder: string;
  captionBg: string;
  captionText: string;
  captionHighlight: string;
  fontDisplay: string; // titles (e.g. serif italic)
  fontBody: string; // captions / UI
  fontMono: string; // labels
  displayItalic: boolean;
  stepLabel: string; // "STEP", "ÉTAPE", "المرحلة"
  radius: number;
  glow: boolean;
};

export type Plan = {
  src: string; // file in public/, e.g. "projects/demo/input.mp4"
  fps: number;
  width: number;
  height: number;
  durationInSeconds: number;
  segments: Segment[];
  words: Word[];
  beats: Beat[];
  totalSteps: number;
  highlight: string[]; // words drawn in accent in captions (lowercase)
  captionWords: number; // max words per caption card
  rtl: boolean; // Arabic captions
  theme: Theme;
  music?: string | null; // file in public/
  musicVolume: number;
  sfxVolume: number;
  faceZoom: number; // 1 = no crop zoom
};
