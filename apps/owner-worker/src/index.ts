import { createOwnerService } from '../../../packages/owner-service/src/service';
import type {
  OwnerDatabase,
  OwnerSettings,
  Statement,
} from '../../../packages/owner-service/src/service';

class D1OwnerDatabase implements OwnerDatabase {
  constructor(private readonly db: D1Database) {}
  async first<T>(sql: string, values: (string | number | null)[] = []): Promise<T | null> {
    return this.db
      .prepare(sql)
      .bind(...values)
      .first<T>();
  }
  async batch(statements: Statement[]): Promise<void> {
    await this.db.batch(
      statements.map(({ sql, values = [] }) => this.db.prepare(sql).bind(...values)),
    );
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (
      !new URL(request.url).pathname.startsWith('/api/') &&
      new URL(request.url).pathname !== '/.well-known/hermes-workspace.json'
    )
      return env.ASSETS.fetch(request);
    try {
      const settings = JSON.parse(env.OWNER_SETTINGS) as OwnerSettings;
      // Request scoped: never share a D1 binding, user/session or request context globally.
      return await createOwnerService(env.DB, new D1OwnerDatabase(env.DB), settings).fetch(request);
    } catch {
      return Response.json(
        { error: 'Owner installation is not configured.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
