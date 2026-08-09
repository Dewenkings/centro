import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CANDIDATES,
  MAX_PARTICIPANTS,
  limitCandidates,
  limitParticipants,
} from "../lib/agent/limits";

test("keeps participant lists within the public demo maximum", () => {
  const participants = ["A", "B", "C"];

  assert.equal(MAX_PARTICIPANTS, 4);
  assert.deepEqual(limitParticipants(participants), participants);
});

test("truncates participant lists above four entries", () => {
  const participants = ["A", "B", "C", "D", "E"];

  assert.deepEqual(limitParticipants(participants), ["A", "B", "C", "D"]);
});

test("keeps candidate lists within the routing maximum", () => {
  const candidates = [1, 2, 3, 4];

  assert.equal(MAX_CANDIDATES, 5);
  assert.deepEqual(limitCandidates(candidates), candidates);
});

test("truncates candidate lists above five entries", () => {
  const candidates = [1, 2, 3, 4, 5, 6, 7];

  assert.deepEqual(limitCandidates(candidates), [1, 2, 3, 4, 5]);
});
