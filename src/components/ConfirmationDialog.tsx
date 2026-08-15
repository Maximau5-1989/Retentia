import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ConfirmationTone = "danger" | "warning" | "info";

export interface ConfirmationOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
}

interface PendingConfirmation {
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
}

interface ConfirmationDialogProps extends ConfirmationOptions {
  onCancel: () => void;
  onConfirm: () => void;
}

const TONE_STYLES: Record<ConfirmationTone, { badge: string; symbol: string; detail: string }> = {
  danger: {
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
    symbol: "!",
    detail: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100",
  },
  warning: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    symbol: "!",
    detail: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100",
  },
  info: {
    badge: "bg-[#eef7e8] text-[#397323] dark:bg-[#263d29] dark:text-[#a8e77d]",
    symbol: "i",
    detail: "border-[#cfe3c4] bg-[#f4faef] text-[#284f1c] dark:border-[#365b39] dark:bg-[#193123] dark:text-[#d8efc9]",
  },
};

export function ConfirmationDialog({
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const detailId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const style = TONE_STYLES[tone];

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)") ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div ref={panelRef} className="modal-panel" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${descriptionId}${detail ? ` ${detailId}` : ""}`} onKeyDown={handleKeyDown}>
      <div className="flex items-start gap-4">
        <div aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-black ${style.badge}`}>{style.symbol}</div>
        <div className="min-w-0">
          <p className="muted m-0 text-xs font-bold uppercase tracking-[.14em]">Retentia confirmation</p>
          <h2 id={titleId} className="mb-0 mt-1 text-xl font-black">{title}</h2>
        </div>
      </div>
      <p id={descriptionId} className="muted mb-0 mt-5 text-sm leading-6">{message}</p>
      {detail && <p id={detailId} className={`mb-0 mt-4 rounded-xl border p-3 text-sm font-semibold ${style.detail}`}>{detail}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>;
}

export function useConfirmationDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }, []);

  const requestConfirmation = useCallback((options: ConfirmationOptions): Promise<boolean> => new Promise((resolve) => {
    pendingRef.current?.resolve(false);
    const next = { options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);

  useEffect(() => () => {
    pendingRef.current?.resolve(false);
    pendingRef.current = null;
  }, []);

  return {
    requestConfirmation,
    confirmationDialog: pending
      ? <ConfirmationDialog {...pending.options} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
      : null,
  };
}
