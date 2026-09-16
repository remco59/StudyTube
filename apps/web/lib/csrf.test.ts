import { describe, expect, it } from "vitest";

import { isTrustedStateChangingRequest } from "./csrf";

const base = {
  pathname: "/api/jobs",
  requestOrigin: "https://studytube.example.test",
};

describe("isTrustedStateChangingRequest", () => {
  it("allows safe methods without source headers", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "GET",
        origin: null,
        referer: null,
        secFetchSite: null,
      }),
    ).toBe(true);
  });

  it("allows same-origin state changes", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "POST",
        origin: "https://studytube.example.test",
        referer: null,
        secFetchSite: "same-origin",
      }),
    ).toBe(true);
  });

  it("rejects cross-site browser requests even when the target origin is spoofed in another header", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "POST",
        origin: "https://studytube.example.test",
        referer: null,
        secFetchSite: "cross-site",
      }),
    ).toBe(false);
  });

  it("rejects a mismatched Origin or Referer", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "POST",
        origin: "https://evil.example.test",
        referer: null,
        secFetchSite: null,
      }),
    ).toBe(false);

    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "DELETE",
        origin: null,
        referer: "https://evil.example.test/form",
        secFetchSite: null,
      }),
    ).toBe(false);
  });

  it("fails closed when a state-changing API request has no browser source metadata", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        method: "POST",
        origin: null,
        referer: null,
        secFetchSite: null,
      }),
    ).toBe(false);
  });

  it("does not apply CSRF validation outside API routes", () => {
    expect(
      isTrustedStateChangingRequest({
        ...base,
        pathname: "/settings",
        method: "POST",
        origin: null,
        referer: null,
        secFetchSite: "cross-site",
      }),
    ).toBe(true);
  });
});
