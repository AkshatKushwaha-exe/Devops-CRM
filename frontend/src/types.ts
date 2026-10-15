export type ContactStatus = "lead" | "customer" | "inactive";
export type Stage = "new" | "qualified" | "proposal" | "won" | "lost";
export const STAGES: Stage[] = ["new", "qualified", "proposal", "won", "lost"];
export const LABELS: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  lead: "Lead",
  customer: "Customer",
  inactive: "Inactive",
};
export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  notes: string;
}
export interface Contact extends ContactInput {
  id: number;
  created_at: string;
  updated_at: string;
}
export interface DealInput {
  title: string;
  contact_id: number;
  value: string;
  stage: Stage;
  expected_close: string | null;
  notes: string;
}
export interface Deal extends DealInput {
  id: number;
  contact: Contact;
  created_at: string;
  updated_at: string;
}
export interface Activity {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
export interface Dashboard {
  total_contacts: number;
  active_deals: number;
  pipeline_value: string;
  won_revenue: string;
  win_rate: number;
  stages: { stage: Stage; count: number; value: string }[];
  upcoming_deals: Deal[];
  recent_activity: Activity[];
}
