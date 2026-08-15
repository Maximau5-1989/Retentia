export function ThemeButton({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  const label = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
  return <button type="button" className="btn-secondary grid h-10 w-10 shrink-0 place-items-center !p-0" onClick={onToggle} title={label} aria-label={label}>
    {theme === "light"
      ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.4 15.4A8.5 8.5 0 0 1 8.6 3.6 8.5 8.5 0 1 0 20.4 15.4Z"/></svg>
      : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41"/></svg>}
  </button>;
}
