"use client";

import { useState } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  helpText?: string;
  emptyLabel?: string;
  normalizeTag?: (raw: string) => string | null;
  mode?: 'button' | 'inline';
  allowBackspaceRemoveLast?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  addButtonClassName?: string;
  chipsContainerClassName?: string;
  chipClassName?: string;
  removeButtonClassName?: string;
  helpTextClassName?: string;
}

function defaultNormalizeTag(raw: string): string | null {
  const value = raw.trim();
  return value || null;
}

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }

  return result;
}

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Escribe y presiona Enter',
  addLabel = 'Agregar',
  helpText,
  emptyLabel,
  normalizeTag = defaultNormalizeTag,
  mode = 'button',
  allowBackspaceRemoveLast = false,
  wrapperClassName,
  inputClassName,
  addButtonClassName,
  chipsContainerClassName,
  chipClassName,
  removeButtonClassName,
  helpTextClassName,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const commitInput = (raw: string) => {
    const parsed = raw
      .split(/[\n,]/)
      .map(part => normalizeTag(part))
      .filter((part): part is string => !!part);

    if (parsed.length === 0) return;

    onChange(dedupe([...tags, ...parsed]));
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    if (/[\n,]/.test(pasted)) {
      e.preventDefault();
      commitInput(pasted);
    }
  };

  return (
    <div className="space-y-2">
      {mode === 'inline' ? (
        <div className={wrapperClassName || 'flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-field-border bg-surface'}>
          {tags.map(tag => (
            <span
              key={tag}
              className={chipClassName || 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface border border-edge text-xs text-body'}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className={removeButtonClassName || 'text-muted hover:text-danger transition'}
                aria-label={`Eliminar ${tag}`}
              >
                <i className="fas fa-times text-[10px]" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commitInput(inputValue);
              }
              if (allowBackspaceRemoveLast && e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
                onChange(tags.slice(0, -1));
              }
            }}
            onBlur={() => {
              if (inputValue.trim()) commitInput(inputValue);
            }}
            placeholder={tags.length === 0 ? placeholder : 'Agregar...'}
            className={inputClassName || 'flex-1 min-w-[120px] px-1 py-0.5 text-sm text-label border-none outline-none bg-transparent'}
          />
        </div>
      ) : (
        <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitInput(inputValue);
            }
          }}
          onBlur={() => {
            if (inputValue.trim()) commitInput(inputValue);
          }}
          placeholder={placeholder}
          className={inputClassName || 'flex-1 px-3 py-2 rounded-lg border border-field-border text-heading'}
        />
        <button
          type="button"
          onClick={() => commitInput(inputValue)}
          className={addButtonClassName || 'px-3 py-2 rounded-lg border border-field-border text-body hover:bg-subtle transition'}
        >
          <i className="fas fa-plus mr-1" /> {addLabel}
        </button>
      </div>
      )}

      {tags.length > 0 ? (
        mode === 'inline' ? null : (
        <div className={chipsContainerClassName || 'flex flex-wrap gap-2'}>
          {tags.map(tag => (
            <span
              key={tag}
              className={chipClassName || 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface border border-edge text-xs text-body'}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className={removeButtonClassName || 'text-muted hover:text-danger transition'}
                aria-label={`Eliminar ${tag}`}
              >
                <i className="fas fa-times text-[10px]" />
              </button>
            </span>
          ))}
        </div>
        )
      ) : (
        emptyLabel ? <p className="text-xs text-muted">{emptyLabel}</p> : null
      )}

      {helpText ? <p className={helpTextClassName || 'text-xs text-muted'}>{helpText}</p> : null}
    </div>
  );
}
