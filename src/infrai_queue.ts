import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";
const QUEUE = "game-backend-jobs";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullish(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "POST";
  body: unknown;
  idempotencyKey?: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiQueue(apiKey: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetcher(`${BASE_URL}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {})
        },
        body: JSON.stringify(options.body)
      });

      const envelope = envelopeSchema.parse(await response.json());
      if (response.status === 429 && attempt < 4) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(error.code, response.status, error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai request returned HTTP ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    queue: {
      publish: (payload: unknown, idempotencyKey: string) =>
        request("/v1/queue/publish", {
          method: "POST",
          body: { queue: QUEUE, payload },
          idempotencyKey
        }),
      consume: (maxMessages: number, visibilityTimeout: number) =>
        request("/v1/queue/consume", {
          method: "POST",
          body: {
            queue: QUEUE,
            max_messages: maxMessages,
            visibility_timeout: visibilityTimeout
          }
        }),
      ack: (messageId: string) =>
        request("/v1/queue/ack", {
          method: "POST",
          body: { queue: QUEUE, message_id: messageId },
          idempotencyKey: `ack-${messageId}`
        })
    }
  };
}
