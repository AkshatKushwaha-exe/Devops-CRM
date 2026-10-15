import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value() {
    this.setAttribute("open", "");
  },
  configurable: true,
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value() {
    this.removeAttribute("open");
  },
  configurable: true,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
