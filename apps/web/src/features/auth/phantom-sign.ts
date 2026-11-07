import { AuthClientError } from "./auth-client";
import { messageBytes } from "./signature";

export type MessageSigner = (message: Uint8Array) => Promise<Uint8Array>;

export type PhantomMessageProvider = {
  signMessage: (message: Uint8Array, display: "utf8") => Promise<unknown>;
};

type PhantomHost = {
  phantom?: {
    solana?: {
      signMessage?: PhantomMessageProvider["signMessage"];
    };
  };
};

declare global {
  interface Window {
    phantom?: PhantomHost["phantom"];
  }
}

export function phantomMessageProvider(host: PhantomHost | undefined): PhantomMessageProvider | null {
  const solana = host?.phantom?.solana;
  if (!solana || typeof solana.signMessage !== "function") {
    return null;
  }
  return solana as PhantomMessageProvider;
}

export async function signPreparedMessage(input: {
  message: string;
  adapterSign: MessageSigner | undefined;
  provider: PhantomMessageProvider | null;
}): Promise<Uint8Array> {
  const bytes = new Uint8Array(messageBytes(input.message));
  if (input.provider) {
    return readSignature(await input.provider.signMessage(bytes, "utf8"));
  }
  if (!input.adapterSign) {
    throw new AuthClientError("This wallet cannot sign in. It does not support message signing.", "UNSUPPORTED_SIGNING");
  }
  return input.adapterSign(bytes);
}

function readSignature(result: unknown): Uint8Array {
  const signature = signatureBytes(result);
  if (!signature) {
    throw new AuthClientError("The wallet returned an unusable signature.", "INVALID_SIGNATURE_LENGTH");
  }
  return signature;
}

function signatureBytes(result: unknown): Uint8Array | null {
  const direct = asBytes(result);
  if (direct) {
    return direct;
  }
  if (Array.isArray(result)) {
    const first = result[0] as unknown;
    return signatureBytes(isRecord(first) && "signature" in first ? first.signature : first);
  }
  if (isRecord(result) && "signature" in result) {
    return asBytes(result.signature);
  }
  return null;
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (!ArrayBuffer.isView(value)) {
    return null;
  }
  const view = value as ArrayBufferView;
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
