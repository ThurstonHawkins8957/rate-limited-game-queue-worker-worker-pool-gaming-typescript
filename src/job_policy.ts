import { z } from "zod";

export const gameJobSchema = z.discriminatedUnion("kind", [
  z.object({
    job_id: z.string().min(1),
    kind: z.literal("player_asset"),
    player_id: z.string().min(1),
    asset_key: z.string().min(1)
  }),
  z.object({
    job_id: z.string().min(1),
    kind: z.literal("live_event"),
    event_id: z.string().min(1),
    action: z.enum(["open", "close"])
  }),
  z.object({
    job_id: z.string().min(1),
    kind: z.literal("moderation"),
    report_id: z.string().min(1),
    severity: z.enum(["normal", "urgent"])
  })
]);

export type GameJob = z.infer<typeof gameJobSchema>;

export type WorkerPolicy = {
  maxMessages: number;
  concurrency: number;
  startsPerSecond: number;
};

export function policyFor(job: GameJob): WorkerPolicy {
  if (job.kind === "moderation" && job.severity === "urgent") {
    return { maxMessages: 8, concurrency: 4, startsPerSecond: 4 };
  }
  if (job.kind === "live_event") {
    return { maxMessages: 4, concurrency: 2, startsPerSecond: 2 };
  }
  return { maxMessages: 2, concurrency: 1, startsPerSecond: 1 };
}

export async function runLimited<T>(
  items: T[],
  policy: WorkerPolicy,
  work: (item: T) => Promise<void>,
  sleep: (milliseconds: number) => Promise<void> =
    (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
): Promise<void> {
  const interval = 1_000 / policy.startsPerSecond;
  let nextStart = 0;
  const active = new Set<Promise<void>>();

  for (const item of items) {
    if (active.size >= policy.concurrency) await Promise.race(active);
    const delay = Math.max(0, nextStart - Date.now());
    if (delay > 0) await sleep(delay);
    nextStart = Date.now() + interval;

    const task = work(item).finally(() => active.delete(task));
    active.add(task);
  }
  await Promise.all(active);
}
