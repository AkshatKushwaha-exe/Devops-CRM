import { useState } from "react";
import { CalendarDays, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "./api";
import {
  Avatar,
  dateLabel,
  ErrorState,
  Loading,
  Modal,
  money,
  Pagination,
} from "./components";
import DealForm from "./DealForm";
import { useDebounce, useResource } from "./hooks";
import { LABELS, STAGES, type Deal, type Page, type Stage } from "./types";

function DealColumn({
  stage,
  search,
  version,
  onEdit,
  onAdd,
  onRemove,
  onChange,
}: {
  stage: Stage;
  search: string;
  version: number;
  onEdit: (deal: Deal) => void;
  onAdd: (stage: Stage) => void;
  onRemove: (deal: Deal) => void;
  onChange: (message: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const deals = useResource<Page<Deal>>(
    `/deals?stage=${stage}&search=${encodeURIComponent(search)}&limit=8&offset=${page * 8}`,
    version,
  );
  async function move(deal: Deal, next: Stage) {
    setBusy(deal.id);
    setError("");
    try {
      await api(`/deals/${deal.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: next }),
      });
      onChange(`Moved ${deal.title} to ${LABELS[next]}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      className={`pipeline-column stage-${stage}`}
      aria-label={`${LABELS[stage]} deals`}
    >
      <header>
        <div>
          <span className={`stage-dot ${stage}`} />
          <h2>{LABELS[stage]}</h2>
          <span className="count">{deals.data?.total ?? "—"}</span>
        </div>
        <button
          className="icon-button"
          aria-label={`Add ${LABELS[stage]} deal`}
          onClick={() => onAdd(stage)}
        >
          <Plus size={17} />
        </button>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {deals.error ? (
        <ErrorState message={deals.error} retry={deals.retry} />
      ) : deals.loading ? (
        <Loading />
      ) : !deals.data?.items.length ? (
        <div className="column-empty">
          <p>
            No {LABELS[stage].toLowerCase()} deals
            {search ? " matching your search" : " yet"}.
          </p>
          {page > 0 ? (
            <button className="text-link" onClick={() => setPage(0)}>
              Back to first page
            </button>
          ) : (
            <button className="text-link" onClick={() => onAdd(stage)}>
              <Plus size={14} />
              Add opportunity
            </button>
          )}
        </div>
      ) : (
        <div className="deal-cards">
          {deals.data.items.map((deal) => (
            <article className="deal-card" key={deal.id}>
              <div className="deal-company">
                {deal.contact.company || deal.contact.name}
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${deal.title}`}
                    onClick={() => onEdit(deal)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    aria-label={`Delete ${deal.title}`}
                    onClick={() => onRemove(deal)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <button className="deal-title" onClick={() => onEdit(deal)}>
                {deal.title}
              </button>
              <strong className="deal-value">{money(deal.value)}</strong>
              <div className="deal-person">
                <Avatar name={deal.contact.name} size="small" />
                <span>{deal.contact.name}</span>
              </div>
              <div className="deal-date">
                <CalendarDays size={13} />
                {dateLabel(deal.expected_close)}
              </div>
              <label className="stage-select">
                <span className="sr-only">Stage for {deal.title}</span>
                <select
                  disabled={busy === deal.id}
                  value={deal.stage}
                  onChange={(e) => move(deal, e.target.value as Stage)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
      {deals.data && deals.data.total > 8 && (
        <Pagination
          page={page}
          total={deals.data.total}
          size={8}
          onChange={setPage}
        />
      )}
    </section>
  );
}

export default function Pipeline({
  version,
  onChange,
}: {
  version: number;
  onChange: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const term = useDebounce(search);
  const [form, setForm] = useState<Deal | Stage | null>(null);
  const [removing, setRemoving] = useState<Deal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/deals/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      onChange("Deal removed.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KEEP THINGS MOVING</div>
          <h1>
            A little progress, every day<span>.</span>
          </h1>
          <p>From the first hello to the next big win.</p>
        </div>
        <button className="button primary" onClick={() => setForm("new")}>
          <Plus size={18} />
          Add deal
        </button>
      </div>
      <div className="pipeline-toolbar">
        <div>
          <h2>Sales pipeline</h2>
          <span className="muted">All deal values in INR</span>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search deals"
            type="search"
            maxLength={120}
            placeholder="Search deals or companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="pipeline-board">
        {STAGES.map((stage) => (
          <DealColumn
            key={`${stage}-${term}`}
            stage={stage}
            search={term}
            version={version}
            onEdit={setForm}
            onAdd={setForm}
            onRemove={(deal) => {
              setRemoving(deal);
              setError("");
            }}
            onChange={onChange}
          />
        ))}
      </div>
      {form && (
        <DealForm
          deal={typeof form === "string" ? undefined : form}
          initialStage={typeof form === "string" ? form : undefined}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            onChange(message);
          }}
        />
      )}
      {removing && (
        <Modal
          title="Delete this opportunity?"
          subtitle={`“${removing.title}” will be permanently removed. Its contact will be kept.`}
          busy={busy}
          onClose={() => setRemoving(null)}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Keep deal
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? "Removing…" : "Delete deal"}
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
