/**
 * ドメインエラー。
 * HTTP ステータスへの変換は handler 層のエラーハンドラだけが行う。
 */
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
  }
}
