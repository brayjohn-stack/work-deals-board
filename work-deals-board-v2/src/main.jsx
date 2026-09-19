import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  FileText,
  Hourglass,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import './styles.css';

function cleanEnv(value = '') {
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

function normalizeSupabaseUrl(value = '') {
  return cleanEnv(value)
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = cleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const COLUMNS = [
  { key: 'submission', title: 'Submission / Approval', color: 'blue', icon: FileText },
  { key: 'sourcing', title: 'Sourcing', color: 'green', icon: Search },
  { key: 'waiting', title: 'Waiting on App', color: 'amber', icon: Hourglass },
  { key: 'later', title: 'Later', color: 'purple', icon: CalendarDays }
];

const SAMPLE_DEALS = [
  { id: 'sample-1', column_key: 'submission', title: 'Jeremy McAdams — Terra Firma', subtitle: 'Submission approval', notes: [], paused: false, sort_order: 0, record_state: 'active' },
  { id: 'sample-2', column_key: 'sourcing', title: 'Dylan Brown — All N One Moving', subtitle: 'Sourcing', notes: [], paused: false, sort_order: 0, record_state: 'active' },
  {
    id: 'sample-3',
    column_key: 'sourcing',
    title: 'Glenn — Dog Moving Ram Promasters with upfit',
    subtitle: '',
    notes: [
      'Adaptive cruise control and swivel chair are MUSTS',
      'Not the 2500 or 3500 ext',
      'Waiting to source adaptive cruise control 2500, then upfit with swivel'
    ],
    paused: false,
    sort_order: 1,
    record_state: 'active'
  },
  { id: 'sample-4', column_key: 'sourcing', title: 'Joe Sheppard — 15 Passenger Van', subtitle: 'Sourcing', notes: [], paused: false, sort_order: 2, record_state: 'active' },
  { id: 'sample-5', column_key: 'waiting', title: 'Alberto — Moving Company', subtitle: 'Waiting on app', notes: [], paused: false, sort_order: 0, record_state: 'active' },
  { id: 'sample-6', column_key: 'waiting', title: "Jacuzzi — 12' box", subtitle: 'Waiting on app', notes: [], paused: false, sort_order: 1, record_state: 'active' },
  { id: 'sample-7', column_key: 'later', title: 'Weir', subtitle: '', notes: [], paused: false, sort_order: 0, record_state: 'active' },
  { id: 'sample-8', column_key: 'later', title: 'Biscuit', subtitle: '', notes: [], paused: true, sort_order: 1, record_state: 'active' },
  { id: 'sample-9', column_key: 'later', title: 'Dom — Pest Control', subtitle: 'Complicated order', notes: [], paused: false, sort_order: 2, record_state: 'active' }
];

function errorText(prefix, err) {
  if (!err) return prefix;
  const pieces = [err.message, err.details, err.hint, err.code ? `Code: ${err.code}` : ''].filter(Boolean);
  return `${prefix}${pieces.length ? ` ${pieces.join(' — ')}` : ''}`;
}

function formatArchivedDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

function App() {
  const [deals, setDeals] = useState(SAMPLE_DEALS);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(
    supabase ? '' : 'Cloud sync is not configured. Check your Supabase URL and publishable key.'
  );
  const [editing, setEditing] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const activeDeals = useMemo(
    () => deals.filter((deal) => (deal.record_state || 'active') === 'active'),
    [deals]
  );

  const grouped = useMemo(() => {
    const result = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const deal of activeDeals) {
      if (result[deal.column_key]) result[deal.column_key].push(deal);
    }
    Object.values(result).forEach((arr) => arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    return result;
  }, [activeDeals]);

  const completedDeals = useMemo(
    () => deals
      .filter((deal) => deal.record_state === 'completed')
      .sort((a, b) => new Date(b.archived_at || 0) - new Date(a.archived_at || 0)),
    [deals]
  );

  const trashedDeals = useMemo(
    () => deals
      .filter((deal) => deal.record_state === 'trash')
      .sort((a, b) => new Date(b.archived_at || 0) - new Date(a.archived_at || 0)),
    [deals]
  );

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('deals')
        .select('*')
        .order('column_key')
        .order('sort_order');

      if (!mounted) return;

      if (loadError) {
        setError(errorText('Cloud sync error:', loadError));
      } else {
        setDeals((data ?? []).map((row) => ({ ...row, record_state: row.record_state || 'active' })));
        setError('');
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('work-deals-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, load)
      .subscribe();

    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, []);

  const upsertDeal = async (deal) => {
    if (!supabase) {
      setError('Cloud sync is not configured. This change was not saved online.');
      return null;
    }

    const payload = {
      id: deal.id?.startsWith('sample-') ? undefined : deal.id,
      column_key: deal.column_key,
      title: deal.title,
      subtitle: deal.subtitle || '',
      notes: Array.isArray(deal.notes) ? deal.notes : [],
      paused: Boolean(deal.paused),
      sort_order: Number.isFinite(deal.sort_order) ? deal.sort_order : 0,
      record_state: deal.record_state || 'active',
      archived_at: deal.archived_at || null,
      archived_from_column: deal.archived_from_column || null,
      updated_at: new Date().toISOString()
    };

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const { data, error: saveError } = await supabase
      .from('deals')
      .upsert(payload)
      .select()
      .single();

    if (saveError) {
      setError(errorText('Could not save deal:', saveError));
      return null;
    }

    setError('');
    return data;
  };

  const saveEdit = async (draft) => {
    const clean = {
      ...draft,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      notes: draft.notes.filter((n) => n.trim()).map((n) => n.trim()),
      record_state: draft.record_state || 'active'
    };

    if (!clean.title) return false;

    const saved = await upsertDeal(clean);
    if (!saved) return false;

    setDeals((prev) => {
      const exists = prev.some((d) => d.id === clean.id);
      return exists ? prev.map((d) => (d.id === clean.id ? saved : d)) : [...prev, saved];
    });
    setEditing(null);
    return true;
  };

  const setDealState = async (id, recordState) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return false;

    const now = new Date().toISOString();
    const updated = {
      ...deal,
      record_state: recordState,
      archived_at: now,
      archived_from_column: deal.column_key
    };

    const saved = await upsertDeal(updated);
    if (!saved) return false;

    setDeals((prev) => prev.map((d) => (d.id === id ? saved : d)));
    setEditing(null);
    return true;
  };

  const restoreDeal = async (id) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;

    const targetColumn = COLUMNS.some((c) => c.key === deal.archived_from_column)
      ? deal.archived_from_column
      : 'later';

    const restored = {
      ...deal,
      column_key: targetColumn,
      record_state: 'active',
      archived_at: null,
      archived_from_column: null,
      sort_order: grouped[targetColumn]?.length ?? 0
    };

    const saved = await upsertDeal(restored);
    if (!saved) return;
    setDeals((prev) => prev.map((d) => (d.id === id ? saved : d)));
  };

  const addDeal = (columnKey) => {
    const maxOrder = Math.max(-1, ...grouped[columnKey].map((d) => d.sort_order ?? 0));
    setEditing({
      id: crypto.randomUUID(),
      column_key: columnKey,
      title: '',
      subtitle: '',
      notes: [],
      paused: false,
      sort_order: maxOrder + 1,
      record_state: 'active',
      archived_at: null,
      archived_from_column: null,
      isNew: true
    });
  };

  const moveDeal = async (id, columnKey) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.column_key === columnKey || (deal.record_state || 'active') !== 'active') return;

    const moved = { ...deal, column_key: columnKey, sort_order: grouped[columnKey].length };
    setDeals((prev) => prev.map((d) => (d.id === id ? moved : d)));

    const saved = await upsertDeal(moved);
    if (!saved) {
      setDeals((prev) => prev.map((d) => (d.id === id ? deal : d)));
    }
  };

  const reorderDeal = async (dragId, targetId) => {
    if (!dragId || dragId === targetId) return;

    const dragDeal = deals.find((d) => d.id === dragId);
    const target = deals.find((d) => d.id === targetId);
    if (!dragDeal || !target) return;

    const previous = deals;
    const columnKey = target.column_key;
    const ids = grouped[columnKey].map((d) => d.id).filter((id) => id !== dragId);
    const targetIndex = ids.indexOf(targetId);
    ids.splice(targetIndex, 0, dragId);

    const updated = deals.map((d) => {
      if (d.id === dragId) return { ...d, column_key: columnKey, sort_order: ids.indexOf(d.id) };
      if ((d.record_state || 'active') === 'active' && d.column_key === columnKey && ids.includes(d.id)) {
        return { ...d, sort_order: ids.indexOf(d.id) };
      }
      return d;
    });

    setDeals(updated);

    if (!supabase) {
      setDeals(previous);
      setError('Cloud sync is not configured. Reorder was not saved online.');
      return;
    }

    const rows = updated
      .filter((d) => (d.record_state || 'active') === 'active' && d.column_key === columnKey && !d.id.startsWith('sample-'))
      .map(({ id, column_key, title, subtitle, notes, paused, sort_order, record_state, archived_at, archived_from_column }) => ({
        id,
        column_key,
        title,
        subtitle,
        notes,
        paused,
        sort_order,
        record_state: record_state || 'active',
        archived_at: archived_at || null,
        archived_from_column: archived_from_column || null,
        updated_at: new Date().toISOString()
      }));

    if (!rows.length) return;

    const { error: reorderError } = await supabase.from('deals').upsert(rows);
    if (reorderError) {
      setDeals(previous);
      setError(errorText('Could not reorder deals:', reorderError));
    } else {
      setError('');
    }
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <h1>Work Deals</h1>
          <p>Pipeline &amp; Next Steps</p>
        </div>
        <div className="topbar-right">
          <div className="motto">STAY ORGANIZED <span>•</span> CLOSE DEALS <span>•</span> MAKE PROGRESS</div>
          <button className="archive-btn" type="button" onClick={() => setArchiveOpen(true)}>
            <Archive size={16} /> Archive
            {(completedDeals.length + trashedDeals.length) > 0 && (
              <span>{completedDeals.length + trashedDeals.length}</span>
            )}
          </button>
        </div>
      </header>

      {error && <div className="sync-warning">{error}</div>}

      <section className="board" aria-busy={loading}>
        {COLUMNS.map((column) => {
          const Icon = column.icon;
          const columnDeals = grouped[column.key] || [];

          return (
            <div
              className={`column column-${column.color}`}
              key={column.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                moveDeal(draggingId, column.key);
                setDraggingId(null);
              }}
            >
              <div className="column-header">
                <div className="header-left">
                  <div className="icon-bubble"><Icon size={27} strokeWidth={2.1} /></div>
                  <h2>{column.title}</h2>
                </div>

                <div className="header-actions">
                  <button
                    className="add-deal-btn"
                    type="button"
                    title={`Add deal to ${column.title}`}
                    aria-label={`Add deal to ${column.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      addDeal(column.key);
                    }}
                  >
                    <Plus size={19} strokeWidth={2.4} />
                  </button>
                  <div className="count-bubble">{columnDeals.length}</div>
                </div>
              </div>

              <div className="deal-list">
                {columnDeals.map((deal) => (
                  <article
                    className="deal-card"
                    draggable
                    key={deal.id}
                    onDragStart={() => setDraggingId(deal.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      reorderDeal(draggingId, deal.id);
                      setDraggingId(null);
                    }}
                    onClick={() => setEditing({ ...deal, notes: [...(deal.notes || [])] })}
                  >
                    <div className="card-title-row">
                      <h3 className={deal.paused ? 'paused' : ''}>{deal.title}</h3>
                      <span className={`status-dot dot-${column.color}`} />
                    </div>
                    {deal.subtitle && <p className="subtitle">{deal.subtitle}</p>}
                    {deal.notes?.length > 0 && (
                      <ul>
                        {deal.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                      </ul>
                    )}
                  </article>
                ))}
              </div>

              <div className="column-footer">{columnDeals.length} {columnDeals.length === 1 ? 'DEAL' : 'DEALS'}</div>
            </div>
          );
        })}
      </section>

      <footer className="bottom-bar">
        <div className="legend">
          <span><i className="legend-dot green" />Active / In Progress</span>
          <span><i className="legend-dot amber" />Waiting</span>
          <span><i className="legend-dot blue" />Submission / Approval</span>
          <span><i className="legend-dot grey" />Later / Lower Priority</span>
          <span><i className="dash" />Lower Priority (On Hold)</span>
        </div>
        <div className="flow">OPPORTUNITIES <b>→</b> PIPELINE <b>→</b> RESULTS</div>
      </footer>

      {editing && (
        <DealModal
          deal={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onComplete={(id) => setDealState(id, 'completed')}
          onTrash={(id) => setDealState(id, 'trash')}
        />
      )}

      {archiveOpen && (
        <ArchiveModal
          completed={completedDeals}
          trashed={trashedDeals}
          onClose={() => setArchiveOpen(false)}
          onRestore={restoreDeal}
        />
      )}
    </main>
  );
}

function DealModal({ deal, onClose, onSave, onComplete, onTrash }) {
  const [draft, setDraft] = useState({ ...deal, notes: [...(deal.notes || [])] });
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!draft.title.trim() || saving || archiving) return;
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const archive = async (state) => {
    if (deal.isNew || archiving || saving) return;
    setArchiving(true);
    if (state === 'completed') await onComplete(draft.id);
    if (state === 'trash') await onTrash(draft.id);
    setArchiving(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true">
        <button className="close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <h3>{deal.isNew ? 'Add Deal' : 'Edit Deal'}</h3>

        <label>Deal / Company
          <input autoFocus value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="Jeremy McAdams — Terra Firma" />
        </label>

        <label>Column
          <select value={draft.column_key} onChange={(e) => update('column_key', e.target.value)}>
            {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
          </select>
        </label>

        <label>Next step / status
          <input value={draft.subtitle} onChange={(e) => update('subtitle', e.target.value)} placeholder="Submission approval" />
        </label>

        <label>Notes <small>one bullet per line</small>
          <textarea
            rows="6"
            value={draft.notes.join('\n')}
            onChange={(e) => update('notes', e.target.value.split('\n'))}
            placeholder={'Adaptive cruise control is a MUST\nWaiting on dealer response'}
          />
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={draft.paused} onChange={(e) => update('paused', e.target.checked)} />
          <span>On hold / lower priority</span>
        </label>

        <div className="modal-actions">
          {!deal.isNew && (
            <div className="archive-actions-inline">
              <button className="complete-btn" disabled={archiving || saving} onClick={() => archive('completed')}>
                <CheckCircle2 size={17} />Completed
              </button>
              <button className="delete-btn" disabled={archiving || saving} onClick={() => archive('trash')}>
                <Trash2 size={17} />Trash
              </button>
            </div>
          )}
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" disabled={saving || archiving || !draft.title.trim()} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveModal({ completed, trashed, onClose, onRestore }) {
  const [tab, setTab] = useState('completed');
  const current = tab === 'completed' ? completed : trashed;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card archive-modal" role="dialog" aria-modal="true">
        <button className="close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="archive-title-row">
          <div>
            <h3>Archive</h3>
            <p>Completed and trashed deals stay here until you restore them.</p>
          </div>
        </div>

        <div className="archive-tabs">
          <button className={tab === 'completed' ? 'active' : ''} onClick={() => setTab('completed')}>
            Completed <span>{completed.length}</span>
          </button>
          <button className={tab === 'trash' ? 'active' : ''} onClick={() => setTab('trash')}>
            Trash <span>{trashed.length}</span>
          </button>
        </div>

        <div className="archive-list">
          {current.length === 0 && <div className="archive-empty">Nothing here yet.</div>}
          {current.map((deal) => (
            <div className="archive-item" key={deal.id}>
              <div>
                <strong>{deal.title}</strong>
                <p>{deal.subtitle || COLUMNS.find((c) => c.key === deal.archived_from_column)?.title || ''}</p>
                {deal.archived_at && <small>{formatArchivedDate(deal.archived_at)}</small>}
              </div>
              <button className="restore-btn" onClick={() => onRestore(deal.id)}>
                <RotateCcw size={16} /> Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
