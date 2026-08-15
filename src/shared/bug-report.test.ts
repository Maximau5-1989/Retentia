import { describe, expect, it } from "vitest";
import { BUG_REPORT_URL, normalizeBugReportUrl } from "./bug-report";

describe("bug report link", () => {
  it("uses Retentia's public GitHub issue template", () => {
    expect(BUG_REPORT_URL).toBe("https://github.com/Maximau5-1989/Retentia/issues/new?template=bug_report.md");
  });

  it("rejects insecure or unrelated issue links", () => {
    expect(() => normalizeBugReportUrl("http://github.com/Maximau5-1989/Retentia/issues/new?template=bug_report.md")).toThrow();
    expect(() => normalizeBugReportUrl("https://github.com/another/project/issues/new?template=bug_report.md")).toThrow();
    expect(() => normalizeBugReportUrl("https://github.example.com/Maximau5-1989/Retentia/issues/new?template=bug_report.md")).toThrow();
  });
});
