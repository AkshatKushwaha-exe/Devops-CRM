import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContactForm from "./ContactForm";
import DealForm from "./DealForm";
import Contacts from "./Contacts";
import Overview from "./Overview";
import Pipeline from "./Pipeline";
import { api } from "./api";
import type { Contact, Dashboard, Deal } from "./types";

const contact: Contact = {
  id: 1,
  name: "Priya Sharma",
  email: "priya@example.com",
  company: "Bloom",
  phone: "",
  status: "lead",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const deal: Deal = {
  id: 1,
  title: "Brand identity",
  contact_id: 1,
  contact,
  value: "1000.50",
  stage: "new",
  expected_close: null,
  notes: "",
  created_at: contact.created_at,
  updated_at: contact.updated_at,
};

function reply(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("contact workflows", () => {
  it("creates a contact using only editable fields", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply(contact, 201));
    const saved = vi.fn();
    render(<ContactForm onClose={vi.fn()} onSaved={saved} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Full name/), contact.name);
    await user.type(screen.getByLabelText(/Email address/), contact.email);
    await user.click(screen.getByRole("button", { name: "Create contact" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "/api/contacts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string).name).toBe(
      contact.name,
    );
  });

  it("keeps input and shows an actionable duplicate-email error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply({ detail: "A contact with this email already exists." }, 409),
    );
    render(
      <ContactForm contact={contact} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    expect(screen.getByLabelText(/Full name/)).toHaveValue(contact.name);
  });

  it("requires confirmation and preserves linked contacts on conflict", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) =>
      options?.method === "DELETE"
        ? reply(
            {
              detail:
                "This contact has deals. Delete or reassign those deals first.",
            },
            409,
          )
        : reply({ items: [contact], total: 1 }),
    );
    const changed = vi.fn();
    render(<Contacts version={0} onChange={changed} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Priya Sharma" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete contact" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("reassign");
    expect(changed).not.toHaveBeenCalled();
  });

  it("shows empty filtered results", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => reply({ items: [], total: 0 }));
    render(<Contacts version={0} onChange={vi.fn()} />);
    await screen.findByText("Start with your first connection");
    await userEvent.type(screen.getByLabelText("Search contacts"), "missing");
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([url]) =>
          String(url).includes("search=missing"),
        ),
      ).toBe(true),
    );
    expect(await screen.findByText("No matches just yet")).toBeInTheDocument();
  });
});

describe("deal workflows", () => {
  it("creates a deal linked to the selected contact", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, options) =>
        options?.method === "POST"
          ? reply(deal, 201)
          : reply({ items: [contact], total: 1 }),
      );
    const saved = vi.fn();
    render(<DealForm onClose={vi.fn()} onSaved={saved} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Deal title/), deal.title);
    await screen.findByRole("option", { name: "Priya Sharma · Bloom" });
    await user.selectOptions(screen.getByLabelText(/^Contact/), "1");
    await user.type(screen.getByLabelText(/Value/), "1000.50");
    await user.click(screen.getByRole("button", { name: "Create deal" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const request = fetch.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(JSON.parse(request![1]!.body as string)).toMatchObject({
      contact_id: 1,
      value: "1000.5",
      expected_close: null,
    });
  });

  it("disables creation without a contact", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply({ items: [], total: 0 }),
    );
    render(<DealForm onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(
      await screen.findByText(/Create a contact first/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create deal" })).toBeDisabled();
  });

  it("moves a pipeline deal to won through the API", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, options) =>
        options?.method === "PATCH"
          ? reply({ ...deal, stage: "won" })
          : reply({
              items: String(url).includes("stage=new") ? [deal] : [],
              total: String(url).includes("stage=new") ? 1 : 0,
            }),
      );
    const changed = vi.fn();
    render(<Pipeline version={0} onChange={changed} />);
    await userEvent.selectOptions(
      await screen.findByLabelText("Stage for Brand identity"),
      "won",
    );
    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith("Moved Brand identity to Won."),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/deals/1/stage",
      expect.objectContaining({ method: "PATCH", body: '{"stage":"won"}' }),
    );
  });
});

describe("dashboard and error handling", () => {
  it("renders real aggregate values and empty states", async () => {
    const data: Dashboard = {
      total_contacts: 0,
      active_deals: 0,
      pipeline_value: "0",
      won_revenue: "0",
      win_rate: 0,
      stages: [],
      upcoming_deals: [],
      recent_activity: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(data));
    render(
      <Overview
        version={0}
        onNavigate={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("A little room for opportunity"),
    ).toBeInTheDocument();
    expect(screen.getByText("Your story starts here")).toBeInTheDocument();
    expect(screen.getByText("0% win rate · closed deals")).toBeInTheDocument();
  });

  it("lets the user retry a failed request", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(reply({ items: [], total: 0 }));
    render(<Contacts version={0} onChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to reach",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("Start with your first connection"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces API validation errors and handles empty delete responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        reply(
          { detail: [{ loc: ["body", "value"], msg: "Must be positive" }] },
          422,
        ),
      )
      .mockResolvedValueOnce(reply(null, 204));
    await expect(api("/deals")).rejects.toThrow("value: Must be positive");
    await expect(
      api("/deals/1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });
});
