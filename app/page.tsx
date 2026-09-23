'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownReader, getMarkdownHeadings, openHeadingSection } from '@/components/MarkdownReader';
import { sampleMarkdown } from '@/lib/sample';

type Document = { id: string; title: string; markdown: string; updatedAt: number };
type FontSize = 'small' | 'medium' | 'large';
type Theme = 'paper' | 'night';

const DOCS_KEY = 'markd:documents:v1';
const ACTIVE_KEY = 'markd:active:v1';
const FONT_KEY = 'markd:font:v1';
const THEME_KEY = 'markd:theme:v1';
const scrollKey = (id: string) => `markd:scroll:${id}`;

function readStore(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writeStore(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Storage can be disabled or full. */ } }
function removeStore(key: string) { try { localStorage.removeItem(key); } catch { /* Keep the reader usable. */ } }
function titleFromMarkdown(markdown: string) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return title || `Untitled · ${new Date().toLocaleDateString()}`;
}
function dateLabel(timestamp: number) { return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function Icon({ name }: { name: 'file' | 'plus' | 'edit' | 'book' | 'sun' | 'moon' | 'upload' | 'trash' | 'menu' }) {
  const paths: Record<typeof name, React.ReactNode> = {
    file: <><path d="M6 2.5h7l5 5V21H6z"/><path d="M13 2.5V8h5M9 12h6M9 16h6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16zM13 7l4 4"/></>,
    book: <><path d="M4 4.5h7a3 3 0 0 1 3 3V20H7a3 3 0 0 0-3 1zM20 4.5h-3a3 3 0 0 0-3 3V20h3a3 3 0 0 1 3 1z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3z"/>,
    upload: <><path d="M12 16V3m-4 4 4-4 4 4M4 15v5h16v-5"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6m4-6v6"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeId, setActiveId] = useState('');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [draft, setDraft] = useState('');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [theme, setTheme] = useState<Theme>('paper');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeHeading, setActiveHeading] = useState('');
  const [progress, setProgress] = useState(0);
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<number | null>(null);
  const editingNewRef = useRef(false);

  useEffect(() => {
    let saved: Document[] | null = null;
    try {
      const raw = readStore(DOCS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) saved = parsed.filter((item) => typeof item?.id === 'string' && typeof item?.markdown === 'string' && typeof item?.title === 'string');
      }
    } catch { /* Corrupt storage falls back to the sample. */ }
    if (!saved) {
      saved = [{ id: 'sample', title: titleFromMarkdown(sampleMarkdown), markdown: sampleMarkdown, updatedAt: Date.now() }];
      writeStore(DOCS_KEY, JSON.stringify(saved));
    }
    const storedFont = readStore(FONT_KEY);
    const storedTheme = readStore(THEME_KEY);
    const initialDocuments = saved;
    const initialActive = saved.find((item) => item.id === readStore(ACTIVE_KEY))?.id || saved[0]?.id || '';
    const initialTheme = storedTheme === 'paper' || storedTheme === 'night' ? storedTheme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
    const frame = window.requestAnimationFrame(() => {
      setDocuments(initialDocuments);
      setActiveId(initialActive);
      if (storedFont === 'small' || storedFont === 'medium' || storedFont === 'large') setFontSize(storedFont);
      setTheme(initialTheme);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { if (ready) writeStore(DOCS_KEY, JSON.stringify(documents)); }, [documents, ready]);
  useEffect(() => { if (ready) writeStore(ACTIVE_KEY, activeId); }, [activeId, ready]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (readStore(THEME_KEY)) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(media.matches ? 'night' : 'paper');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const activeDoc = documents.find((item) => item.id === activeId);
  const headings = useMemo(() => getMarkdownHeadings(activeDoc?.markdown || ''), [activeDoc?.markdown]);

  useEffect(() => {
    if (!ready || mode !== 'read' || !activeId) return;
    const y = Number(readStore(scrollKey(activeId)) || 0);
    restoreRef.current = window.setTimeout(() => window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: 'instant' }), 90);
    return () => { if (restoreRef.current !== null) window.clearTimeout(restoreRef.current); };
  }, [activeId, mode, ready]);

  useEffect(() => {
    if (mode !== 'read') return;
    let timer: number | undefined;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 100);
      const threshold = 145;
      let current = headings[0]?.id || '';
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el && el.getClientRects().length && el.getBoundingClientRect().top <= threshold) current = heading.id;
      }
      setActiveHeading(current);
      if (activeId) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => writeStore(scrollKey(activeId), String(window.scrollY)), 180);
      }
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); window.clearTimeout(timer); };
  }, [headings, activeId, mode]);

  const openEditor = useCallback((fresh = false) => {
    if (mode === 'read' && activeId) writeStore(scrollKey(activeId), String(window.scrollY));
    setDraft(fresh ? '' : activeDoc?.markdown || '');
    setMode('edit');
    setMobileLibrary(false);
    window.scrollTo(0, 0);
  }, [activeDoc?.markdown, activeId, mode]);

  const saveDraft = useCallback(() => {
    if (!draft.trim()) return;
    const title = titleFromMarkdown(draft);
    // An edit updates the opened document; a fresh note receives a new id.
    const finalId = editingNewRef.current ? crypto.randomUUID() : activeDoc?.id || crypto.randomUUID();
    const next: Document = { id: finalId, title, markdown: draft, updatedAt: Date.now() };
    setDocuments((previous) => [next, ...previous.filter((item) => item.id !== finalId)]);
    setActiveId(finalId);
    setCollapsed(new Set());
    writeStore(scrollKey(finalId), '0');
    editingNewRef.current = false;
    setMode('read');
    window.scrollTo(0, 0);
  }, [activeDoc, draft]);
  const startNew = () => { editingNewRef.current = true; openEditor(true); };
  const startEdit = () => { editingNewRef.current = false; openEditor(); };

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (mode === 'read' && activeId) writeStore(scrollKey(activeId), String(window.scrollY));
      const markdown = await file.text();
      const next: Document = { id: crypto.randomUUID(), title: titleFromMarkdown(markdown), markdown, updatedAt: Date.now() };
      setDocuments((previous) => [next, ...previous]);
      setActiveId(next.id);
      setCollapsed(new Set());
      setMode('read');
      setMobileLibrary(false);
      window.scrollTo(0, 0);
    } catch { /* A failed read leaves the current document available. */ }
    event.target.value = '';
  };
  const deleteDocument = (id: string) => {
    const next = documents.filter((item) => item.id !== id);
    setDocuments(next);
    if (activeId === id) { setActiveId(next[0]?.id || ''); setMode('read'); setCollapsed(new Set()); }
    removeStore(scrollKey(id));
  };
  const selectDocument = (id: string) => {
    if (mode === 'read' && activeId) writeStore(scrollKey(activeId), String(window.scrollY));
    setActiveId(id); setMode('read'); setMobileLibrary(false); setCollapsed(new Set());
  };
  const jumpTo = (id: string) => {
    openHeadingSection(id);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveHeading(id); }
    });
  };
  const toggleSection = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleTheme = () => { const next = theme === 'paper' ? 'night' : 'paper'; setTheme(next); writeStore(THEME_KEY, next); };
  const changeFont = (size: FontSize) => { setFontSize(size); writeStore(FONT_KEY, size); };

  const library = <>
    <div className="rail-top"><span className="eyebrow">Your notes</span><button className="button icon-button" title="New note" aria-label="New note" onClick={startNew}><Icon name="plus" /></button></div>
    <div className="doc-list">{documents.length === 0 ? <div className="empty-state">Your saved notes will appear here.</div> : documents.map((doc) => <div key={doc.id} className={`doc-item ${doc.id === activeId ? 'active' : ''}`}><Icon name="file"/><div className="doc-item-content" role="button" tabIndex={0} onClick={() => selectDocument(doc.id)} onKeyDown={(event) => { if (event.key === 'Enter') selectDocument(doc.id); }}><span className="doc-item-title">{doc.title}</span><span className="doc-item-date">{dateLabel(doc.updatedAt)}</span></div><button className="delete-button" aria-label={`Delete ${doc.title}`} title="Delete note" onClick={() => deleteDocument(doc.id)}><Icon name="trash"/></button></div>)}</div>
  </>;

  return <>
    <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown,text/plain" hidden onChange={openFile} />
    <header className="app-header"><div className="progress-track"><div className="progress-fill" style={{ width: mode === 'read' ? `${progress}%` : '0%' }} /></div><div className="header-inner">
      <div className="brand"><span className="brand-mark">m</span> markd</div><div className="header-separator"/><span className="header-doc-title">{activeDoc?.title || 'Your reading desk'}</span>
      <div className="header-actions">
        <button className="button icon-button mobile-library" style={{ display: 'none' }} aria-label="Saved notes" title="Saved notes" onClick={() => setMobileLibrary(!mobileLibrary)}><Icon name="menu"/></button>
        <button className="button" onClick={() => fileRef.current?.click()} title="Open .md file"><Icon name="upload"/><span className="button-label">Open .md</span></button>
        <button className="button icon-button" onClick={toggleTheme} aria-label={theme === 'paper' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'paper' ? 'Dark mode' : 'Light mode'}><Icon name={theme === 'paper' ? 'moon' : 'sun'}/></button>
        {mode === 'read' ? <button className="button button-primary" onClick={startEdit}><Icon name="edit"/><span className="button-label">Edit note</span></button> : <button className="button button-primary" onClick={saveDraft} disabled={!draft.trim()}><Icon name="book"/><span className="button-label">Read note</span></button>}
      </div>
    </div></header>
    {mobileLibrary && <div className="mobile-library" style={{ display: 'none', borderBottom: '1px solid var(--line)', padding: '20px' }}>{library}</div>}
    <div className="app-layout"><aside className="left-rail"><div className="rail-sticky">{library}</div></aside><main className="reader-main"><div className="reader-column">
      {mode === 'edit' ? <><div className="reading-meta"><span className="eyebrow">Edit note</span><span className="meta-line"/></div><h1 className="reader-title">Your reading desk.</h1><p className="reader-subtitle">Paste your markdown below, then choose Read note.</p><div className="editor-label eyebrow">Markdown</div><textarea className="paste-area" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={'# Your note title\n\nPaste your study notes here…'} autoFocus/><div className="editor-footer"><button className="button" onClick={() => fileRef.current?.click()}><Icon name="upload"/>Open .md file</button><button className="button button-primary" disabled={!draft.trim()} onClick={saveDraft}>Read note</button></div></> : activeDoc ? <><div className="reading-meta"><span className="eyebrow">Study notes</span><span className="meta-line"/><span className="eyebrow">{dateLabel(activeDoc.updatedAt)}</span></div><div className="mobile-toc">{headings.length > 0 && <><label className="eyebrow" htmlFor="mobile-toc">On this page</label><select id="mobile-toc" value={activeHeading} onChange={(event) => jumpTo(event.target.value)}><option value="">Jump to section</option>{headings.map((heading) => <option key={heading.id} value={heading.id}>{heading.level === 3 ? '　' : ''}{heading.text}</option>)}</select></>}<div className="mobile-size"><span className="eyebrow">Text size</span><div className="segmented" role="group" aria-label="Text size">{(['small', 'medium', 'large'] as const).map((size) => <button key={size} className={fontSize === size ? 'selected' : ''} onClick={() => changeFont(size)} aria-pressed={fontSize === size}>{size === 'medium' ? 'Default' : size[0].toUpperCase() + size.slice(1)}</button>)}</div></div></div><div className={`reading-size-${fontSize}`}><MarkdownReader markdown={activeDoc.markdown} collapsedSections={collapsed} onToggleSection={toggleSection}/></div></> : <><div className="reading-meta"><span className="eyebrow">Study notes</span><span className="meta-line"/></div><h1 className="reader-title">A quieter place to read.</h1><p className="reader-subtitle">Paste markdown or open a file to begin.</p><button className="button button-primary" onClick={startNew}><Icon name="plus"/>New note</button></>}
    </div></main><aside className="right-rail"><div className="rail-sticky">{mode === 'read' && headings.length > 0 && <><div className="eyebrow" style={{ paddingLeft: 13 }}>On this page</div><nav className="toc-list" aria-label="Table of contents">{headings.map((heading) => <button key={heading.id} className={`toc-link level-${heading.level} ${activeHeading === heading.id ? 'active' : ''}`} onClick={() => jumpTo(heading.id)}>{heading.text}</button>)}</nav></>}<div className="reader-settings"><div className="eyebrow">Text size</div><div className="segmented" role="group" aria-label="Text size">{(['small', 'medium', 'large'] as const).map((size) => <button key={size} className={fontSize === size ? 'selected' : ''} onClick={() => changeFont(size)} aria-pressed={fontSize === size}>{size === 'medium' ? 'Default' : size[0].toUpperCase() + size.slice(1)}</button>)}</div></div></div></aside></div>
  </>;
}
