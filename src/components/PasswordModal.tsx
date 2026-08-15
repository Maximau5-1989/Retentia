import { useEffect, useState } from "react";
import { authenticatePassword, createPassword, validateNewPassword } from "../shared/auth";

interface PasswordModalProps {
  mode: "setup" | "unlock";
  onSuccess: () => void;
  onCancel?: () => void;
  onReset?: () => void;
}

export function PasswordModal({ mode, onSuccess, onCancel, onReset }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!retryUntil) return;
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    update(); const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (mode === "setup") {
      const validation = validateNewPassword(password);
      if (validation) { setError(validation); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
    try {
      if (mode === "setup") await createPassword(password);
      else {
        const result = await authenticatePassword(password);
        if (!result.ok) {
          if (result.retryAfterMs) setRetryUntil(Date.now() + result.retryAfterMs);
          setError(result.retryAfterMs ? `Too many attempts. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.` : `Incorrect password. Attempt ${result.failedAttempts} of 5 before a delay.`);
          return;
        }
      }
      setPassword(""); setConfirmPassword(""); onSuccess();
    } finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-title">
    <form className="modal-panel" onSubmit={submit}>
      <div className="mb-5 flex items-center gap-3"><img src="/icons/icon-48.png" alt="" className="h-12 w-12"/><div><p className="muted m-0 text-xs font-bold uppercase tracking-[.14em]">Retentia security</p><h2 id="password-title" className="m-0 text-xl font-black">{mode === "setup" ? "Create your password" : "Unlock Retentia"}</h2></div></div>
      <p className="muted text-sm">{mode === "setup" ? "This password protects access to Retentia. It never leaves this device and cannot be recovered." : "Enter your password to open Retentia. Access remains unlocked while the dashboard tab is open."}</p>
      <label><span className="label">Password</span><input autoFocus required type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} className="field" value={password} onChange={event => setPassword(event.target.value)} /></label>
      {mode === "setup" && <label className="mt-4 block"><span className="label">Confirm password</span><input required type="password" autoComplete="new-password" className="field" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>}
      {error && <p role="alert" className="mb-0 mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <div className="mt-5 flex gap-2">{onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}<button disabled={busy || remainingSeconds > 0} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50" type="submit">{remainingSeconds > 0 ? `Wait ${remainingSeconds}s` : busy ? "Checking…" : mode === "setup" ? "Create password" : "Unlock Retentia"}</button></div>
      {mode === "unlock" && onReset && <button type="button" className="muted mt-4 w-full border-0 bg-transparent text-center text-xs underline" onClick={onReset}>Forgot password? Reset protected Retentia data</button>}
      <p className="muted mb-0 mt-4 text-center text-[11px]">This lock discourages casual access. It cannot protect against someone with full access to your Windows or Chrome profile.</p>
    </form>
  </div>;
}
