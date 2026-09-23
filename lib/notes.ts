import { sampleMarkdown } from './sample';

export type Note = { id: string; title: string; markdown: string; updatedAt: number; createdAt?: number };

export const DOCS_KEY = 'markd:documents:v1';
export const ACTIVE_KEY = 'markd:active:v1';
export const scrollKey = (id: string) => `markd:scroll:${id}`;
export const checksKey = (id: string) => `markd:checks:${id}`;
export const draftKey = 'markd:draft:v1';

export function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage can be disabled or full. */
  }
}
export function removeStore(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Keep the reader usable. */
  }
}

export function titleFromMarkdown(markdown: string) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`~]/g, '').trim();
  return title || `Untitled · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export function loadNotes(): Note[] {
  try {
    const raw = readStore(DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.filter(
          (item) => typeof item?.id === 'string' && typeof item?.markdown === 'string' && typeof item?.title === 'string',
        );
    }
  } catch {
    /* Corrupt storage falls back to the sample. */
  }
  const sample = [{ id: 'sample', title: titleFromMarkdown(sampleMarkdown), markdown: sampleMarkdown, updatedAt: Date.now() }];
  writeStore(DOCS_KEY, JSON.stringify(sample));
  return sample;
}

/** Words in the prose, with code, math and markup stripped. */
export function wordCount(markdown: string) {
  const prose = markdown
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' x ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*\[![\w-]+\]/gm, ' ')
    .replace(/[#>*_`~|=-]/g, ' ');
  return prose.split(/\s+/).filter(Boolean).length;
}

/** Study pace, not skimming pace: notes are read slower than articles. */
export const minutesFor = (words: number) => Math.max(1, Math.round(words / 200));

export function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeLabel(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Each note gets a pastel from Akada's palette, the way a course does, so the
 * rail reads as a spine of coloured tabs. Picked from the id so it never moves.
 */
const PASTELS = ['--sage', '--rose', '--lav', '--peach', '--sky', '--clay', '--butter', '--mint', '--slate', '--mauve'];
export function noteColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return `var(${PASTELS[Math.abs(hash) % PASTELS.length]})`;
}

export function downloadNote(note: Note) {
  const blob = new Blob([note.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'note'}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CheckResult = 'got' | 'miss';
export function loadChecks(id: string): Record<string, CheckResult> {
  try {
    const parsed = JSON.parse(readStore(checksKey(id)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
