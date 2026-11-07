const SECRET_KEY = /authorization|cookie|token|secret|password|expectedanswer|submittedanswer|explanation|database_url|answer_encryption|treasury/i;
const POSTGRES_URL = /postgres(?:ql)?:\/\/\S+/gi;

export function redactSecrets(text: string): string {
  return text.replace(POSTGRES_URL, "postgresql://[redacted]");
}

export function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      SECRET_KEY.test(key) ? "[redacted]" : typeof value === "string" ? redactSecrets(value) : value,
    ]),
  );
}
