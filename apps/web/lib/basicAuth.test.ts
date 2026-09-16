import { describe, expect, it } from "vitest";

import { constantTimeStringEqual, parseBasicAuthorization } from "./basicAuth";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("parseBasicAuthorization", () => {
  it("parses UTF-8 Basic credentials and preserves colons in the password", () => {
    expect(parseBasicAuthorization(basic("remco", "päss:word"))).toEqual({
      username: "remco",
      password: "päss:word",
    });
  });

  it("rejects missing, malformed, or non-Basic authorization", () => {
    expect(parseBasicAuthorization(null)).toBeNull();
    expect(parseBasicAuthorization("Bearer token")).toBeNull();
    expect(parseBasicAuthorization("Basic !!!not-base64!!!")).toBeNull();
    expect(parseBasicAuthorization(`Basic ${Buffer.from("missing-separator").toString("base64")}`)).toBeNull();
  });
});

describe("constantTimeStringEqual", () => {
  it("compares equal and unequal strings without an early length return", () => {
    expect(constantTimeStringEqual("admin", "admin")).toBe(true);
    expect(constantTimeStringEqual("admin", "other")).toBe(false);
    expect(constantTimeStringEqual("short", "longer-value")).toBe(false);
  });
});
