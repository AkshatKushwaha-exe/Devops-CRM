import { useState } from "react";
import {
  ArrowUpRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api, errorMessage } from "./api";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  Pagination,
} from "./components";
import { useDebounce, useResource } from "./hooks";
import ContactForm from "./ContactForm";
import type { Contact, Page } from "./types";

export default function Contacts({
  version,
  onChange,
}: {
  version: number;
  onChange: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<Contact | "new" | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const term = useDebounce(search);
  const query = new URLSearchParams({
    search: term,
    offset: String(page * 10),
    limit: "10",
    ...(status ? { status } : {}),
  });
  const contacts = useResource<Page<Contact>>(`/contacts?${query}`, version);
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/contacts/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      setPage(0);
      onChange("Contact removed.");
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
          <div className="eyebrow">RELATIONSHIPS FIRST</div>
          <h1>
            Your people, in one place<span>.</span>
          </h1>
          <p>Every great opportunity starts with a connection.</p>
        </div>
        <button className="button primary" onClick={() => setForm("new")}>
          <Plus size={18} />
          Add contact
        </button>
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <div className="section-title">
            <Users size={19} />
            <h2>All contacts</h2>
            {contacts.data && (
              <span className="count">{contacts.data.total}</span>
            )}
          </div>
          <div className="filters">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search contacts"
                type="search"
                maxLength={120}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search contacts…"
              />
            </label>
            <select
              aria-label="Filter contacts by relationship"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All relationships</option>
              <option value="lead">Leads</option>
              <option value="customer">Customers</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        {contacts.error ? (
          <ErrorState message={contacts.error} retry={contacts.retry} />
        ) : contacts.loading ? (
          <Loading />
        ) : !contacts.data?.items.length ? (
          <EmptyState
            title={
              term || status
                ? "No matches just yet"
                : "Start with your first connection"
            }
            text={
              term || status
                ? "Try a different search or relationship filter."
                : "Add a contact and start building your sales pipeline."
            }
            action={
              <button
                className="button secondary"
                onClick={() => setForm("new")}
              >
                <Plus size={16} />
                Add contact
              </button>
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Relationship</th>
                    <th>Phone</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.data.items.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <button
                          className="person-cell"
                          onClick={() => setForm(contact)}
                        >
                          <Avatar name={contact.name} />
                          <span>
                            <strong>{contact.name}</strong>
                            <small>{contact.email}</small>
                          </span>
                          <ArrowUpRight className="person-arrow" size={15} />
                        </button>
                      </td>
                      <td>
                        {contact.company || <span className="muted">—</span>}
                      </td>
                      <td>
                        <Badge value={contact.status} />
                      </td>
                      <td className="muted">{contact.phone || "—"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${contact.name}`}
                            onClick={() => setForm(contact)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button danger-icon"
                            aria-label={`Delete ${contact.name}`}
                            onClick={() => {
                              setRemoving(contact);
                              setError("");
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={contacts.data.total}
              size={10}
              onChange={setPage}
            />
          </>
        )}
      </section>
      <p className="page-footnote">
        A little context goes a long way. Add notes to remember what matters.
      </p>
      {form && (
        <ContactForm
          contact={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            setPage(0);
            onChange(message);
          }}
        />
      )}
      {removing && (
        <Modal
          title="Remove this contact?"
          subtitle={`${removing.name} will be permanently removed. Contacts with deals must have those deals reassigned or deleted first.`}
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
              Keep contact
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? "Removing…" : "Delete contact"}
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
