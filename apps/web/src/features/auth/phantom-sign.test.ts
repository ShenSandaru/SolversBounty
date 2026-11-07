import { describe, expect, it, vi } from "vitest";
import { messageBytes } from "./signature";
import { phantomMessageProvider, signPreparedMessage, type PhantomMessageProvider } from "./phantom-sign";

const message = "SolversBounty login\nWallet: wallet";

describe("Phantom login signing", () => {
  it("asks Phantom to display the login message as utf8", async () => {
    const signature = new Uint8Array(64).fill(7);
    const signMessage = vi.fn<PhantomMessageProvider["signMessage"]>(async () => ({ signature }));
    const signed = await signPreparedMessage({
      message,
      adapterSign: async () => new Uint8Array(64),
      provider: { signMessage },
    });
    expect(Array.from(signed)).toEqual(Array.from(signature));
    expect(signMessage).toHaveBeenCalledTimes(1);
    const [bytes, display] = signMessage.mock.calls[0] ?? [];
    expect(display).toBe("utf8");
    expect(Array.from(bytes ?? [])).toEqual(Array.from(messageBytes(message)));
  });

  it("accepts a signature array from the wallet standard", async () => {
    const signature = new Uint8Array(64).fill(3);
    const signed = await signPreparedMessage({
      message,
      adapterSign: undefined,
      provider: { signMessage: async () => [{ signature }] },
    });
    expect(Array.from(signed)).toEqual(Array.from(signature));
  });

  it("uses the adapter when Phantom's provider is absent", async () => {
    const adapterSign = vi.fn(async () => new Uint8Array(64).fill(1));
    await signPreparedMessage({ message, adapterSign, provider: null });
    expect(adapterSign).toHaveBeenCalledOnce();
  });

  it("reads the injected Phantom provider", () => {
    const signMessage = vi.fn();
    expect(phantomMessageProvider({ phantom: { solana: { signMessage } } })).toEqual({ signMessage });
    expect(phantomMessageProvider({})).toBeNull();
  });
});
