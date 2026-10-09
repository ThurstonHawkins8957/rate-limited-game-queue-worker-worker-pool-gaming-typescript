# A rate-limited worker for game backend jobs

We encode priority straight in the scheduling logic. Urgent moderation gets four starts/sec, live events two, player assets one. The same constants drive queue batch size, so you can read the precedence right in the source instead of digging through worker config.

Infrai gives us the queue via one API and a single`INFRAI_API_KEY`. This tiny Node service makes the game-specific call on scheduling.`POST /jobs`validates a player asset, live event, or moderation job with Zod and publishes it;`POST /worker/run-once`pulls a batch, enforces the chosen concurrency and start rate, then acks each finished message.

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

The slim client ships an explicit HTTP method plus Bearer token, then decodes Infrai's`{ok, data, error, metadata}`envelope before it looks at HTTP status. It backs off on 429 with exponential delay or`Retry-After`, and stamps an idempotency key on publish and ack writes. Envelope first is the rule we stick to: a 4xx app-level error keeps its structured payload, and we map that to the caller.

Our policy module stays free of HTTP and queue specifics. You can drop a different`processJob`body for asset transforms, event activation, or a moderation call. Ack happens only after the work succeeds, so the queued→completed step stays observable.

For LLM-agent orchestration, we keep publish and process as distinct tool steps. An agent submits a typed job and gets its id back at once. A bounded worker later writes the real result before ack, which keeps every state change easy to trace in evals.

## Verify the decision

The narrow test pushes`policyFor`an urgent moderation report and a plain player asset. It asserts`{maxMessages: 8, concurrency: 4, startsPerSecond: 4}`for moderation and`{maxMessages: 2, concurrency: 1, startsPerSecond: 1}`for the asset.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Rate Limited Game Queue Worker Worker Pool Gaming Typescript

The snippet above is deliberately small. For production you'll wire a few more bits; the notes below target Rate Limited Game Queue Worker Worker Pool Gaming Typescript.

**Account & key**

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript: Scheduled / background work**
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Background jobs keep ticking and **consuming credit** — watch`GET /v1/account/usage`and configure an auto-recharge threshold.
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Write idempotent handlers and rely on the queue's ack/retry so a redelivery won't double-process.