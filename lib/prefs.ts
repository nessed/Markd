/**
 * Reader preferences. The paper tones are Akada's PAPER_TONES, so a note read
 * here sits on the same page a course does there. Tokens live in globals.css
 * under [data-tone]; this file only owns the names and the stored choice.
 */

export type PaperTone = 'paper' | 'warm' | 'stone' | 'white' | 'night';
export type HeadingFont = 'fraunces' | 'cormorant' | 'lora';
export type TextSize = 'small' | 'medium' | 'large';
export type Measure = 'narrow' | 'wide';

export interface Prefs {
  tone: PaperTone;
  /** True when the tone was never picked, so it follows the system. */
  toneAuto: boolean;
  font: HeadingFont;
  size: TextSize;
  measure: Measure;
}

export const TONES: { v: PaperTone; l: string; swatch: string; edge: string }[] = [
  { v: 'paper', l: 'Paper', swatch: '#F5F1E8', edge: '#C9C0A8' },
  { v: 'warm', l: 'Warm', swatch: '#FAF8F2', edge: '#D7CDB3' },
  { v: 'stone', l: 'Stone', swatch: '#F4F4F1', edge: '#D4D2C8' },
  { v: 'white', l: 'White', swatch: '#FFFFFF', edge: '#DDD8CB' },
  { v: 'night', l: 'Night', swatch: '#1A1815', edge: '#4A4438' },
];

export const FONTS: { v: HeadingFont; l: string; css: string }[] = [
  { v: 'fraunces', l: 'Fraunces', css: 'var(--font-fraunces)' },
  { v: 'cormorant', l: 'Cormorant', css: 'var(--font-cormorant)' },
  { v: 'lora', l: 'Lora', css: 'var(--font-lora)' },
];

export const SIZES: { v: TextSize; l: string }[] = [
  { v: 'small', l: 'Small' },
  { v: 'medium', l: 'Default' },
  { v: 'large', l: 'Large' },
];

export const MEASURES: { v: Measure; l: string }[] = [
  { v: 'narrow', l: 'Narrow' },
  { v: 'wide', l: 'Wide' },
];

export const PREFS_KEY = 'markd:prefs:v2';
const LEGACY_THEME_KEY = 'markd:theme:v1';
const LEGACY_FONT_KEY = 'markd:font:v1';

const pick = <T extends string>(value: unknown, list: { v: T }[], fallback: T): T =>
  list.some((item) => item.v === value) ? (value as T) : fallback;

function systemTone(): PaperTone {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
  } catch {
    return 'paper';
  }
}

export function readPrefs(): Prefs {
  let raw: Partial<Prefs> = {};
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) raw = JSON.parse(stored) ?? {};
    else {
      // Carry over the first draft's two settings.
      const theme = localStorage.getItem(LEGACY_THEME_KEY);
      const size = localStorage.getItem(LEGACY_FONT_KEY);
      if (theme === 'paper' || theme === 'night') raw = { tone: theme, toneAuto: false };
      if (size) raw.size = size as TextSize;
    }
  } catch {
    /* Storage can be blocked; defaults still read fine. */
  }
  const toneAuto = raw.toneAuto !== false || !raw.tone;
  return {
    tone: toneAuto ? systemTone() : pick(raw.tone, TONES, 'paper'),
    toneAuto,
    font: pick(raw.font, FONTS, 'fraunces'),
    size: pick(raw.size, SIZES, 'medium'),
    measure: pick(raw.measure, MEASURES, 'narrow'),
  };
}

export function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Remembered for this visit only. */
  }
}

export function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.tone = prefs.tone;
  root.dataset.theme = prefs.tone === 'night' ? 'night' : 'light';
  const font = FONTS.find((f) => f.v === prefs.font);
  if (font && prefs.font !== 'fraunces') root.style.setProperty('--font-serif', `${font.css}, Georgia, serif`);
  else root.style.removeProperty('--font-serif');
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = TONES.find((t) => t.v === prefs.tone)?.swatch;
  if (meta && bg) meta.setAttribute('content', bg);
}

/** Runs before first paint so the night paper never flashes cream. */
export const PREFS_BOOTSTRAP = `try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'null');var t=p&&p.toneAuto===false&&p.tone;if(!t){var l=localStorage.getItem('${LEGACY_THEME_KEY}');t=(l==='paper'||l==='night')?l:(matchMedia('(prefers-color-scheme: dark)').matches?'night':'paper')}var r=document.documentElement;r.dataset.tone=t;r.dataset.theme=t==='night'?'night':'light';var f={cormorant:'var(--font-cormorant)',lora:'var(--font-lora)'}[p&&p.font];if(f)r.style.setProperty('--font-serif',f+', Georgia, serif');r.style.setProperty('--rail',localStorage.getItem('markd:rail:collapsed')==='true'?'64px':'232px')}catch(e){document.documentElement.dataset.tone=matchMedia('(prefers-color-scheme: dark)').matches?'night':'paper'}`;
