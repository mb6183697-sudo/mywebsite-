import app from "./app";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { startSwapJob } from "./lib/swapJob.js";

async function runStartupTierMigration() {
  try {
    const upgraded = await db.execute(sql`
      WITH tier_calc AS (
        SELECT
          id,
          account_type AS current_tier,
          CASE
            WHEN balance >= 1000000 THEN 'diamond'
            WHEN balance >= 250000  THEN 'gold'
            WHEN balance >= 100000  THEN 'silver'
            ELSE 'standard'
          END AS target_tier,
          CASE account_type WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END AS current_rank
        FROM users
      ),
      to_upgrade AS (
        SELECT id, target_tier
        FROM tier_calc
        WHERE CASE target_tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END > current_rank
      )
      UPDATE users u
      SET account_type = to_upgrade.target_tier, updated_at = NOW()
      FROM to_upgrade
      WHERE u.id = to_upgrade.id
      RETURNING u.id, u.first_name, u.last_name, u.account_type AS new_tier
    `);
    const rows = upgraded.rows as any[];
    if (rows.length > 0) {
      console.log(`[startup] Tier migration: upgraded ${rows.length} user(s) —`, rows.map((r: any) => `${r.first_name} ${r.last_name} → ${r.new_tier}`).join(", "));
    } else {
      console.log("[startup] Tier migration: all users already on correct tier.");
    }
  } catch (err) {
    console.error("[startup] Tier migration error:", err);
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  runStartupTierMigration();
  startSwapJob();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
