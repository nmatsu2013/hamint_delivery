import type { Context } from 'hono';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../domain/errors/domain.error';

function toValidationError(error: ZodError): ValidationError {
  const flattened = error.flatten();
  return new ValidationError('入力内容に誤りがあります', {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  });
}

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('JSONボディが不正です');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw toValidationError(result.error);
  }
  return result.data;
}

export function requireUuid(value: string | undefined, label: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`${label}のIDが不正です`);
  }
  return value;
}

export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const raw = c.req.query();
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw toValidationError(result.error);
  }
  return result.data;
}
