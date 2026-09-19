import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, FileText, Hourglass, Search, X, Trash2 } from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const COLUMNS = [
  {
    key: 'submission',
    title: 'Submission / Approval',
    color: 'blue',
    icon: FileText,
    legend: 'Submission / Approval'
  },
  { key: 'sourcing', title: 'Sourcing', color: 'green', icon: Search, legend: 'Active / In Progress' },
  { key: 'waiting', title: 'Waiting on App', color: 'amber', icon: Hourglass, legend: 'Waiting' },
  { key: 'later', title: 'Later', color: 'purple', icon: CalendarDays, legend: 'Later / Lower Priority' }
];

const SAMPLE_DEALS = [
  { id: 'sample-1', column_key: 'submission', title: 'Jeremy McAdams — Terra Firma', subtitle: 'Submission approval', notes: [], paused: false, sort_order: 0 },
  { id: 'sample-2', column_key: 'sourcing', title: 'Dylan Brown — All N One Moving', subtitle: 'Sourcing', notes: [], paused: false, sort_order: 0 },
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
    sort_order: 1
  },
  { id: 'sample-4', column_key: 'sourcing', title: 'Joe Sheppard — 15 Passenger Van', subtitle: 'Sourcing', notes: [], paused: false, sort_order: 2 },
  { id: 'sample-5', column_key: 'waiting', title: 'Alberto — Moving Company', subtitle: 'Waiting on app', notes: [], paused: false, sort_order: 0 },
  { id: 'sample-6', column_key: 'waiting', title: "Jacuzzi — 12' box", subtitle: 'Waiting on app', notes: [], paused: false, sort_order: 1 },
  { id: 'sample-7', column_key: 'later', title: 'Weir', subtitle: '', notes: [], paused: false, sort_order: 0 },
  { id: 'sample-8', column_key: 'later', title: 'Biscuit', subtitle: '', notes: [], paused: true, sort_order: 1 },
  { id: 'sample-9', column_key: 'later', title: 'Dom — Pest Control', subtitle: 'Complicated order', notes: [], paused: false, sort_order: 2 }
];

function App() {
  const [deals, setDeals] = useState(SAMPLE_DEALS);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const saveTimers = useRef(new Map());

  const grouped = useMemo(() => {
    const result = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const deal of deals) {
      if (result[deal.column_key]) result[deal.column_key].push(deal);
    }
    Object.values(result).forEach((arr) => arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    return result;
  }, [deals]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase.from('deals').select('*').order('sort_order');
      if (!mounted) return;
      if (loadError) {
        setError('Cloud sync is not connected yet. Add your Supabase environment variables and run the setup SQL.');
      } else {
        setDeals(data ?? []);
        setError('');
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('work-deals-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => load())
      .subscribe();

    const refresh = () => document.visibilityState === 'visible' && load();
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      mounted = false;
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', refresh);
      supabase.removeChannel(channel);
    };
  }, []);

  const upsertDeal = async (deal) => {
    if (!supabase) return;
    const payload = {
      id: deal.id?.startsWith('sample-') ? undefined : deal.id,
      column_key: deal.column_key,
      title: deal.title,
      subtitle: deal.subtitle || '',
      notes: Array.isArray(deal.notes) ? deal.notes : [],
      paused: Boolean(deal.paused),
      sort_order: Number.isFinite(deal.sort_order) ? deal.sort_order : 0,
      updated_at: new Date().toISOString()
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const { data, error: saveError } = await supabase.from('deals').upsert(payload).select().single();
    if (saveError) {
      setError(saveError.message);
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
      notes: draft.notes.filter((n) => n.trim()).map((n) => n.trim())
    };
    if (!clean.title) return;

    if (!supabase) {
      setDeals((prev) => {
        const exists = prev.some((d) => d.id === clean.id);
        return exists ? prev.map((d) => (d.id === clean.id ? clean : d)) : [...prev, clean];
      });
      setEditing(null);
      return;
    }

    const saved = await upsertDeal(clean);
    if (saved) {
      setDeals((prev) => {
        const exists = prev.some((d) => d.id === clean.id);
        return exists ? prev.map((d) => (d.id === clean.id ? saved : d)) : [...prev, saved];
      });
      setEditing(null);
    }
  };

  const deleteDeal = async (id) => {
    if (!id) return;
    if (supabase && !id.startsWith('sample-')) {
      const { error: deleteError } = await supabase.from('deals').delete().eq('id', id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
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
      isNew: true
    });
  };

  const moveDeal = async (id, columnKey) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.column_key === columnKey) return;
    const sortOrder = grouped[columnKey].length;
    const moved = { ...deal, column_key: columnKey, sort_order: sortOrder };
    setDeals((prev) => prev.map((d) => (d.id === id ? moved : d)));
    if (supabase && !id.startsWith('sample-')) await upsertDeal(moved);
  };

  const reorderDeal = async (dragId, targetId) => {
    if (!dragId || dragId === targetId) return;
    const dragDeal = deals.find((d) => d.id === dragId);
    const target = deals.find((d) => d.id === targetId);
    if (!dragDeal || !target) return;

    const columnKey = target.column_key;
    const ids = grouped[columnKey].map((d) => d.id).filter((id) => id !== dragId);
    const index = ids.indexOf(targetId);
    ids.splice(index, 0, dragId);

    const updated = deals.map((d) => {
      if (d.id === dragId) return { ...d, column_key: columnKey, sort_order: ids.indexOf(d.id) };
      if (d.column_key === columnKey && ids.includes(d.id)) return { ...d, sort_order: ids.indexOf(d.id) };
      return d;
    });
    setDeals(updated);

    if (supabase) {
      const rows = updated
        .filter((d) => d.column_key === columnKey && !d.id.startsWith('sample-'))
        .map(({ id, column_key, title, subtitle, notes, paused, sort_order }) => ({ id, column_key, title, subtitle, notes, paused, sort_order, updated_at: new Date().toISOString() }));
      if (rows.length) await supabase.from('deals').upsert(rows);
    }
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <h1>Work Deals</h1>
          <p>Pipeline &amp; Next Steps</p>
        </div>
        <div className="motto">STAY ORGANIZED <span>•</span> CLOSE DEALS <span>•</span> MAKE PROGRESS</div>
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
              onDoubleClick={(e) => {
                if (e.target.closest('.deal-card')) return;
                addDeal(column.key);
              }}
            >
              <div className="column-header" title="Double-click empty space in this column to add a deal">
                <div className="header-left">
                  <div className="icon-bubble"><Icon size={27} strokeWidth={2.1} /></div>
                  <h2>{column.title}</h2>
                </div>
                <div className="count-bubble">{columnDeals.length}</div>
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
          onDelete={deleteDeal}
        />
      )}
    </main>
  );
}

function DealModal({ deal, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...deal, notes: [...(deal.notes || [])] });
  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

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
          {!deal.isNew && <button className="delete-btn" onClick={() => onDelete(draft.id)}><Trash2 size={17} />Delete</button>}
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={() => onSave(draft)}>Save</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
