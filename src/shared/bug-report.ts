const BUG_REPORT_PATH = "/Maximau5-1989/Retentia/issues/new";

export function normalizeBugReportUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.pathname !== BUG_REPORT_PATH || url.searchParams.get("template") !== "bug_report.md") {
    throw new Error("Bug reports must use Retentia's public GitHub issue template");
  }
  return url.toString();
}

export const BUG_REPORT_URL = normalizeBugReportUrl("https://github.com/Maximau5-1989/Retentia/issues/new?template=bug_report.md");
