import { DatabaseSync } from 'node:sqlite';
import type { OwnerDatabase, Statement } from './service';
export class NodeOwnerDatabase implements OwnerDatabase {
  constructor(readonly db: DatabaseSync) {}
  async first<T>(sql: string, values: (string | number | null)[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...values) as T | undefined) ?? null;
  }
  async batch(statements: Statement[]): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const { sql, values = [] } of statements) this.db.prepare(sql).run(...values);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
