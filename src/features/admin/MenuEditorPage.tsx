import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useMenuDays, useMenuWeek } from '../../hooks/useData';
import { addDays, capitalize, defaultWeekStart, formatCutoffTime, formatLongDate, formatWeekRange, weekdaysOf } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '../../config/business';
import { draftFromMenuDay, emptyDayDraft, saveWeek, type DayDraft } from '../../services/menu';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { ServiceIcon } from '../../components/ServiceIcon';
import type { ISODate } from '../../types/models';
import { MenuImageUploader } from './MenuImageUploader';

export function MenuEditorPage() {
  const [weekStart, setWeekStart] = useState<ISODate>(() => defaultWeekStart());
  const week = useMenuWeek(weekStart);
  const days = useMenuDays(weekStart);
  const [edits, setEdits] = useState<{ weekId: ISODate; days: DayDraft[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const saved = useMemo(() => {
    const byDate = new Map((days.data ?? []).map((d) => [d.date, d]));
    return weekdaysOf(weekStart).map((date) => {
      const day = byDate.get(date);
      return day ? draftFromMenuDay(day) : emptyDayDraft(date);
    });
  }, [days.data, weekStart]);

  const dirty = edits?.weekId === weekStart;
  const drafts = dirty ? edits.days : saved;
  const published = (days.data ?? []).length > 0;

  function update(date: ISODate, change: (d: DayDraft) => DayDraft) {
    setMessage(null);
    setEdits({ weekId: weekStart, days: drafts.map((d) => (d.date === date ? change(d) : d)) });
  }

  function goWeek(delta: number) {
    if (dirty && !window.confirm('Hay cambios sin guardar en esta semana. ¿Salir sin guardar?')) return;
    setEdits(null);
    setMessage(null);
    setWeekStart(addDays(weekStart, delta * 7));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveWeek(weekStart, drafts);
      setEdits(null);
      setMessage({ tone: 'success', text: 'Menú guardado. Las familias ya lo ven actualizado.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  }

  const saveBar = (
    <div className="row-wrap save-bar">
      <button type="button" className="btn btn--primary btn--lg" onClick={save} disabled={saving || (!dirty && published)}>
        <Save size={20} aria-hidden="true" /> {saving ? 'Guardando…' : published ? 'Guardar cambios' : 'Publicar menú de la semana'}
      </button>
      {dirty && <span className="badge badge--warning">Cambios sin guardar</span>}
    </div>
  );

  return (
    <div className="stack-lg">
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <div className="stack-sm">
          <h1>Menú semanal</h1>
          <p className="muted">
            Los padres pueden pedir hasta las {formatCutoffTime('breakfast')} (desayuno) y {formatCutoffTime('lunch')} (comida) de
            cada día.
          </p>
        </div>
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => goWeek(-1)} aria-label="Semana anterior">
            <ChevronLeft size={24} />
          </button>
          <strong aria-live="polite">{formatWeekRange(weekStart)}</strong>
          <button type="button" className="icon-btn" onClick={() => goWeek(1)} aria-label="Semana siguiente">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {days.error || week.error ? (
        <ErrorState message={(days.error ?? week.error)!} onRetry={() => window.location.reload()} />
      ) : days.loading || week.loading ? (
        <LoadingState />
      ) : (
        <>
          {!published && <p className="banner banner--info">Esta semana aún no tiene menú. Captúralo y publícalo.</p>}
          {message && (
            <p className={`banner banner--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}

          {drafts.map((day) => (
            <section key={day.date} className="card menu-day" data-noservice={day.noService || undefined} aria-labelledby={`md-${day.date}`}>
              <div className="spread" style={{ flexWrap: 'wrap' }}>
                <h2 id={`md-${day.date}`}>{capitalize(formatLongDate(day.date))}</h2>
                <label className="switch">
                  <input type="checkbox" checked={day.noService} onChange={(e) => update(day.date, (d) => ({ ...d, noService: e.target.checked }))} />
                  Sin servicio
                </label>
              </div>
              {day.noService ? (
                <p className="muted">Este día se mostrará como “Sin servicio” y no se podrán hacer pedidos.</p>
              ) : (
                <div className="menu-day__services">
                  {SERVICE_TYPES.map((svc: ServiceType) => {
                    const id = `${day.date}-${svc}`;
                    return (
                      <div key={svc} className="stack-sm">
                        <div className="spread">
                          <span className="row">
                            <ServiceIcon service={svc} />
                            <strong>{SERVICE_LABELS[svc].singular}</strong>
                          </span>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={day[svc].available}
                              onChange={(e) => update(day.date, (d) => ({ ...d, [svc]: { ...d[svc], available: e.target.checked } }))}
                            />
                            Disponible
                          </label>
                        </div>
                        <label className="visually-hidden" htmlFor={id}>
                          Descripción de {SERVICE_LABELS[svc].lower} del {formatLongDate(day.date)}
                        </label>
                        <textarea
                          id={id}
                          className="textarea"
                          rows={3}
                          maxLength={1000}
                          disabled={!day[svc].available}
                          placeholder={day[svc].available ? 'Describe el menú (texto libre)' : `Sin ${SERVICE_LABELS[svc].lower} este día`}
                          value={day[svc].description}
                          onChange={(e) => update(day.date, (d) => ({ ...d, [svc]: { ...d[svc], description: e.target.value } }))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {saveBar}

          <MenuImageUploader weekId={weekStart} hasImage={week.data?.hasImage ?? false} />
        </>
      )}
    </div>
  );
}
