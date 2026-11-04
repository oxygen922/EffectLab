import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import type { Database } from "./types";

const globalStore = globalThis as typeof globalThis & {
  __effectlabChain?: Promise<void>;
};

export function storeFilePath(): string {
  return process.env.EFFECTLAB_STORE || path.join(process.cwd(), "data", "runtime.json");
}

export function emptyDatabase(): Database {
  return { users: {}, jobs: {}, ledger: [] };
}

function load(): Database {
  const file = storeFilePath();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Database;
    if (!parsed.users || !parsed.jobs || !Array.isArray(parsed.ledger)) return emptyDatabase();
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyDatabase();
    throw error;
  }
}

function save(db: Database): void {
  const file = storeFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, file);
}

export async function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const previous = globalStore.__effectlabChain ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalStore.__effectlabChain = previous.then(() => gate);
  await previous;
  try {
    const db = load();
    const result = fn(db);
    save(db);
    return result;
  } finally {
    release();
  }
}
