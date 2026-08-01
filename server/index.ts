import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { COOKIE_NAME, COOKIE_SECRET, verifyPassword } from './auth.ts';
import { Rating } from '../src/fsrs/recall-scheduler.ts';
import * as repo from './repo.ts';

const app = Fastify({ logger: true });
await app.register(cookie, { secret: COOKIE_SECRET });

const PORT = Number(process.env.PORT ?? 8787);
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

// ---- auth helpers ----
function setAuthCookie(reply: any, userId: string) {
  reply.setCookie(COOKIE_NAME, userId, { path: '/', httpOnly: true, sameSite: 'lax', signed: true, maxAge: 60 * 60 * 24 * 30 });
}
function currentUserId(req: any): string | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}
function requireUser(req: any, reply: any): string | null {
  const id = currentUserId(req);
  if (!id) {
    reply.code(401).send({ error: 'Not authenticated' });
    return null;
  }
  return id;
}

// ---- auth routes ----
app.post('/api/auth/register', async (req, reply) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  const u = (username ?? '').trim();
  if (!u) return reply.code(400).send({ error: 'Enter a username' });
  if ((password ?? '').length < 4) return reply.code(400).send({ error: 'Password must be at least 4 characters' });
  if (repo.getUserByUsername(u)) return reply.code(409).send({ error: 'That username is taken' });
  const user = repo.createUser(u, password!);
  setAuthCookie(reply, user.id);
  return { user };
});

app.post('/api/auth/login', async (req, reply) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  const u = (username ?? '').trim();
  if (!u) return reply.code(400).send({ error: 'Enter a username' });
  const found = repo.getUserByUsername(u);
  if (!found || !verifyPassword(password ?? '', found.password_hash)) {
    return reply.code(401).send({ error: 'Wrong username or password' });
  }
  setAuthCookie(reply, found.id);
  const { password_hash, ...user } = found;
  return { user };
});

app.post('/api/auth/logout', async (_req, reply) => {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
  return { ok: true };
});

app.get('/api/me', async (req, reply) => {
  const id = currentUserId(req);
  const user = id ? repo.getUser(id) : undefined;
  if (!user) return reply.code(401).send({ error: 'Not authenticated' });
  return { user };
});

// ---- data routes ----
app.get('/api/decks', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return { decks: repo.getDecks(id) };
});

app.post('/api/decks', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const { name } = (req.body ?? {}) as { name?: string };
  const n = (name ?? '').trim();
  if (!n) return reply.code(400).send({ error: 'Enter a deck name' });
  return { deck: repo.createDeck(id, n) };
});

app.post('/api/cards', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const body = (req.body ?? {}) as { deckId?: string; front?: string; back?: string; example?: string; type?: string; mnemonic?: string; image?: string };
  const f = (body.front ?? '').trim();
  const b = (body.back ?? '').trim();
  if (!body.deckId || !f || !b) return reply.code(400).send({ error: 'deckId, front and back are required' });
  const card = repo.addCard(id, body.deckId, {
    front: f,
    back: b,
    example: (body.example ?? '').trim() || null,
    type: body.type === 'cloze' ? 'cloze' : 'basic',
    mnemonic: (body.mnemonic ?? '').trim() || null,
    image: (body.image ?? '').trim() || null,
  });
  if (!card) return reply.code(404).send({ error: 'Deck not found' });
  return { card };
});

app.delete('/api/cards/:id', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const cardId = (req.params as { id: string }).id;
  if (!repo.deleteCard(id, cardId)) return reply.code(404).send({ error: 'Card not found' });
  return { ok: true };
});

app.delete('/api/decks/:id', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const deckId = (req.params as { id: string }).id;
  if (!repo.deleteDeck(id, deckId)) return reply.code(404).send({ error: 'Deck not found' });
  return { ok: true };
});

app.post('/api/cards/:id/answer', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const cardId = (req.params as { id: string }).id;
  const { rating } = (req.body ?? {}) as { rating?: number };
  if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating as Rating)) {
    return reply.code(400).send({ error: 'rating must be 1..4' });
  }
  const result = repo.answerCard(id, cardId, rating as Rating);
  if (!result) return reply.code(404).send({ error: 'Card not found' });
  return result;
});

app.get('/api/history', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return repo.getHistory(id, 126);
});

app.patch('/api/settings', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  const { newLimit, studyDirection } = (req.body ?? {}) as { newLimit?: number; studyDirection?: 'front' | 'back' | 'both' };
  const user = repo.updateSettings(id, { newLimit, studyDirection });
  if (!user) return reply.code(404).send({ error: 'Not found' });
  return { user };
});

app.get('/api/today', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return repo.getTodayCounts(id);
});

app.get('/api/retention', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return repo.getRetention(id, 7);
});

app.get('/api/hardest', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return { cards: repo.getHardest(id, 10) };
});

app.get('/api/leaderboard', async (req, reply) => {
  const id = requireUser(req, reply);
  if (!id) return;
  return { rows: repo.getLeaderboard() };
});

// ---- static SPA (production) ----
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile('index.html'); // SPA fallback
  });
}

app.listen({ port: PORT, host: '0.0.0.0' }).then((addr) => app.log.info(`Recall API on ${addr}`));
