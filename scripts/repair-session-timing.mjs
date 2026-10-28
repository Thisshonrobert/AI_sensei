import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { hasIdleGap } from '../src/lib/server/review/timing.mjs';

const apply = process.argv.includes('--apply');
const url = new URL(await localDatabaseUrl());
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local database required');
const db = new PrismaClient({ datasourceUrl: url.toString(), errorFormat: 'minimal' });
const now = new Date();
try {
  const open = await db.studySession.findMany({ where: { mode: 'daily', status: 'active' }, select: { id: true, status: true, activeSince: true, elapsedActiveMs: true } });
  const stale = open.filter(session => hasIdleGap(session, now));
  console.log(JSON.stringify({ open: open.length, stale: stale.length, apply }));
  if (apply && stale.length) await db.studySession.updateMany({ where: { id: { in: stale.map(session => session.id) } }, data: { status: 'paused', activeSince: null } });
} finally { await db.$disconnect(); }
