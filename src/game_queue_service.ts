import { createServer } from "node:http";
import { z } from "zod";
import { createInfraiQueue, InfraiError } from "./infrai_queue.js";
import { gameJobSchema, policyFor, runLimited, type GameJob } from "./job_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = createInfraiQueue(apiKey);
const messageSchema = z.object({
  message_id: z.string().min(1),
  payload: gameJobSchema
});
const consumeDataSchema = z.object({ items: z.array(messageSchema) });

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function processJob(job: GameJob): Promise<void> {
  const result =
    job.kind === "player_asset" ? `asset:${job.asset_key}` :
    job.kind === "live_event" ? `event:${job.event_id}:${job.action}` :
    `report:${job.report_id}:${job.severity}`;
  console.log(JSON.stringify({ job_id: job.job_id, result }));
}

async function consumeOnce(sample: GameJob): Promise<number> {
  const policy = policyFor(sample);
  const data = consumeDataSchema.parse(
    await infrai.queue.consume(policy.maxMessages, 30)
  );
  await runLimited(data.items, policy, async (message) => {
    await processJob(message.payload);
    await infrai.queue.ack(message.message_id);
  });
  return data.items.length;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/jobs") {
      const job = gameJobSchema.parse(await readJson(request));
      await infrai.queue.publish(job, `game-job-${job.job_id}`);
      reply(response, 202, { accepted: true, job_id: job.job_id, policy: policyFor(job) });
      return;
    }
    if (request.method === "POST" && request.url === "/worker/run-once") {
      const sample = gameJobSchema.parse(await readJson(request));
      reply(response, 200, { processed: await consumeOnce(sample) });
      return;
    }
    reply(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply(response, 400, { error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      reply(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        details: error.details
      });
      return;
    }
    reply(response, 500, { error: "worker_error" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Game queue service listening on http://localhost:3000");
});
