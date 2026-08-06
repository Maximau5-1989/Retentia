export function ThemeButton({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  return <button className="btn-secondary grid h-10 w-10 place-items-center !p-0 text-lg" onClick={onToggle} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
    {theme === "light" ? "☾" : "☀"}
  </button>;
}
