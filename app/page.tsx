'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownReader, countChecks, getMarkdownHeadings, openHeadingSection } from '@/components/MarkdownReader';
import Rail, { NoteRows, RAIL_NARROW, RAIL_WIDE, filterNotes } from '@/components/Rail';
import Editor from '@/components/Editor';
import Sheet from '@/components/Sheet';
import SettingsPanel from '@/components/SettingsPanel';
import Icon from '@/components/Icon';
import MarkdMark from '@/components/notebook/MarkdMark';
import HandNote from '@/components/notebook/HandNote';
import HandCheck from '@/components/notebook/HandCheck';
import { CheckStrokes, MinutesLeft, TocList } from '@/components/Contents';
import {
  ACTIVE_KEY, DOCS_KEY, checksKey, dateLabel, downloadNote, draftKey, loadChecks, loadNotes, minutesFor,
  readStore, removeStore, scrollKey, titleFromMarkdown, wordCount, writeStore, type CheckResult, type Note,
} from '@/lib/notes';
import { applyPrefs, readPrefs, writePrefs, type Prefs } from '@/lib/prefs';

type Mode = 'read' | 'edit';
type SheetName = 'notes' | 'contents' | 'page' | null;
type Notice = { id: number; text: string; action?: { label: string; run: () => void } };

