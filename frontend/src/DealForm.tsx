import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { api, errorMessage } from "./api";
import { Modal } from "./components";
import { useDebounce, useResource } from "./hooks";
import {
  LABELS,
  STAGES,
  type Contact,
  type Deal,
  type DealInput,
  type Page,
  type Stage,
} from "./types";

export default function DealForm({
  deal,
  initialStage = "new",
  onClose,
  onSaved,
}: {
  deal?: Deal;
  initialStage?: Stage;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<DealInput>(
    deal
      ? {
          title: deal.title,
          contact_id: deal.contact_id,
          value: deal.value,
          stage: deal.stage,
          expected_close: deal.expected_close,
          notes: deal.notes,
        }
      : {
          title: "",
          contact_id: 0,
          value: "",
          stage: initialStage,
          expected_close: null,
          notes: "",
        },
  );
  const [search, setSearch] = useState("");
  const term = useDebounce(search);
  const contacts = useResource<Page<Contact>>(
    `/contacts?limit=200&search=${encodeURIComponent(term)}`,
  );
  const [selected, setSelected] = useState<Contact | undefined>(deal?.contact);
  const options = [
    ...(selected ? [selected] : []),
    ...(contacts.data?.items || []).filter((c) => c.id !== selected?.id),
  ];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function field<K extends keyof DealInput>(key: K, value: DealInput[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/deals${deal ? `/${deal.id}` : ""}`, {
        method: deal ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      onSaved(deal ? "Deal updated." : "A new opportunity added.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={deal ? "Edit opportunity" : "Make room for opportunity"}
      subtitle="Connect a deal to a contact and give it a next step."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label className="full">
              Deal title <span>*</span>
              <input
                data-autofocus
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => field("title", e.target.value)}
                placeholder="e.g. Website redesign"
              />
            </label>
            <label className="full">
              Find a contact
              <input
                type="search"
                maxLength={120}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, company, or email…"
              />
            </label>
            <label className="full">
              Contact <span>*</span>
              <select
                required
                value={form.contact_id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  field("contact_id", id);
                  setSelected(options.find((c) => c.id === id));
                }}
              >
                <option value="">Select a contact</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {contacts.loading && (
              <p className="field-help full" role="status">
                Loading contacts…
              </p>
            )}
            {contacts.error && (
              <p className="form-error full" role="alert">
                {contacts.error}{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={contacts.retry}
                >
                  Retry
                </button>
              </p>
            )}
            {!contacts.loading && !contacts.error && !contacts.data?.total && (
              <p className="field-help full">
                No matching contacts. Create a contact first, or adjust your
                search.
              </p>
            )}
            {(contacts.data?.total || 0) > 200 && (
              <p className="field-help full">
                Showing the first 200 matches. Search to find a specific
                contact.
              </p>
            )}
            <label>
              Value (INR) <span>*</span>
              <input
                type="number"
                required
                min="0"
                max="9999999999.99"
                step="0.01"
                value={form.value}
                onChange={(e) => field("value", e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              Expected close
              <input
                type="date"
                value={form.expected_close || ""}
                onChange={(e) =>
                  field("expected_close", e.target.value || null)
                }
              />
            </label>
            <label className="full">
              Stage
              <select
                value={form.stage}
                onChange={(e) => field("stage", e.target.value as Stage)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Notes
              <textarea
                maxLength={5000}
                rows={3}
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="Scope, next steps, or anything worth remembering…"
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={!form.contact_id}
            >
              {busy && <LoaderCircle className="spin" size={16} />}
              {deal ? "Save changes" : "Create deal"}
            </button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
