import test from 'node:test';
import assert from 'node:assert/strict';
import { findAvailablePort } from '../scripts/dev-server.mjs';

test('development server falls back to port 3002 when port 3001 is unavailable', async () => {
  const attemptedPorts = [];
  const port = await findAvailablePort(3001, 3002, async candidate => {
    attemptedPorts.push(candidate);
    return candidate === 3002;
  });

  assert.equal(port, 3002);
  assert.deepEqual(attemptedPorts, [3001, 3002]);
});
