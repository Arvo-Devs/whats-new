'use client';

// The box a post's or an email's HTML goes in: paste it, drop the .html file
// the prompt saved, or choose the file. It says how big it is, because a
// picture put inside the file instead of by link makes it huge.
import { FileUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { LIMITS } from '../shared/limits';
import { Button, cn } from '../ui/ui-deps';

function size(text: string): string {
  const kb = new Blob([text]).size / 1024;
  return kb < 1000 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function HtmlField({
  value,
  onChange,
  error,
  hint,
  label = 'HTML',
}: {
  value: string;
  onChange: (html: string) => void;
  error?: string;
  hint?: string;
  label?: string;
}) {
  const id = useId();
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const read = async (picked: File | undefined) => {
    if (picked) onChange(await picked.text());
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        <span className={cn('text-xs', value.length > LIMITS.html ? 'font-medium text-danger-strong' : 'text-muted-foreground/80')}>{value ? size(value) : ''}</span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void read(e.dataTransfer.files?.[0]);
        }}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        placeholder="Paste the HTML the prompt made, or drop its .html file here."
        className={cn(
          'h-44 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground',
          'placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground/80 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20',
          over && 'border-primary ring-3 ring-primary/20',
          error && 'border-danger-strong',
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={file}
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button size="sm" onClick={() => file.current?.click()}>
          <FileUp aria-hidden />
          Choose a file
        </Button>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground/80">{hint}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
