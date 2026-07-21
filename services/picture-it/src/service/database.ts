import { SQL } from "bun";
import { PictureError } from "../errors.ts";

export type DatabaseRow = Record<string, unknown>;

export interface DatabaseExecutor {
  query<T extends DatabaseRow>(text: string, values?: unknown[]): Promise<T[]>;
  transaction<T>(callback: (database: DatabaseExecutor) => Promise<T>): Promise<T>;
}

const wrapExecutor = (sql: SQL): DatabaseExecutor => ({
  async query<T extends DatabaseRow>(text: string, values: unknown[] = []) {
    return await sql.unsafe<T[]>(text, values);
  },
  async transaction<T>(callback: (database: DatabaseExecutor) => Promise<T>) {
    return sql.begin(async (transaction) => callback(wrapExecutor(transaction as unknown as SQL))) as Promise<T>;
  },
});

export class PictureDatabase implements DatabaseExecutor {
  private readonly sql: SQL;
  private readonly executor: DatabaseExecutor;

  constructor(databaseUrl: string) {
    if (!String(databaseUrl ?? "").trim()) {
      throw new PictureError("picture_database_config_invalid", "DATABASE_URL is required.", 500);
    }
    this.sql = new SQL(databaseUrl);
    this.executor = wrapExecutor(this.sql);
  }

  query<T extends DatabaseRow>(text: string, values: unknown[] = []) {
    return this.executor.query<T>(text, values);
  }

  transaction<T>(callback: (database: DatabaseExecutor) => Promise<T>) {
    return this.executor.transaction(callback);
  }

  async close() {
    await this.sql.close();
  }
}