const RAIL_KEY = 'markd:rail:collapsed';
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const looksLikeMarkdownFile = (file: File) => /\.(md|markdown|mdown|txt)$/i.test(file.name) || /^text\//.test(file.type);

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState('');
  const [mode, setMode] = useState<Mode>('read');
  const [draft, setDraft] = useState('');
  const [editingNew, setEditingNew] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ tone: 'paper', toneAuto: true, font: 'fraunces', size: 'medium', measure: 'narrow' });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeHeading, setActiveHeading] = useState('');
  const [progress, setProgress] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [mobileQuery, setMobileQuery] = useState('');
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const originalDraft = useRef('');

  const say = useCallback((text: string, action?: Notice['action']) => setNotice({ id: Date.now(), text, action }), []);

  /* ── Load ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const saved = loadNotes();
    const initialPrefs = readPrefs();
    const initialActive = saved.find((n) => n.id === readStore(ACTIVE_KEY))?.id || saved[0]?.id || '';
    let pending: { target: string; text: string } | null = null;
    try {
      pending = JSON.parse(readStore(draftKey) || 'null');
    } catch {
      pending = null;
    }
    const frame = requestAnimationFrame(() => {
      setNotes(saved);
      setActiveId(initialActive);
      setPrefs(initialPrefs);
      setRailCollapsed(readStore(RAIL_KEY) === 'true');
      if (pending?.text?.trim()) {
        const target = saved.find((n) => n.id === pending.target);
        setEditingNew(!target);
        if (target) setActiveId(target.id);
        originalDraft.current = target?.markdown ?? '';
        setDraft(pending.text);
        setMode('edit');
        setNotice({ id: Date.now(), text: 'Picked up the draft you left open.' });
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { if (ready) writeStore(DOCS_KEY, JSON.stringify(notes)); }, [notes, ready]);
  useEffect(() => { if (ready) writeStore(ACTIVE_KEY, activeId); }, [activeId, ready]);
  useEffect(() => { if (ready) applyPrefs(prefs); }, [prefs, ready]);
  useEffect(() => {
    document.documentElement.style.setProperty('--rail', `${railCollapsed ? RAIL_NARROW : RAIL_WIDE}px`);
  }, [railCollapsed]);

  // Follow the system paper until one is picked.
  useEffect(() => {
    if (!prefs.toneAuto) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setPrefs((p) => ({ ...p, tone: media.matches ? 'night' : 'paper' }));
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [prefs.toneAuto]);

  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch };
      if (patch.toneAuto) next.tone = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
      writePrefs(next);
      return next;
    });

  const collapseRail = (next: boolean) => {
    setRailCollapsed(next);
    writeStore(RAIL_KEY, String(next));
  };

  /* ── Active note ──────────────────────────────────────────────────── */
  const active = notes.find((n) => n.id === activeId);
  const markdown = active?.markdown ?? '';
  const headings = useMemo(() => getMarkdownHeadings(markdown), [markdown]);
  const words = useMemo(() => wordCount(markdown), [markdown]);
  const totalChecks = useMemo(() => countChecks(markdown), [markdown]);
  const hasOwnTitle = /^\s*#\s+/.test(markdown.replace(/^\s*---[\s\S]*?---\s*/, ''));
  const minutes = minutesFor(words);
  const minutesLeft = Math.round(minutes * (1 - progress));
  const activeIndex = notes.findIndex((n) => n.id === activeId);
  const nextNote = activeIndex >= 0 ? notes[activeIndex + 1] ?? (notes.length > 1 ? notes[0] : undefined) : undefined;

  useEffect(() => {
    if (!activeId) return;
    const frame = requestAnimationFrame(() => setChecks(loadChecks(activeId)));
    return () => cancelAnimationFrame(frame);
  }, [activeId]);

  const markCheck = useCallback((id: string, result: CheckResult) => {
    setChecks((current) => {
      const next = { ...current };
      if (next[id] === result) delete next[id];
      else next[id] = result;
      writeStore(checksKey(activeId), JSON.stringify(next));
      return next;
    });
  }, [activeId]);

  const rememberScroll = useCallback(() => {
    if (mode === 'read' && activeId) writeStore(scrollKey(activeId), String(window.scrollY));
  }, [mode, activeId]);

  // Put the reader back where they left the note.
  useEffect(() => {
    if (!ready || mode !== 'read' || !activeId) return;
    const y = Number(readStore(scrollKey(activeId)) || 0);
    const timer = window.setTimeout(() => window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: 'instant' }), 60);
    return () => window.clearTimeout(timer);
  }, [activeId, mode, ready]);

  useEffect(() => {
    if (mode !== 'read') return;
    let timer: number | undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1);
      let current = headings[0]?.id || '';
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el && el.getClientRects().length && el.getBoundingClientRect().top <= 120) current = heading.id;
      }
      // The last section can be too short to ever reach the top.
      if (scrollable > 0 && window.scrollY >= scrollable - 4 && headings.length) current = headings[headings.length - 1].id;
      setActiveHeading(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
      if (activeId) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => writeStore(scrollKey(activeId), String(window.scrollY)), 200);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [headings, activeId, mode, collapsed]);

  // Keep the tab title on the note.
  useEffect(() => {
    document.title = mode === 'edit' ? `Writing · Markd` : active ? `${active.title} · Markd` : 'Markd';
  }, [active, mode]);

  /* ── Draft autosave ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready || mode !== 'edit') return;
    const timer = window.setTimeout(() => {
      if (draft.trim() && draft !== originalDraft.current) writeStore(draftKey, JSON.stringify({ target: editingNew ? 'new' : activeId, text: draft }));
      else removeStore(draftKey);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, mode, ready, editingNew, activeId]);

  /* ── Actions ──────────────────────────────────────────────────────── */
  const openEditor = useCallback((fresh: boolean, seed?: string) => {
    rememberScroll();
    const text = seed ?? (fresh ? '' : active?.markdown ?? '');
    originalDraft.current = fresh ? '' : active?.markdown ?? '';
    setDraft(text);
    setEditingNew(fresh || !active);
    setMode('edit');
    setSheet(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [active, rememberScroll]);

  const startNew = useCallback(() => openEditor(true), [openEditor]);
  const startEdit = useCallback(() => openEditor(!active), [openEditor, active]);

  const saveDraft = useCallback(() => {
    if (!draft.trim()) return;
    const id = editingNew || !active ? newId() : active.id;
    const now = Date.now();
    const next: Note = { id, title: titleFromMarkdown(draft), markdown: draft, updatedAt: now, createdAt: active && !editingNew ? active.createdAt : now };
    setNotes((previous) => [next, ...previous.filter((n) => n.id !== id)]);
    setActiveId(id);
    setCollapsed(new Set());
    if (editingNew) writeStore(scrollKey(id), '0');
    removeStore(draftKey);
    setEditingNew(false);
    setMode('read');
  }, [active, draft, editingNew]);

  const cancelEdit = useCallback(() => {
    const kept = draft;
    const wasNew = editingNew;
    removeStore(draftKey);
    setMode('read');
    setEditingNew(false);
    if (kept.trim() && kept !== originalDraft.current) {
      say('Changes set aside.', { label: 'Bring back', run: () => (wasNew ? openEditor(true, kept) : openEditor(false, kept)) });
    }
  }, [draft, editingNew, openEditor, say]);

  const addNotes = useCallback((incoming: Note[]) => {
    if (!incoming.length) return;
    rememberScroll();
    setNotes((previous) => [...incoming, ...previous]);
    setActiveId(incoming[0].id);
    setCollapsed(new Set());
    setMode('read');
    setSheet(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    say(incoming.length === 1 ? `Opened “${incoming[0].title}”.` : `Opened ${incoming.length} notes.`);
  }, [rememberScroll, say]);

  const importFiles = useCallback(async (files: File[]) => {
    const usable = files.filter(looksLikeMarkdownFile);
    if (!usable.length) {
      if (files.length) say('That doesn’t look like a markdown file.');
      return;
    }
    const read = await Promise.all(usable.map(async (file) => {
      try {
        const text = await file.text();
        const now = Date.now();
        const fallback = file.name.replace(/\.[^.]+$/, '');
        return { id: newId(), title: /^#\s+/m.test(text) ? titleFromMarkdown(text) : fallback, markdown: text, updatedAt: now, createdAt: now };
      } catch {
        return null;
      }
    }));
    addNotes(read.filter((n): n is NonNullable<typeof n> => n !== null));
  }, [addNotes, say]);

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await importFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const deleteNote = useCallback((id: string) => {
    const index = notes.findIndex((n) => n.id === id);
    const gone = notes[index];
    if (!gone) return;
    const rest = notes.filter((n) => n.id !== id);
    setNotes(rest);
    if (activeId === id) {
      setActiveId(rest[Math.min(index, rest.length - 1)]?.id || '');
      setMode('read');
      setCollapsed(new Set());
    }
    say(`Deleted “${gone.title}”.`, {
      label: 'Undo',
      run: () => {
        setNotes((current) => {
          const copy = current.filter((n) => n.id !== gone.id);
          copy.splice(Math.min(index, copy.length), 0, gone);
          return copy;
        });
        setActiveId(gone.id);
      },
    });
  }, [notes, activeId, say]);

  const selectNote = useCallback((id: string) => {
    rememberScroll();
    setActiveId(id);
    setMode('read');
    setSheet(null);
    setCollapsed(new Set());
    setMobileQuery('');
  }, [rememberScroll]);

  const jumpTo = (id: string) => {
    setSheet(null);
    openHeadingSection(id);
    setActiveHeading(id);
  };

  const toggleSection = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const sectionIds = headings.filter((h) => h.level === 2).map((h) => h.id);
  const allFolded = sectionIds.length > 0 && sectionIds.every((id) => collapsed.has(id));
  const foldAll = () => setCollapsed(allFolded ? new Set() : new Set(sectionIds));

  const copyMarkdown = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.markdown);
      say('Markdown copied.');
    } catch {
      say('Couldn’t reach the clipboard.');
    }
  };

  /* ── Keys, paste and drop ─────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mode === 'edit') {
        if (mod && event.key.toLowerCase() === 's') {
          event.preventDefault();
          saveDraft();
        } else if (event.key === 'Escape' && !sheet) {
          event.preventDefault();
          cancelEdit();
        }
        return;
      }
      if (mod || event.altKey || isTyping(event.target) || sheet) return;
      if (event.key === 'e' && active) { event.preventDefault(); startEdit(); }
      else if (event.key === 'n') { event.preventDefault(); startNew(); }
      else if (event.key === 'o') { event.preventDefault(); fileRef.current?.click(); }
      else if (event.key === '/') {
        if (searchRef.current && searchRef.current.offsetParent) { event.preventDefault(); searchRef.current.focus(); }
        else if (window.innerWidth < 768) { event.preventDefault(); setSheet('notes'); }
      } else if (event.key === '[' || event.key === ']') {
        if (notes.length < 2) return;
        const step = event.key === ']' ? 1 : -1;
        const to = notes[(activeIndex + step + notes.length) % notes.length];
        if (to) selectNote(to.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, sheet, active, activeIndex, notes, saveDraft, cancelEdit, startEdit, startNew, selectNote]);

  // Pasting markdown straight onto the page makes a note of it.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (mode !== 'read' || isTyping(event.target) || sheet) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (text.trim().length < 20) return;
      event.preventDefault();
      const now = Date.now();
      const note = { id: newId(), title: titleFromMarkdown(text), markdown: text, updatedAt: now, createdAt: now };
      addNotes([note]);
      say('Pasted as a new note.', { label: 'Undo', run: () => deleteNoteSilently(note.id) });
    };
    const deleteNoteSilently = (id: string) => setNotes((current) => {
      const rest = current.filter((n) => n.id !== id);
      setActiveId((a) => (a === id ? rest[0]?.id ?? '' : a));
      return rest;
    });
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [mode, sheet, addNotes, say]);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      void importFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFiles]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.action ? 6000 : 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ── Render ───────────────────────────────────────────────────────── */
  const showToc = mode === 'read' && !!active && (headings.length > 0 || totalChecks > 0);

  const phoneTop = (
    <div className="phone-top">
      <span className="wordmark"><MarkdMark size={18} /><span>Markd</span></span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => fileRef.current?.click()} aria-label="Open a markdown file">
        <Icon name="upload" size={17} />
      </button>
    </div>
  );

  let body: React.ReactNode = null;
  if (!ready) body = null;
  else if (mode === 'edit') {
    body = (
      <div className="page-main">
        {phoneTop}
        <Editor
          draft={draft}
          onChange={setDraft}
          isNew={editingNew}
          title={draft.trim() ? titleFromMarkdown(draft) : active?.title ?? 'Untitled'}
          onSave={saveDraft}
          onCancel={cancelEdit}
          onOpenFile={() => fileRef.current?.click()}
        />
      </div>
    );
  } else if (!active) {
    body = (
      <div className="page-main desk">
        {phoneTop}
        <p className="standfirst">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="screen-title">A quiet place to read.</h1>
        <p className="lede">
          Paste your study notes, open a <span className="hl-swipe">.md</span> file, or drop one anywhere on the page. Everything stays in this browser.
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={startNew}><Icon name="write" size={16} />New note</button>
          <button type="button" className="btn btn-dashed" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />Open .md</button>
          <HandNote rotate={-4} size={19} style={{ marginLeft: 8 }}>or just paste</HandNote>
        </div>
        <div className="keys" aria-label="Keyboard shortcuts">
          <div><span className="kbd">N</span> new note</div>
          <div><span className="kbd">O</span> open a file</div>
          <div><span className="kbd">Ctrl V</span> paste markdown as a note</div>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="page-main">
          {phoneTop}
          <header className="page-head">
            <p className="standfirst">
              Edited {dateLabel(active.updatedAt)} · {words.toLocaleString()} words · {minutes} min read
            </p>
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={startEdit} title="Edit (E)">
                <Icon name="write" size={16} />Edit
              </button>
              {sectionIds.length > 1 && (
                <button type="button" className="btn btn-ghost btn-icon" onClick={foldAll} aria-label={allFolded ? 'Open every section' : 'Fold every section'} title={allFolded ? 'Open every section' : 'Fold every section'}>
                  <Icon name={allFolded ? 'unfold' : 'fold'} size={16} />
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon" onClick={copyMarkdown} aria-label="Copy markdown" title="Copy markdown">
                <Icon name="copy" size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => downloadNote(active)} aria-label="Download .md" title="Download .md">
                <Icon name="download" size={16} />
              </button>
            </div>
          </header>
          {!hasOwnTitle && <h1 className="screen-title" style={{ marginBottom: 28 }}>{active.title}</h1>}
          <div className={`reading-size-${prefs.size}`}>
            <MarkdownReader
              key={active.id}
              markdown={active.markdown}
              collapsedSections={collapsed}
              onToggleSection={toggleSection}
              checks={checks}
              onMarkCheck={markCheck}
            />
          </div>
          <footer className="note-end">
            <HandCheck size={22} />
            <HandNote size={20} rotate={-2}>that’s the lot</HandNote>
            {nextNote && nextNote.id !== active.id && (
              <p className="next">
                Next on the pile:{' '}
                <button type="button" className="btn btn-ghost" style={{ height: 32, fontStyle: 'normal' }} onClick={() => selectNote(nextNote.id)}>
                  {nextNote.title} →
                </button>
              </p>
            )}
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => window.scrollTo({ top: 0 })}>Back to the top</button>
            </div>
          </footer>
        </div>
        {showToc && (
          <aside className="toc-col" aria-label="On this page">
            <div className="toc-sticky">
              {headings.length > 0 && (
                <div className="toc-block">
                  <span className="eyebrow">On this page</span>
                  <TocList headings={headings} activeId={activeHeading} onJump={jumpTo} />
                  <MinutesLeft minutes={minutesLeft} progress={progress} />
                </div>
              )}
              {totalChecks > 0 && (
                <div className="toc-block">
                  <CheckStrokes total={totalChecks} checks={checks} />
                </div>
              )}
            </div>
          </aside>
        )}
      </>
    );
  }

  const mobileNotes = filterNotes(notes, mobileQuery);

  return (
    <>
      <span className="paper-noise" aria-hidden />
      <input ref={fileRef} type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" multiple hidden onChange={onFileInput} />

      {ready && (
        <Rail
          ref={searchRef}
          collapsed={railCollapsed}
          onCollapse={collapseRail}
          notes={notes}
          activeId={activeId}
          mode={mode}
          onSelect={selectNote}
          onDelete={deleteNote}
          onNew={startNew}
          onEdit={startEdit}
          onRead={() => (mode === 'edit' ? cancelEdit() : window.scrollTo({ top: 0 }))}
          onOpenFile={() => fileRef.current?.click()}
          prefs={prefs}
          onPrefs={updatePrefs}
        />
      )}

      <div className="frame">
        <main className={`page ${showToc ? 'has-toc' : ''}`} data-measure={prefs.measure}>
          {body}
        </main>
      </div>

      {ready && (
        <nav className="phone-bar" aria-label="Reader">
          <div className="phone-bar-inner">
            <button type="button" className={`phone-tab ${sheet === 'notes' ? 'is-on' : ''}`} onClick={() => setSheet('notes')}>
              <Icon name="notes" size={20} />Notes
            </button>
            <button type="button" className={`phone-tab ${sheet === 'contents' ? 'is-on' : ''}`} onClick={() => setSheet('contents')} disabled={!showToc}>
              <Icon name="contents" size={20} />Contents
            </button>
            {mode === 'edit' ? (
              <button type="button" className="phone-tab is-on" onClick={saveDraft} disabled={!draft.trim()}>
                <Icon name="read" size={20} />Save
              </button>
            ) : (
              <button type="button" className="phone-tab" onClick={startEdit}>
                <Icon name="write" size={20} />{active ? 'Edit' : 'Write'}
              </button>
            )}
            <button type="button" className={`phone-tab ${sheet === 'page' ? 'is-on' : ''}`} onClick={() => setSheet('page')}>
              <Icon name="settings" size={20} />Page
            </button>
          </div>
        </nav>
      )}

      {sheet === 'notes' && (
        <Sheet title="Notes" onClose={() => setSheet(null)}>
          {notes.length > 3 && (
            <label className="rail-search" style={{ marginBottom: 10 }}>
              <Icon name="search" size={14} />
              <span className="sr-only">Search notes</span>
              <input value={mobileQuery} onChange={(event) => setMobileQuery(event.target.value)} placeholder="Search" style={{ background: 'var(--bg-tint)' }} />
            </label>
          )}
          <NoteRows notes={mobileNotes} activeId={activeId} onSelect={selectNote} onDelete={deleteNote} />
          {notes.length === 0 && <p className="rail-empty">Nothing here yet.</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={startNew}><Icon name="plus" size={16} />New note</button>
            <button type="button" className="btn btn-dashed" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />Open .md</button>
          </div>
        </Sheet>
      )}
      {sheet === 'contents' && (
        <Sheet title="On this page" onClose={() => setSheet(null)}>
          <TocList headings={headings} activeId={activeHeading} onJump={jumpTo} />
          {sectionIds.length > 1 && (
            <div className="toc-tools">
              <button type="button" onClick={foldAll}>{allFolded ? 'Open every section' : 'Fold every section'}</button>
            </div>
          )}
          <MinutesLeft minutes={minutesLeft} progress={progress} />
          {totalChecks > 0 && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
              <CheckStrokes total={totalChecks} checks={checks} />
            </div>
          )}
        </Sheet>
      )}
      {sheet === 'page' && (
        <Sheet title="Page" onClose={() => setSheet(null)}>
          <SettingsPanel prefs={prefs} onPrefs={updatePrefs} />
        </Sheet>
      )}

      {notice && (
        <div className="notice-wrap" role="status" aria-live="polite">
          <div className="notice" key={notice.id}>
            <span>{notice.text}</span>
            {notice.action && (
              <button type="button" onClick={() => { notice.action?.run(); setNotice(null); }}>{notice.action.label}</button>
            )}
          </div>
        </div>
      )}

      {dragging && (
        <div className="drop-veil" aria-hidden>
          <div>
            <Icon name="upload" size={22} />
            <strong>Drop to open</strong>
            <span className="standfirst" style={{ margin: 0 }}>.md, .markdown or .txt</span>
          </div>
        </div>
      )}
    </>
  );
}
