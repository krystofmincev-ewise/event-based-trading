import type { IncomingMessage, ServerResponse } from "node:http";

const BODY_LIMIT_BYTES = 64 * 1024;

const toBuffer = (value: unknown): Buffer => {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value === "string" || value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  throw new HttpError(400, "Request body contains an unsupported chunk.");
};

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

export const readJsonBody = async (
  request: IncomingMessage,
): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = toBuffer(chunk as unknown);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > BODY_LIMIT_BYTES) {
      throw new HttpError(413, "Request body exceeds 64 KiB.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
};

export const sendJson = (
  response: ServerResponse,
  status: number,
  payload: unknown,
): void => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
};
