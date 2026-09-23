'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import MarkdMark from './notebook/MarkdMark';
import SettingsPanel from './SettingsPanel';
import { minutesFor, noteColor, relativeLabel, wordCount, type Note } from '@/lib/notes';
import type { Prefs } from '@/lib/prefs';

export const RAIL_WIDE = 232;
export const RAIL_NARROW = 64;

interface Props {
  collapsed: boolean;
  onCollapse: (next: boolean) => void;
  notes: Note[];
  activeId: string;
  mode: 'read' | 'edit';
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onEdit: () => void;
  onRead: () => void;
  onOpenFile: () => void;
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
}

export function NoteRows({ notes, activeId, onSelect, onDelete, collapsed }: {
  notes: Note[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  collapsed?: boolean;
}) {
  return (
    <>
      {notes.map((note) => {
        const minutes = minutesFor(wordCount(note.markdown));
        return (
          <div
            key={note.id}
            className={`note-row ${note.id === activeId ? 'is-on' : ''}`}
            role="button"
            tabIndex={0}
            aria-current={note.id === activeId ? 'page' : undefined}
            aria-label={collapsed ? note.title : undefined}
            title={collapsed ? note.title : `${note.title} · edited ${relativeLabel(note.updatedAt).toLowerCase()}`}
            onClick={() => onSelect(note.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(note.id);
              }
            }}
            style={{ ['--c' as string]: noteColor(note.id) }}
          >
            <span className="stripe" aria-hidden />
            {!collapsed && (
              <>
                <span className="title">{note.title}</span>
                <span className="meta">{minutes}m</span>
                <button
                  type="button"
                  className="del"
                  aria-label={`Delete ${note.title}`}
                  title="Delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(note.id);
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

export function filterNotes(notes: Note[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => n.title.toLowerCase().includes(q) || n.markdown.toLowerCase().includes(q));
}

const Rail = forwardRef<HTMLInputElement, Props>(function Rail(props, searchRef) {
  const { collapsed, onCollapse, notes, activeId, mode, onSelect, onDelete, onNew, onEdit, onRead, onOpenFile, prefs, onPrefs } = props;
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const shown = filterNotes(notes, query);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(event.target as Node)) setSettingsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  return (
    <nav className="rail" aria-label="Notes" data-collapsed={collapsed}>
      <div className="rail-head">
        {!collapsed && (
          <button type="button" className="wordmark" onClick={onRead} aria-label="Markd, back to reading">
            <MarkdMark size={18} />
            <span>Markd</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ color: 'var(--muted)' }}
          onClick={() => onCollapse(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? 'railOpen' : 'rail'} size={16} />
        </button>
      </div>

      <button
        type="button"
        className="rail-row"
        aria-current={mode === 'read' ? 'page' : undefined}
        onClick={onRead}
        title={collapsed ? 'Read' : undefined}
        aria-label={collapsed ? 'Read' : undefined}
      >
        <Icon name="read" />
        {!collapsed && <span>Read</span>}
      </button>
      <button
        type="button"
        className="rail-row"
        aria-current={mode === 'edit' ? 'page' : undefined}
        onClick={onEdit}
        title={collapsed ? 'Write' : undefined}
        aria-label={collapsed ? 'Write' : undefined}
      >
        <Icon name="write" />
        {!collapsed && (
          <>
            <span>Write</span>
            <span className="count"><span className="kbd">E</span></span>
          </>
        )}
      </button>

      <div className="rail-rule" />
      {!collapsed && (
        <div className="rail-label">
          <span className="eyebrow">Notes</span>
          <button type="button" onClick={onNew} aria-label="New note" title="New note (N)">
            <Icon name="plus" size={15} />
          </button>
        </div>
      )}
      {!collapsed && notes.length > 3 && (
        <label className="rail-search">
          <Icon name="search" size={14} />
          <span className="sr-only">Search notes</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                event.currentTarget.blur();
              }
              if (event.key === 'Enter' && shown[0]) onSelect(shown[0].id);
            }}
            placeholder="Search"
          />
          {!query && <span className="kbd">/</span>}
        </label>
      )}
      <div className="rail-notes">
        <NoteRows notes={shown} activeId={activeId} onSelect={onSelect} onDelete={onDelete} collapsed={collapsed} />
        {!collapsed && notes.length === 0 && <p className="rail-empty">Nothing here yet.</p>}
        {!collapsed && notes.length > 0 && shown.length === 0 && <p className="rail-empty">No note mentions that.</p>}
      </div>

      <button type="button" className="rail-drop" onClick={onOpenFile} aria-label="Open a markdown file" title={collapsed ? 'Open .md' : undefined}>
        {collapsed ? (
          <Icon name="upload" size={16} />
        ) : (
          <>
            <span>
              <span className="eyebrow" style={{ display: 'block' }}>Import</span>
              <span className="hint">or drop a file</span>
            </span>
            <span className="go"><Icon name="upload" size={14} />Open</span>
          </>
        )}
      </button>

      <div ref={popRef} style={{ position: 'relative' }}>
        {settingsOpen && (
          <div className="popover" role="dialog" aria-label="Reading settings">
            <SettingsPanel prefs={prefs} onPrefs={onPrefs} />
          </div>
        )}
        <button
          type="button"
          className={`rail-row ${settingsOpen ? 'is-on' : ''}`}
          style={{ marginTop: 4 }}
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          aria-label={collapsed ? 'Reading settings' : undefined}
          title={collapsed ? 'Reading settings' : undefined}
        >
          <Icon name="settings" />
          {!collapsed && <span>Page</span>}
        </button>
      </div>
    </nav>
  );
});

export default Rail;
