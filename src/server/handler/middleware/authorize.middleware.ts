import type { MiddlewareHandler } from 'hono';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors/domain.error';
import type { Role } from '../../domain/entities/actor.entity';
import type { AppEnv } from '../app-env';

/** RBAC: 許可ロール以外は403。管理者は各ルートで明示的に許可する。 */
export function authorize(...allowedRoles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const actor = c.get('actor');
    if (!actor) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenError('この操作を行う権限がありません');
    }
    await next();
  };
}
