import { redactRecord, redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("removes postgres URLs and sensitive record fields", () => {
    expect(redactSecrets("failed postgresql://user:secret@localhost/db")).toBe(
      "failed postgresql://[redacted]",
    );
    expect(
      redactRecord({
        authorization: "Bearer secret",
        expectedAnswer: "hidden",
        submittedAnswer: "attempt",
        path: "/health",
      }),
    ).toEqual({
      authorization: "[redacted]",
      expectedAnswer: "[redacted]",
      submittedAnswer: "[redacted]",
      path: "/health",
    });
  });
});
