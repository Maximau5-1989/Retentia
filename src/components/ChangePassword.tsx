import { useState } from "react";
import { changePassword, validateNewPassword } from "../shared/auth";

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    const validation = validateNewPassword(next);
    if (validation) { setError(validation); return; }
    if (next !== confirm) { setError("New passwords do not match."); return; }
    const result = await changePassword(current, next);
    if (!result.ok) { setError(result.retryAfterMs ? `Password checks are locked. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.` : "Current password is incorrect."); return; }
    setCurrent(""); setNext(""); setConfirm(""); setMessage("Password changed successfully.");
  }

  return <form className="mt-7 border-t border-[#e5eae2] pt-6 dark:border-[#2b3a4b]" onSubmit={submit}>
    <h4 className="mb-1 mt-0 text-base font-extrabold">Change password</h4><p className="muted mt-0 text-sm">Changing the password does not alter your rules or history.</p>
    <div className="grid gap-3 md:grid-cols-3"><label><span className="label">Current password</span><input required type="password" autoComplete="current-password" className="field" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label><span className="label">New password</span><input required type="password" autoComplete="new-password" className="field" value={next} onChange={e=>setNext(e.target.value)}/></label><label><span className="label">Confirm new password</span><input required type="password" autoComplete="new-password" className="field" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></div>
    {error && <p className="text-sm font-semibold text-red-600">{error}</p>}{message && <p className="text-sm font-semibold text-green-600">{message}</p>}<button className="btn-secondary mt-3" type="submit">Change password</button>
  </form>;
}
