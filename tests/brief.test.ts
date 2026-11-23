import { test } from "node:test";
import assert from "node:assert/strict";
import { BriefSchema, TurnSchema, normalizeScorecard, toMarkdown } from "../src/lib/brief";

const card = (weights: number[]) =>
  BriefSchema.parse({
    scorecard: weights.map((weight, i) => ({ criterion: `c${i}`, weight, fullMarks: "x" })),
  });
const total = (b: ReturnType<typeof card>) => b.scorecard.reduce((s, c) => s + c.weight, 0);

test("scorecard already totalling 100 is left unchanged", () => {
  const b = normalizeScorecard(card([40, 30, 20, 10]));
  assert.deepEqual(b.scorecard.map((c) => c.weight), [40, 30, 20, 10]);
});

test("scorecard that does not total 100 is rescaled to exactly 100", () => {
  for (const w of [[40, 30, 20], [50, 50, 50], [10, 10, 10, 10, 10], [33, 33, 33], [1, 1, 1]]) {
    assert.equal(total(normalizeScorecard(card(w))), 100, `weights ${w}`);
  }
});

test("empty scorecard and zero weights do not crash", () => {
  assert.equal(normalizeScorecard(card([])).scorecard.length, 0);
  assert.deepEqual(normalizeScorecard(card([0, 0])).scorecard.map((c) => c.weight), [0, 0]);
});

test("shareable markdown omits internal notes; full markdown includes them", () => {
  const b = BriefSchema.parse({
    roleTitle: "Engineer",
    internalNotes: ["Top of range is $190k"],
    openQuestions: ["Equity range"],
  });
  const shareable = toMarkdown(b, false);
  const full = toMarkdown(b, true);
  assert.ok(!shareable.includes("190k"), "internal note leaked into shareable export");
  assert.ok(!shareable.includes("INTERNAL"));
  assert.ok(full.includes("INTERNAL") && full.includes("190k"));
  assert.ok(shareable.includes("Still to confirm") && shareable.includes("Equity range"));
});

test("markdown includes the scorecard table and verdict bands", () => {
  const md = toMarkdown(normalizeScorecard(card([60, 40])), false);
  assert.ok(md.includes("| c0 | 60 | x |"));
  assert.ok(md.includes("75+ Good fit") && md.includes("under 55 Not a fit"));
});

test("a model turn with missing optional fields still parses", () => {
  const t = TurnSchema.parse({ message: "hi", brief: {} });
  assert.equal(t.completeness, 0);
  assert.equal(t.ready, false);
  assert.deepEqual(t.brief.mustHaves, []);
});

test("a turn with an out-of-range completeness is rejected", () => {
  assert.throws(() => TurnSchema.parse({ message: "hi", brief: {}, completeness: 150 }));
});
