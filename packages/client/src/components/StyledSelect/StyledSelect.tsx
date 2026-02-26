import { useState, useRef, useEffect } from 'react';

export interface StyledSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface Props {
  options: StyledSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function StyledSelect({ options, value, onChange, placeholder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="styled-select" ref={containerRef}>
      <button
        type="button"
        className={`styled-select__trigger${isOpen ? ' styled-select__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="styled-select__value">
          {selected?.color && (
            <span className="styled-select__dot" style={{ backgroundColor: selected.color }} />
          )}
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <svg className="styled-select__chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L1 3h10z" />
        </svg>
      </button>

      {isOpen && (
        <div className="styled-select__dropdown">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`styled-select__option${option.value === value ? ' styled-select__option--selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.color && (
                <span className="styled-select__dot" style={{ backgroundColor: option.color }} />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
