'use client';

import TagInput from '@/components/shared/TagInput';

interface SelectOptionsEditorProps {
  options: string[];
  onChange: (opts: string[]) => void;
}

export default function SelectOptionsEditor({ options, onChange }: SelectOptionsEditorProps) {
  return (
    <div className="mt-2">
      <TagInput
        tags={options}
        onChange={onChange}
        mode="inline"
        allowBackspaceRemoveLast
        placeholder="Escribe opciones (Enter o coma para agregar)"
        wrapperClassName="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-field-border bg-surface"
        chipClassName="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-light text-brand rounded-md text-xs font-medium"
        removeButtonClassName="text-brand/60 hover:text-danger transition"
        inputClassName="flex-1 min-w-[120px] px-1 py-0.5 text-sm text-label border-none outline-none bg-transparent"
        helpText="Enter o coma para agregar. Backspace para borrar la última."
        helpTextClassName="text-[11px] text-muted"
      />
    </div>
  );
}
