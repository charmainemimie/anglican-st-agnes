// Unit tests for the tribute maths. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { account, allocate, feeFor, ledger, DEFAULT_FEES } from "./tribute.js";

const girl = { joined: 2022, status: "active" };

test("$2 a year before 2025, $5 from 2025", () => {
  assert.equal(feeFor(DEFAULT_FEES, 2019), 200);
  assert.equal(feeFor(DEFAULT_FEES, 2024), 200);
  assert.equal(feeFor(DEFAULT_FEES, 2025), 500);
  assert.equal(feeFor(DEFAULT_FEES, 2026), 500);
});

test("arrears include every unpaid year up to this year", () => {
  // Paid 2022; 2023 part-paid $1. Owes $1 (2023) + $2 (2024) + $5 (2025) + $5 (2026)
  const acc = account(girl, { 2022: 200, 2023: 100 }, DEFAULT_FEES, 2026);
  assert.equal(acc.owedCents, 1300);
  assert.deepEqual(acc.owingYears, [2023, 2024, 2025, 2026]);
});

test("archived (married) member stops owing after her last year", () => {
  const acc = account({ ...girl, status: "archived", archivedAt: 2023 }, {}, DEFAULT_FEES, 2026);
  assert.equal(acc.owedCents, 400);
});

test("payment fills the oldest years first, with a part payment", () => {
  const { allocations, leftoverCents } = allocate(girl, { 2022: 200 }, DEFAULT_FEES, 700, 2026);
  assert.deepEqual(allocations, [
    { year: 2023, cents: 200 },
    { year: 2024, cents: 200 },
    { year: 2025, cents: 300 },
  ]);
  assert.equal(leftoverCents, 0);
});

test("can pay next year in advance but not further", () => {
  const paidUp = { 2022: 200, 2023: 200, 2024: 200, 2025: 500, 2026: 500 };
  const { allocations, leftoverCents } = allocate(girl, paidUp, DEFAULT_FEES, 1000, 2026);
  assert.deepEqual(allocations, [{ year: 2027, cents: 500 }]);
  assert.equal(leftoverCents, 500);
});

test("ledger shows the dates each year was paid", () => {
  const rows = ledger({ joined: 2025, status: "active" }, { 2025: 500 }, { 2025: ["2025-04-06"] }, DEFAULT_FEES, 2026);
  assert.deepEqual(rows.map((r) => [r.year, r.status, r.paidOn]), [[2026, "owed", []], [2025, "paid", ["2025-04-06"]]]);
});

import { ageOn } from "../routes/register.js";
test("age counts birthdays correctly", () => {
  assert.equal(ageOn("2010-09-26", "2026-09-25"), 15); // birthday tomorrow
  assert.equal(ageOn("2010-09-25", "2026-09-25"), 16); // birthday today
  assert.equal(ageOn(null, "2026-09-25"), null);
});
