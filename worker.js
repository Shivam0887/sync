//This worker periodically grabs the presence:dirty set, writes last_seen_at into Postgres for those users, and clears the set. Run this as a separate process (see package.json script "worker").

require("dotenv").config();
const Redis = require("ioredis");
const { Pool } = require("pg");

const {
  REDIS_URL,
  FLUSH_INTERVAL_SECONDS = 30,
  dirtySetKey = "presence:dirty",
} = process.env;

const redis = new Redis(REDIS_URL);
const pg = new Pool();

async function flushOnce() {
  try {
    const users = await redis.smembers(dirtySetKey);
    if (!users || users.length === 0) return;
    const now = new Date().toISOString();

    // Begin transaction and upsert last_seen
    const client = await pg.connect();
    try {
      await client.query("BEGIN");
      for (const uid of users) {
        await client.query(
          `INSERT INTO user_status (user_id, last_seen_at)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
          [uid, now]
        );
      }
      await client.query("COMMIT");
      // remove from dirty set
      await redis.srem(dirtySetKey, users);
      console.log(`Flushed ${users.length} users to DB`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DB flush error", e);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("flushOnce error", e);
  }
}

async function runLoop() {
  while (true) {
    await flushOnce();
    await new Promise((r) =>
      setTimeout(r, Number(FLUSH_INTERVAL_SECONDS) * 1000)
    );
  }
}

runLoop().catch((e) => {
  console.error("worker failed", e);
  process.exit(1);
});
