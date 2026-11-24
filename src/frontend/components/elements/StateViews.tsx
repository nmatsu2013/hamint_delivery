import { ApiError } from '../../lib/apiClient';

export function LoadingState({ label = '読み込み中です…' }: { label?: string }) {
  return <div className="loading-state">{label}</div>;
}

export function EmptyState({ label = 'データがありません' }: { label?: string }) {
  return <div className="empty-state">{label}</div>;
}

export function ErrorAlert({ error }: { error: unknown }) {
  let message = 'エラーが発生しました';
  if (error instanceof ApiError) {
    message = error.message;
    if (error.details) {
      message += `（${JSON.stringify(error.details)}）`;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  return <div className="alert alert-error">{message}</div>;
}

export function SuccessAlert({ message }: { message: string }) {
  return <div className="alert alert-success">{message}</div>;
}
