import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  X,
} from "lucide-react";
import { LABELS } from "./types";

export const money = (value: string | number, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: !compact && Number(value) % 1 !== 0 ? 2 : 0,
    notation: compact ? "compact" : "standard",
  }).format(Number(value));

export function dateLabel(value: string | null) {
  return value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No close date";
}
export function timeLabel(value: string) {
  const date = new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
  );
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function Avatar({ name, size = "" }: { name: string; size?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  const tone = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  return (
    <span className={`avatar tone-${tone} ${size}`} aria-hidden="true">
      {initials}
    </span>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      <span />
      {LABELS[value] || value}
    </span>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your workspace…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <p>{message}</p>
      <button className="button secondary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total}`
          : "0 records"}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={(page + 1) * size >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      aria-describedby="modal-subtitle"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <header>
          <div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h2 id="modal-title">{title}</h2>
            <p id="modal-subtitle">{subtitle}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="toast" role="status">
      <Check size={18} />
      <span>{message}</span>
      <button
        className="icon-button"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
