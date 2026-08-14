import type { IncomingMessage, ServerResponse } from "node:http";

const BODY_LIMIT_BYTES = 64 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

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

const readHostname = (value: string): string | null => {
  try {
    return new URL(`http://${value}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
};

export const assertLocalRequest = (request: IncomingMessage): void => {
  const host = request.headers.host;
  if (!host || !LOOPBACK_HOSTS.has(readHostname(host) ?? "")) {
    throw new HttpError(403, "Only loopback hosts are accepted.");
  }
  const origin = request.headers.origin;
  if (origin) {
    let originHostname: string | null = null;
    try {
      originHostname = new URL(origin).hostname;
    } catch {
      // Invalid origins are rejected below.
    }
    if (!originHostname || !LOOPBACK_HOSTS.has(originHostname)) {
      throw new HttpError(403, "Only loopback browser origins are accepted.");
    }
  }
};

export const assertJsonContentType = (request: IncomingMessage): void => {
  const contentType = request.headers["content-type"]?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "POST requests require application/json.");
  }
};

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
  const seen = new WeakSet<object>();
  const assertFiniteJson = (value: unknown): void => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new Error("JSON response contains a non-finite number.");
      }
      return;
    }
    if (typeof value !== "object") {
      throw new Error("JSON response contains an unsupported value.");
    }
    if (seen.has(value)) throw new Error("JSON response contains a cycle.");
    seen.add(value);
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      assertFiniteJson(child);
    }
    seen.delete(value);
  };
  assertFiniteJson(payload);
  const serialized = JSON.stringify(payload);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(serialized);
};
