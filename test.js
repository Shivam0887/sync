require("dotenv").config();
const express = require("express");
const http = require("http");
const morgan = require("morgan");
const { Server } = require("socket.io");
const Redis = require("ioredis");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const {
  PORT = 3000,
  REDIS_URL,
  JWT_SECRET,
  HEARTBEAT_TTL_SECONDS = 90,
  PRESENCE_PUBSUB_CHANNEL = "presence:updates",
} = process.env;

const redis = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL); // subscriber connection
const redisPub = new Redis(REDIS_URL); // publisher connection
const pg = new Pool(); // uses env PG* vars

const app = express();
app.use(express.json());
app.use(morgan("dev"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ---- helpers ----
const heartbeatKey = (userId, deviceId) => `presence:hb:${userId}:${deviceId}`;
const dirtySetKey = "presence:dirty";
const presenceRoom = (userId) => `presence:${userId}`;

async function publishPresenceUpdate(userId, online, last_seen = null) {
  const payload = { userId: String(userId), online: !!online, last_seen };
  await redisPub.publish(PRESENCE_PUBSUB_CHANNEL, JSON.stringify(payload));
}

async function markHeartbeat(userId, deviceId) {
  await redis.set(
    heartbeatKey(userId, deviceId),
    Date.now(),
    "EX",
    Number(HEARTBEAT_TTL_SECONDS)
  );
  // mark summary online (optional)
  // notify others
  await publishPresenceUpdate(userId, true, null);
}

// add user to dirty set to flush later
async function markDirtyForFlush(userId) {
  await redis.sadd(dirtySetKey, String(userId));
}

// returns true if user is currently online (any device heartbeat exists)
async function isUserOnline(userId) {
  const keys = await redis.keys(`presence:hb:${userId}:*`);
  return keys.length > 0;
}

// get last_seen from Redis summary if present; else fall back to DB
async function getLastSeenFromRedisOrDB(userId) {
  // we store last_seen only in DB? We'll compute last_seen by reading user_status table
  const res = await pg.query(
    "SELECT last_seen_at FROM user_status WHERE user_id = $1",
    [userId]
  );
  return res.rows[0] ? res.rows[0].last_seen_at : null;
}

// ---- auth helpers ----
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// ---- Socket.io auth & connection handling ----
io.use((socket, next) => {
  // Expect token and deviceId in handshake auth
  const { token, deviceId } = socket.handshake.auth || {};
  if (!token || !deviceId)
    return next(new Error("Authentication required (token + deviceId)"));
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return next(new Error("Invalid token"));
  socket.user = { id: String(payload.userId), deviceId: String(deviceId) };
  return next();
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  const deviceId = socket.user.deviceId;
  console.log(
    `socket connected user=${userId} device=${deviceId} sid=${socket.id}`
  );

  // mark heartbeat on connect
  markHeartbeat(userId, deviceId).catch(console.error);

  // join a personal socket room for this user's sessions (optional)
  socket.join(`me:${userId}`);

  // Event: client requests to subscribe to presence of a list of userIds (their contacts)
  socket.on("subscribe_presence", async (payload) => {
    // payload: { ids: ['123','456'] } — join rooms presence:{id}
    if (!payload || !Array.isArray(payload.ids)) return;
    for (const id of payload.ids) {
      socket.join(presenceRoom(id));
    }
    // Optionally send current presence states for those IDs
    for (const id of payload.ids) {
      const online = await isUserOnline(id);
      const last_seen = online ? null : await getLastSeenFromRedisOrDB(id);
      socket.emit("presence_state", { userId: id, online, last_seen });
    }
  });

  // Heartbeat event from client
  socket.on("heartbeat", async () => {
    try {
      await markHeartbeat(userId, deviceId);
    } catch (e) {
      console.error("heartbeat error", e);
    }
  });

  // Client can also request one-off last_seen via HTTP (below)
  // Handle clean disconnect
  socket.on("disconnect", async (reason) => {
    console.log(
      `disconnect user=${userId} device=${deviceId} reason=${reason}`
    );
    try {
      // remove device heartbeat key
      await redis.del(heartbeatKey(userId, deviceId));

      // if no more device heartbeats exist, user is offline -> set last_seen in DB via dirty set and publish
      const online = await isUserOnline(userId);
      if (!online) {
        const now = new Date().toISOString();
        // add to dirty set for periodic flush
        await markDirtyForFlush(userId);
        // publish immediate update (contains last_seen as ISO)
        await publishPresenceUpdate(userId, false, now);
      }
    } catch (e) {
      console.error("error on disconnect handling", e);
    }
  });
});

// ---- Redis subscriber: relay presence updates to interested sockets (rooms) ----
redisSub.subscribe(PRESENCE_PUBSUB_CHANNEL, (err, count) => {
  if (err) console.error("redis sub error", err);
});
redisSub.on("message", (channel, message) => {
  try {
    const ev = JSON.parse(message);
    const room = presenceRoom(ev.userId);
    // Emit to sockets that subscribed to this user's presence
    io.to(room).emit("presence_update", ev);
  } catch (e) {
    console.error("failed to parse presence message", e);
  }
});

// ---- HTTP API: last_seen endpoint with privacy enforcement ----
// Middleware to authenticate API requests (Bearer token)
app.use(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing Authorization" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid Authorization" });
  const payload = verifyToken(parts[1]);
  if (!payload || !payload.userId)
    return res.status(401).json({ error: "Invalid token" });
  req.user = { id: String(payload.userId) };
  next();
});

// Check contact relation
async function isContact(userId, otherId) {
  const r = await pg.query(
    "SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2 LIMIT 1",
    [otherId, userId]
  );
  return r.rowCount > 0;
}

app.get("/last_seen/:targetUserId", async (req, res) => {
  const requester = req.user.id;
  const target = req.params.targetUserId;

  try {
    // first, check DB privacy settings
    const ps = await pg.query(
      "SELECT hide_last_seen, show_last_seen_to, last_seen_at FROM user_status WHERE user_id = $1",
      [target]
    );
    const row = ps.rows[0];

    // Default privacy if missing: everyone
    let hide = false;
    let showTo = "everyone";
    let dbLastSeen = null;
    if (row) {
      hide = !!row.hide_last_seen;
      showTo = row.show_last_seen_to || "everyone";
      dbLastSeen = row.last_seen_at;
    }

    // enforce privacy
    if (hide || showTo === "nobody") {
      return res.json({ allowed: false });
    }
    if (showTo === "contacts") {
      const contact = await isContact(requester, target);
      if (!contact) return res.json({ allowed: false });
    }

    // now compute online status from Redis
    const online = await isUserOnline(target);
    if (online) return res.json({ allowed: true, online: true });

    // else return last_seen (DB fallback)
    const last_seen = dbLastSeen ? dbLastSeen.toISOString() : null;
    return res.json({ allowed: true, online: false, last_seen });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal" });
  }
});

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// start server
server.listen(PORT, () => {
  console.log(`presence service listening on ${PORT}`);
});

// graceful shutdown
async function shutdown() {
  console.log("shutting down...");
  await io.close();
  await redis.quit();
  await redisSub.quit();
  await redisPub.quit();
  await pg.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
