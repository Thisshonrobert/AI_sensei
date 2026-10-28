import test from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_GAP_MS, hasIdleGap, sessionElapsedMs } from '../src/lib/server/review/timing.mjs';

const at = new Date('2026-10-18T10:00:00Z');
const open = overrides => ({ status: 'active', elapsedActiveMs: 0, activeSince: at, ...overrides });

test('a fresh open segment counts, an abandoned segment does not', () => {
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - 60_000) }), at), 60_000);
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - IDLE_GAP_MS) }), at), IDLE_GAP_MS);
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - IDLE_GAP_MS - 1) }), at), 0);
  assert.equal(hasIdleGap(open({ activeSince: new Date(at - IDLE_GAP_MS - 1) }), at), true);
});

test('saved time is retained and clamped, paused time never accrues', () => {
  assert.equal(sessionElapsedMs(open({ elapsedActiveMs: 5 * 60_000, activeSince: new Date(at - 60_000) }), at), 6 * 60_000);
  assert.equal(sessionElapsedMs({ status: 'paused', elapsedActiveMs: 7, activeSince: null }, at), 7);
  assert.equal(sessionElapsedMs(open({ elapsedActiveMs: 2_147_483_647, activeSince: new Date(at - 60_000) }), at), 2_147_483_647);
});
