import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export interface MockD1PreparedStatement {
  bind(...params: any[]): MockD1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
  _query: string;
  _params: any[];
}

export interface MockD1Database {
  raw: DatabaseSync;
  prepare(query: string): MockD1PreparedStatement;
  batch(statements: MockD1PreparedStatement[]): Promise<{ meta: { changes: number; last_row_id: number } }[]>;
}

export function createInMemoryD1(schemaPath?: string, seedPath?: string): MockD1Database {
  const rawDb = new DatabaseSync(":memory:");
  rawDb.exec("PRAGMA foreign_keys = ON;");

  const resolvedSchema = schemaPath || path.resolve(process.cwd(), "d1/schema.sql");
  if (fs.existsSync(resolvedSchema)) {
    const sql = fs.readFileSync(resolvedSchema, "utf8");
    rawDb.exec(sql);
  }

  const resolvedSeed = seedPath || path.resolve(process.cwd(), "d1/seed.sql");
  if (fs.existsSync(resolvedSeed)) {
    const seedSql = fs.readFileSync(resolvedSeed, "utf8");
    rawDb.exec(seedSql);
  }

  const wrapPreparedStatement = (query: string, boundParams: any[] = []): MockD1PreparedStatement => ({
    _query: query,
    _params: boundParams,
    bind(...params: any[]) {
      return wrapPreparedStatement(query, params);
    },
    async first<T = any>(): Promise<T | null> {
      const stmt = rawDb.prepare(query);
      const row = stmt.get(...boundParams) as T | undefined;
      return row || null;
    },
    async all<T = any>(): Promise<{ results: T[] }> {
      const stmt = rawDb.prepare(query);
      const rows = stmt.all(...boundParams) as T[];
      return { results: rows };
    },
    async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
      const stmt = rawDb.prepare(query);
      const info = stmt.run(...boundParams);
      return {
        meta: {
          changes: Number(info.changes),
          last_row_id: Number(info.lastInsertRowid),
        },
      };
    },
  });

  return {
    raw: rawDb,
    prepare(query: string) {
      return wrapPreparedStatement(query, []);
    },
    async batch(statements: MockD1PreparedStatement[]) {
      rawDb.exec("BEGIN TRANSACTION;");
      const results: { meta: { changes: number; last_row_id: number } }[] = [];
      try {
        for (const s of statements) {
          const stmt = rawDb.prepare(s._query);
          const info = stmt.run(...(s._params || []));
          results.push({
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid),
            },
          });
        }
        rawDb.exec("COMMIT;");
        return results;
      } catch (err) {
        rawDb.exec("ROLLBACK;");
        throw err;
      }
    },
  };
}
