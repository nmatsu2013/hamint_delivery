import { useState, type MouseEvent } from 'react';

interface Props {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'UUIDをコピー' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className="master-copy-button"
      onClick={(event) => void copy(event)}
      aria-label={copied ? 'コピーしました' : label}
      title={copied ? 'コピーしました' : label}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
