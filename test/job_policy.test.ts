import assert from "node:assert/strict";
import test from "node:test";
import { policyFor } from "../src/job_policy.js";

test("urgent moderation gets the widest controlled worker lane", () => {
  const urgent = policyFor({
    job_id: "job-42",
    kind: "moderation",
    report_id: "report-7",
    severity: "urgent"
  });
  const asset = policyFor({
    job_id: "job-43",
    kind: "player_asset",
    player_id: "player-9",
    asset_key: "emblems/phoenix"
  });

  assert.deepEqual(urgent, { maxMessages: 8, concurrency: 4, startsPerSecond: 4 });
  assert.deepEqual(asset, { maxMessages: 2, concurrency: 1, startsPerSecond: 1 });
});
