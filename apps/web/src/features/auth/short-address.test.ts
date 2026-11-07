import { describe, expect, it } from "vitest";
import { shortAddress } from "./short-address";

describe("shortAddress", () => {
  it("keeps a compact wallet label for the marketing account control", () => {
    expect(shortAddress("DZoqPdQQStLw2VRMeQ6ZniqJ8ReNrsa5n42KfXxf2ank")).toBe("DZoq…2ank");
  });
});
