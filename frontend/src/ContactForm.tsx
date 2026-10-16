import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { api, errorMessage } from "./api";
import { Modal } from "./components";
import type { Contact, ContactInput } from "./types";

export default function ContactForm({
  contact,
  onClose,
  onSaved,
}: {
  contact?: Contact;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ContactInput>(
    contact
      ? {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          status: contact.status,
          notes: contact.notes,
        }
      : {
          name: "",
          email: "",
          phone: "",
          company: "",
          status: "lead",
          notes: "",
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function field<K extends keyof ContactInput>(key: K, value: ContactInput[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/contacts${contact ? `/${contact.id}` : ""}`, {
        method: contact ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      onSaved(
        contact ? "Contact updated." : "Contact added to your workspace.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={contact ? "Edit contact" : "A new connection"}
      subtitle="Keep the details that make every conversation count."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label>
              Full name <span>*</span>
              <input
                data-autofocus
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="e.g. Priya Sharma"
                autoComplete="name"
              />
            </label>
            <label>
              Email address <span>*</span>
              <input
                type="email"
                required
                maxLength={254}
                value={form.email}
                onChange={(e) => field("email", e.target.value)}
                placeholder="priya@company.com"
                autoComplete="email"
              />
            </label>
            <label>
              Company
              <input
                maxLength={120}
                value={form.company}
                onChange={(e) => field("company", e.target.value)}
                placeholder="Company name"
                autoComplete="organization"
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                maxLength={40}
                value={form.phone}
                onChange={(e) => field("phone", e.target.value)}
                placeholder="+91 …"
                autoComplete="tel"
              />
            </label>
            <label className="full">
              Relationship
              <select
                value={form.status}
                onChange={(e) =>
                  field("status", e.target.value as ContactInput["status"])
                }
              >
                <option value="lead">Lead</option>
                <option value="customer">Customer</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="full">
              Notes
              <textarea
                maxLength={5000}
                rows={4}
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="A little context for your next conversation…"
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
            <button className="button primary" type="submit">
              {busy && <LoaderCircle className="spin" size={16} />}
              {contact ? "Save changes" : "Create contact"}
            </button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
