import { describe, expect, it } from "vitest";
import { isProtectedUrl, normalizeProtectedDomain } from "./protection";

describe("protected websites", () => {
  it("protects a domain and all of its subdomains", () => {
    expect(isProtectedUrl("https://secure.example.com/account", ["example.com"])).toBe(true);
    expect(isProtectedUrl("https://notexample.com", ["example.com"])).toBe(false);
  });

  it("normalizes user input before storage", () => {
    expect(normalizeProtectedDomain("https://WWW.Example.com/private")).toBe("example.com");
  });
});
