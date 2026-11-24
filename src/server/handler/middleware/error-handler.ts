import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DomainError } from '../../domain/errors/domain.error.js';

const STATUS_BY_CODE: Record<string, ContentfulStatusCode> = {
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BUSINESS_RULE_VIOLATION: 422,
  UNAUTHORIZED: 401,
};

export function handleError(error: Error, c: Context): Response {
  if (error instanceof DomainError) {
    const status = STATUS_BY_CODE[error.code] ?? 400;
    const body: Record<string, unknown> = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if ('details' in error && error.details) {
      (body.error as Record<string, unknown>).details = error.details;
    }
    return c.json(body, status);
  }

  console.error('[unhandled error]', error);
  const development = process.env.NODE_ENV !== 'production';
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部でエラーが発生しました',
        ...(development
          ? {
              details: {
                message: error.message,
                hint: 'DB接続・マイグレーション適用状況を確認してください（npm run db:migrate）',
              },
            }
          : {}),
      },
    },
    500,
  );
}
