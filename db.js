import sqlite3 from "sqlite3";

const sqlite = sqlite3.verbose();

const db = new sqlite.Database("./ratelimiter.db", (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  console.log("Database connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      ip_address TEXT,
      created_at INTEGER
    )
  `);
});

export default db;