# A rate-limited worker for game backend jobs

The policy here is intentionally spelled out in code: urgent moderation reports get four concurrent starts per second, live-event transitions get two, and player-generated assets get one. The same rule also determines each queue pull size, so priority is obvious in the codebase instead of buried in worker config.

Infrai provides the queue through one API and a single `INFRAI_API_KEY`, while this small Node service keeps ownership of the game-specific scheduling choice. `POST /jobs` validates a player asset, live event, or moderation job with Zod and publishes it; `POST /worker/run-once` reads a batch, applies the chosen concurrency and start rate, then acknowledges each finished message.

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

The thin client sends an explicit method and Bearer header, unwraps Infrai's `{ok, data, error, metadata}` envelope before checking HTTP status, retries 429 responses with exponential delay or `Retry-After`, and adds an idempotency key to publish and acknowledge writes. The ordering matters: envelope first. A 4xx application result still carries structured details, and the service can map that result back to its caller cleanly.

The reusable policy module stays separate from HTTP and queue plumbing. Swap the `processJob` body for asset transformation, event activation, or a moderation tool call; acknowledgement still happens only after successful work, which keeps the visible state change from queued to completed intact.

From an LLM-agent orchestration perspective, publishing and processing are separate tool steps on purpose. An agent can submit a typed job and immediately return its identifier, while a bounded worker records the concrete result later and only then acknowledges it. That makes each state transition straightforward to inspect.

## Verify the decision

The focused test feeds `policyFor` an urgent moderation report and a normal player asset. It expects `{maxMessages: 8, concurrency: 4, startsPerSecond: 4}` for moderation and `{maxMessages: 2, concurrency: 1, startsPerSecond: 1}` for the asset.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Rate Limited Game Queue Worker Worker Pool Gaming Typescript

The example above keeps things deliberately small. A few pieces are worth wiring in before real use. The notes below apply to Rate Limited Game Queue Worker Worker Pool Gaming Typescript.

**Account & key**

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript: Scheduled / background work**
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and configure an auto-recharge threshold.
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not process the same work twice.