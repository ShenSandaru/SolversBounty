import { decryptAnswer, encryptAnswer, parseAnswerKey } from "./answer-cipher";

describe("answer cipher", () => {
  it("rejects a missing or invalid key without echoing the value", () => {
    expect(() => parseAnswerKey(undefined)).toThrow(
      expect.objectContaining({ status: 503, code: "NOT_READY", message: "Answer protection is not configured." }),
    );
    expect(() => parseAnswerKey("short-key")).toThrow(
      expect.objectContaining({ status: 503, code: "NOT_READY" }),
    );
    try {
      parseAnswerKey("not-a-valid-key");
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain("not-a-valid-key");
    }
  });

  it("round-trips a 32-byte base64url key", () => {
    const key = parseAnswerKey(Buffer.alloc(32, 7).toString("base64url"));
    const payload = encryptAnswer("door-A", key);
    expect(payload.startsWith("v1.")).toBe(true);
    expect(payload).not.toContain("door-A");
    expect(decryptAnswer(payload, key)).toBe("door-A");
  });
});
