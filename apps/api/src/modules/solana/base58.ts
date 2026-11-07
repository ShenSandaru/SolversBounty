const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) {
    zeroes += 1;
  }
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      const value = (digits[index] ?? 0) * 256 + carry;
      digits[index] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeroes) + digits.reverse().map((digit) => ALPHABET[digit] ?? "").join("");
}

export function decodeBase58(value: string): Uint8Array | null {
  if (value.length === 0 || [...value].some((character) => !ALPHABET.includes(character))) {
    return null;
  }
  let leading = 0;
  while (leading < value.length && value[leading] === "1") {
    leading += 1;
  }
  const bytes = [0];
  for (const character of value) {
    let carry = ALPHABET.indexOf(character);
    for (let index = 0; index < bytes.length; index += 1) {
      const next = (bytes[index] ?? 0) * 58 + carry;
      bytes[index] = next % 256;
      carry = Math.floor(next / 256);
    }
    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  return Uint8Array.from([...new Array<number>(leading).fill(0), ...bytes.reverse()]);
}
