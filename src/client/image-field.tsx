'use client';

// "Add a picture" for a post or an email: PNG, JPG, GIF or WebP up to 2 MB,
// uploaded as soon as it is picked, shown at once, and removable.
import { ImagePlus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { LIMITS } from '../shared/limits';
import { Button, InlineError, Spinner } from '../ui/ui-deps';
import { useUploadImage } from './api';
import { PostPicture } from './post-card';

export function ImageField({
  imageUrl,
  onChange,
  label = 'Picture',
  hint = 'A screenshot of it working, cropped close. Wide pictures look best (16:9).',
}: {
  imageUrl: string | null;
  onChange: (image: { id: string; url: string } | null) => void;
  label?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();
  const id = useId();
  const [tooBig, setTooBig] = useState(false);

  function pick(file: File | undefined) {
    if (!file) return;
    upload.reset();
    // Said here, before sending 2 MB only to hear no.
    setTooBig(file.size > LIMITS.imageBytes);
    if (file.size > LIMITS.imageBytes) return;
    upload.mutate(file, { onSuccess: (image) => onChange(image) });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-foreground">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted-foreground/80">Optional</span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {imageUrl ? (
        <div className="flex items-start gap-3">
          <PostPicture url={imageUrl} className="aspect-[16/9] w-40" />
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : <ImagePlus aria-hidden />}
              Change
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} disabled={upload.isPending}>
              <Trash2 aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-fit" onClick={() => input.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Spinner /> : <ImagePlus aria-hidden />}
          {upload.isPending ? 'Uploading…' : 'Add a picture'}
        </Button>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground/80">{hint} PNG, JPG, GIF or WebP, up to 2 MB.</p>
      {tooBig ? <InlineError error={true} words="That picture is over 2 MB. Make it smaller and add it again." /> : null}
      {upload.isError ? <InlineError error={upload.error} /> : null}
    </div>
  );
}
