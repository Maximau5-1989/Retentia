import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("renders an accessible Retentia confirmation with safe default actions", () => {
    const markup = renderToStaticMarkup(<ConfirmationDialog
      title="Clean expired history?"
      message="Retentia will remove expired matching entries."
      detail="Deleted browser history cannot be restored."
      confirmLabel="Delete matches"
      tone="danger"
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />);

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Clean expired history?");
    expect(markup).toContain("Deleted browser history cannot be restored.");
    expect(markup.indexOf("Cancel")).toBeLessThan(markup.indexOf("Delete matches"));
  });
});
