import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data/agenttollgate.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const inst = new Database(dbPath);
  inst.pragma("journal_mode = WAL");
  inst.pragma("foreign_keys = ON");
  migrate(inst);
  _db = inst;
  return inst;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      locus_wallet TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tollgates (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      upstream_url TEXT NOT NULL,
      upstream_method TEXT NOT NULL DEFAULT 'POST',
      forward_headers TEXT NOT NULL DEFAULT '[]',
      base_price_micros INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDC',
      policy TEXT NOT NULL DEFAULT '{}',
      pricing_strategy TEXT NOT NULL DEFAULT 'flat',
      status TEXT NOT NULL DEFAULT 'live',
      category TEXT NOT NULL DEFAULT 'general',
      public INTEGER NOT NULL DEFAULT 1,
      total_calls INTEGER NOT NULL DEFAULT 0,
      total_revenue_micros INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tollgates_slug ON tollgates(slug);
    CREATE INDEX IF NOT EXISTS idx_tollgates_merchant ON tollgates(merchant_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tollgate_id TEXT NOT NULL REFERENCES tollgates(id),
      agent_id TEXT,
      amount_micros INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      locus_session_id TEXT,
      request_payload TEXT,
      receipt_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at TEXT,
      redeemed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_tollgate ON sessions(tollgate_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);

    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY,
      tollgate_id TEXT NOT NULL REFERENCES tollgates(id),
      agent_id TEXT,
      session_id TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      amount_micros INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_usage_tollgate ON usage(tollgate_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage(created_at);

    CREATE TABLE IF NOT EXISTS reputation (
      agent_id TEXT PRIMARY KEY,
      successful_calls INTEGER NOT NULL DEFAULT 0,
      failed_calls INTEGER NOT NULL DEFAULT 0,
      total_spent_micros INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 500,
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rate_window (
      key TEXT NOT NULL,
      bucket TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, bucket)
    );
  `);
}
