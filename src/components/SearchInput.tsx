import { Search } from 'lucide-react';

export function SearchInput({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <div className="search">
      <Search size={20} aria-hidden="true" />
      <input
        type="search"
        className="input"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
