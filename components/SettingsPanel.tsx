'use client';

import { FONTS, MEASURES, SIZES, TONES, type Prefs } from '@/lib/prefs';

export default function SettingsPanel({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (patch: Partial<Prefs>) => void }) {
  return (
    <div>
      <div className="set-group">
        <span className="eyebrow">Paper</span>
        <div className="tones">
          {TONES.map((tone) => (
            <button
              key={tone.v}
              type="button"
              className="tone"
              aria-pressed={prefs.tone === tone.v}
              onClick={() => onPrefs({ tone: tone.v, toneAuto: false })}
            >
              <i style={{ ['--sw' as string]: tone.swatch, ['--edge' as string]: tone.edge }} />
              {tone.l}
            </button>
          ))}
        </div>
        {!prefs.toneAuto ? (
          <button type="button" className="auto-link" onClick={() => onPrefs({ toneAuto: true })}>
            follow the system instead
          </button>
        ) : (
          <p className="auto-link" style={{ textDecoration: 'none', margin: '8px 0 0' }}>following the system</p>
        )}
      </div>
      <div className="set-group">
        <span className="eyebrow">Headings</span>
        <div className="choice-row">
          {FONTS.map((font) => (
            <button
              key={font.v}
              type="button"
              className="choice"
              aria-pressed={prefs.font === font.v}
              onClick={() => onPrefs({ font: font.v })}
              style={{ fontFamily: `${font.css}, Georgia, serif`, fontSize: 15 }}
            >
              <span>{font.l}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="set-group">
        <span className="eyebrow">Text</span>
        <div className="choice-row">
          {SIZES.map((size) => (
            <button key={size.v} type="button" className="choice" aria-pressed={prefs.size === size.v} onClick={() => onPrefs({ size: size.v })}>
              <span>{size.l}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="set-group">
        <span className="eyebrow">Column</span>
        <div className="choice-row">
          {MEASURES.map((measure) => (
            <button key={measure.v} type="button" className="choice" aria-pressed={prefs.measure === measure.v} onClick={() => onPrefs({ measure: measure.v })}>
              <span>{measure.l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
