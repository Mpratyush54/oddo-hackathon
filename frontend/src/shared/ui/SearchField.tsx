import { Icon } from './Icon';

export function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Icon name="Search" size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="plain-icon" aria-label="Clear search" onClick={() => onChange('')}>
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
}
