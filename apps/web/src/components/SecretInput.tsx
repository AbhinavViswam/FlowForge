import { Lock } from 'lucide-react';
import { Input } from './ui';

// Input for a connection string that's stored encrypted. The server never sends a
// saved value back: it sends `saved` plus a `hint` (host and database, no
// password). Leaving the box empty keeps the saved value; typing replaces it.
export default function SecretInput({
  value, saved, hint, placeholder, onChange, onRemove,
}: {
  value: string;
  saved: boolean;
  hint?: string;
  placeholder: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const showSaved = saved && !value;
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        type="password"
        className="font-mono"
        autoComplete="off"
        placeholder={showSaved ? 'Saved — type a new one to replace it' : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {showSaved && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={12} className="shrink-0" />
          <span className="truncate">Saved and encrypted{hint ? ` · ${hint}` : ''}</span>
          <button type="button" onClick={onRemove} className="ml-auto shrink-0 text-faint hover:text-danger transition-colors">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
