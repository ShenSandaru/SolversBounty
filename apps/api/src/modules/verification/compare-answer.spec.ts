import { answersMatch } from "./compare-answer";

describe("answer comparison", () => {
  it("matches exact text only", () => {
    expect(answersMatch("exact", "42", "42")).toBe(true);
    expect(answersMatch("exact", "42", " 42 ")).toBe(false);
    expect(answersMatch("exact", "42", "42 ")).toBe(false);
  });

  it("ignores case and keeps surrounding spaces", () => {
    expect(answersMatch("case_insensitive", "Paris", "paris")).toBe(true);
    expect(answersMatch("case_insensitive", "Paris", " paris")).toBe(false);
  });

  it("trims and collapses whitespace without changing case", () => {
    expect(answersMatch("normalized_text", "42", " 42 ")).toBe(true);
    expect(answersMatch("normalized_text", "Hello world", "Hello  world")).toBe(true);
    expect(answersMatch("normalized_text", "Hello", "hello")).toBe(false);
  });

  it("compares trimmed decimal text without a tolerance", () => {
    expect(answersMatch("numeric_exact", "42", " 42 ")).toBe(true);
    expect(answersMatch("numeric_exact", "42", "42.0")).toBe(false);
    expect(answersMatch("numeric_exact", "42", "forty-two")).toBe(false);
  });
});
