import type { Actor } from '../domain/entities/actor.entity';
import type {
  IUnitOfWork,
  RepositoryContext,
} from '../domain/repositories/unit-of-work.interface';
import { PgDatabase } from './database';
import { createRepositories } from './repositories';

export class PgUnitOfWork implements IUnitOfWork {
  readonly repos: RepositoryContext;

  constructor(private readonly db: PgDatabase) {
    this.repos = createRepositories(db.pool);
  }

  async run<T>(
    work: (repos: RepositoryContext) => Promise<T>,
    actor?: Actor,
  ): Promise<T> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      if (actor) {
        // 監査トリガーが参照する操作者情報。トランザクション内だけ有効。
        await client.query(
          `select set_config('app.user_id', $1, true),
                  set_config('app.user_role', $2, true)`,
          [actor.id, actor.role],
        );
      }
      const repos = createRepositories(client);
      const result = await work(repos);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
