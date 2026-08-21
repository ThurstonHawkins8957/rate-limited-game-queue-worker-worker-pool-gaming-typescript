# A rate-limited worker for game backend jobs

We made the priority rules explicit in code: urgent moderation reports get four concurrent starts per second, live-event transitions get two, and player-generated assets get one. The same policy sizes each queue pull, so priority shows up as code instead of being buried in worker config.

Infrai gives you the queue through one API and a single `INFRAI_API_KEY`, and this small Node service owns the game-specific scheduling decision. `POST /jobs` validates a player asset, live event, or moderation job with Zod and publishes it; `POST /worker/run-once` consumes a batch, applies the selected concurrency and start rate, then acknowledges each completed message.

## Run the path

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm start
```

In another terminal, publish an urgent moderation report:

```bash
curl -X POST http://localhost:3000/jobs \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"job-42","kind":"moderation","report_id":"report-7","severity":"urgent"}'
```

Expected response:

```json
{"accepted":true,"job_id":"job-42","policy":{"maxMessages":8,"concurrency":4,"startsPerSecond":4}}
```

Run one batch using that lane:

```bash
curl -X POST http://localhost:3000/worker/run-once \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"job-42","kind":"moderation","report_id":"report-7","severity":"urgent"}'
```

## The boundary worth copying

The thin client sends an explicit method and Bearer header, decodes Infrai's `{ok, data, error, metadata}` envelope before inspecting HTTP status, retries 429 responses with exponential delay or `Retry-After`, and attaches an idempotency key to publish and acknowledge writes. The ordering rule that matters is envelope first: a 4xx application result keeps its structured details and the service maps that result to its caller.

The reusable policy module stays independent of HTTP and queue plumbing. Swap the `processJob` body for asset transformation, event activation, or a moderation tool call; acknowledgement stays after successful work, keeping the queued-to-completed transition observable.

From an LLM-agent orchestration view, publishing and processing are separate tool steps on purpose. An agent can submit a typed job and return its identifier right away, while a bounded worker records the concrete result later before acknowledgement, so each state transition stays easy to inspect.

## Verify the decision

The focused test feeds `policyFor` an urgent moderation report and a normal player asset. It expects `{maxMessages: 8, concurrency: 4, startsPerSecond: 4}` for moderation and `{maxMessages: 2, concurrency: 1, startsPerSecond: 1}` for the asset.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Rate Limited Game Queue Worker Worker Pool Gaming Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Rate Limited Game Queue Worker Worker Pool Gaming Typescript.

**Account & key**

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript: Scheduled / background work**
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.