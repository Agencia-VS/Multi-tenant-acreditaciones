'use client';

import { useState } from 'react';

interface SelectOptionsEditorProps {
  options: string[];
  onChange: (opts: string[]) => void;
}

export default function SelectOptionsEditor({ options, onChange }: SelectOptionsEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const addOption = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const newOpts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const unique = newOpts.filter(o => !options.includes(o));
    if (unique.length > 0) {
      onChange([...options, ...unique]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addOption();
    }
    if (e.key === 'Backspace' && inputValue === '' && options.length > 0) {
      onChange(options.slice(0, -1));
    }
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-field-border bg-surface">
        {options.map((opt, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-light text-brand rounded-md text-xs font-medium">
            {opt}
            <button type="button" onClick={() => removeOption(i)} className="text-brand/60 hover:text-danger transition">
              <i className="fas fa-times text-[10px]" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addOption}
          placeholder={options.length === 0 ? 'Escribe opciones (Enter o coma para agregar)' : 'Agregar...'}
          className="flex-1 min-w-[120px] px-1 py-0.5 text-sm text-label border-none outline-none bg-transparent"
        />
      </div>
      <p className="text-[11px] text-muted">Enter o coma para agregar. Backspace para borrar la última.</p>
    </div>
  );
}
