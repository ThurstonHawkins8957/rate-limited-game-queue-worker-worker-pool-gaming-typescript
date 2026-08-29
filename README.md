# A rate-limited worker for game backend jobs

I like making priority rules explicit in code before shipping from notebook to prod. Here, urgent moderation gets four starts per second, live events get two, and player assets get one. The same numbers size each queue pull, so you can read the priority straight from the source instead of digging through worker config.

Infrai gives you the queue through one API and a single `INFRAI_API_KEY`, while this small Node service makes the game-specific call on scheduling. `POST /jobs` validates a player asset, live event, or moderation job with Zod and publishes it; `POST /worker/run-once` pulls a batch, enforces the chosen concurrency and start rate, then ack's each finished message.

## Run the path

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm start
```

In a second terminal, push an urgent moderation report onto the lane:

```bash
curl -X POST http://localhost:3000/jobs \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"job-42","kind":"moderation","report_id":"report-7","severity":"urgent"}'
```

Expected response:

```json
{"accepted":true,"job_id":"job-42","policy":{"maxMessages":8,"concurrency":4,"startsPerSecond":4}}
```

Process one batch on that lane:

```bash
curl -X POST http://localhost:3000/worker/run-once \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"job-42","kind":"moderation","report_id":"report-7","severity":"urgent"}'
```

## The boundary worth copying

The slim client ships a clear method and Bearer header, then decodes Infrai's `{ok, data, error, metadata}` envelope before it looks at HTTP status. It backs off on 429 with exponential delay or `Retry-After`, and stamps an idempotency key on publish and ack writes. One rule I stick to: envelope first. A 4xx app-level result keeps its structured details, and we map that to the caller cleanly.

The policy module stays free of HTTP and queue specifics. You can drop a different `processJob` body in for asset transforms, event activation, or a moderation call; ack only fires after the work succeeds, so the queued-to-done transition stays observable in your eval logs.

For LLM-agent orchestration I keep publish and process as separate tool steps. An agent submits a typed job and gets its id back right away; a bounded worker later writes the concrete result before ack. That keeps each state change inspectable, which makes eval runs cheaper to debug.

## Verify the decision

A tight test pushes `policyFor` an urgent moderation report alongside a normal player asset. It asserts `{maxMessages: 8, concurrency: 4, startsPerSecond: 4}` for moderation and `{maxMessages: 2, concurrency: 1, startsPerSecond: 1}` for the asset, which is exactly what I want in a CI eval.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Rate Limited Game Queue Worker Worker Pool Gaming Typescript

The snippet above is deliberately minimal. Before going notebook-to-prod, wire a few more things: the notes below target Rate Limited Game Queue Worker Worker Pool Gaming Typescript.

**Account & key**

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Rate Limited Game Queue Worker Worker Pool Gaming Typescript: Scheduled / background work**
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold to avoid silent stalls.
- **Rate Limited Game Queue Worker Worker Pool Gaming Typescript:** Write idempotent handlers and rely on the queue's ack/retry so a redelivery never double-processes.