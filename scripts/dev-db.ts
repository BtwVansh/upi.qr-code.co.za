/**
 * Local development PostgreSQL, powered by embedded-postgres.
 *
 * This exists so the project can be run without installing PostgreSQL or
 * Docker. Production deployments should point DATABASE_URL at a managed
 * PostgreSQL instance and never run this script.
 *
 * Usage:
 *   npm run db:start     (foreground; Ctrl+C stops the cluster)
 *   npm run db:stop
 *   npm run db:status
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import fs from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = path.join(process.cwd(), ".pgdata");
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:55432/upipay?schema=public";

interface DbSettings {
  port: number;
  user: string;
  password: string;
  database: string;
  host: string;
}

function settings(): DbSettings {
  const raw = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const url = new URL(raw);
  return {
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || "postgres"),
    database: url.pathname.replace(/^\//, "") || "upipay",
    host: url.hostname,
  };
}

function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function pgCtlPath(): string | null {
  const platform = `${process.platform}-${process.arch}`;
  const executable = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  const candidate = path.join(
    process.cwd(),
    "node_modules",
    "@embedded-postgres",
    platform,
    "native",
    "bin",
    executable,
  );
  return fs.existsSync(candidate) ? candidate : null;
}

async function start(): Promise<void> {
  const config = settings();
  if (config.host !== "127.0.0.1" && config.host !== "localhost") {
    console.error(
      `DATABASE_URL points at ${config.host}. Start that PostgreSQL elsewhere; ` +
        'the embedded database is only for 127.0.0.1 / "localhost".',
    );
    process.exit(1);
  }

  if (await isPortOpen(config.port)) {
    console.log(`PostgreSQL already appears to be running on port ${config.port}.`);
    return;
  }

  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log("Initialising local PostgreSQL cluster (one-time setup)…");
    const bootstrap = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      port: config.port,
      user: config.user,
      password: config.password,
      persistent: true,
      onLog: () => undefined,
    });
    await bootstrap.initialise();
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: config.port,
    user: config.user,
    password: config.password,
    persistent: true,
    onLog: (message) => {
      if (message.includes("ready to accept connections")) {
        console.log(`PostgreSQL ready on 127.0.0.1:${config.port}`);
      }
    },
    onError: (error) => {
      console.error("PostgreSQL error:", error);
    },
  });

  console.log("Starting local PostgreSQL…");
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [config.database],
  );
  if (exists.rowCount === 0) {
    if (!/^[a-zA-Z0-9_]+$/.test(config.database)) {
      throw new Error("Database name may only contain letters, numbers and _.");
    }
    await client.query(`CREATE DATABASE "${config.database}"`);
    console.log(`Created database "${config.database}".`);
  }
  await client.end();

  console.log("Press Ctrl+C to stop. Data persists in .pgdata/.");

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log("\nStopping PostgreSQL…");
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  // Keep the Node process alive while postgres runs as a child process.
  await new Promise<void>(() => undefined);
}

async function stop(): Promise<void> {
  const executable = pgCtlPath();
  if (!executable || !fs.existsSync(executable)) {
    console.error("Could not locate the embedded pg_ctl binary.");
    process.exit(1);
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["-D", DATA_DIR, "stop", "-m", "fast"], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_ctl exited with code ${code}.`));
    });
  });
  console.log("PostgreSQL stopped.");
}

async function status(): Promise<void> {
  const config = settings();
  const running = await isPortOpen(config.port);
  console.log(
    running
      ? `PostgreSQL is accepting connections on 127.0.0.1:${config.port}.`
      : `No PostgreSQL listener on 127.0.0.1:${config.port}.`,
  );
  process.exitCode = running ? 0 : 1;
}

const command = process.argv[2] ?? "start";
const actions: Record<string, () => Promise<void>> = { start, stop, status };

const action = actions[command];
if (!action) {
  console.error("Usage: tsx scripts/dev-db.ts <start|stop|status>");
  process.exit(1);
}

action().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
