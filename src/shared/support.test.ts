import { describe, expect, it } from "vitest";
import { normalizeSupportUrl, SUPPORT_URL } from "./support";

describe("support link", () => {
  it("uses the configured public PayPal.Me profile", () => {
    expect(SUPPORT_URL).toBe("https://paypal.me/Maximau5");
  });

  it("rejects insecure, deceptive, and account-management links", () => {
    expect(() => normalizeSupportUrl("http://paypal.me/Maximau5")).toThrow();
    expect(() => normalizeSupportUrl("https://paypal.me.example.com/Maximau5")).toThrow();
    expect(() => normalizeSupportUrl("https://www.paypal.com/paypalme/my/profile")).toThrow();
  });
});
