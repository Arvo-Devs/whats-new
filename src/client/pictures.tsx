'use client';

// The Pictures panel: upload a picture and copy its link to put in a post's
// or an email's HTML (or to give to the AI). Pictures are kept in the app's
// own database and served from the app's own site, so they show in emails
// too. Shared by both Admin pages.
import { ImagePlus, Images } from 'lucide-react';
import { useRef, useState } from 'react';
import { LIMITS } from '../shared/limits';
import { Button, CopyButton, Dialog, DialogContent, EmptyState, ErrorState, InlineError, Skeleton, Spinner } from '../ui/ui-deps';
import { useImages, useUploadImage } from './api';

function kb(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PicturesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Images aria-hidden />
        Pictures
      </Button>
      {open ? <PicturesDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PicturesDialog({ onClose }: { onClose: () => void }) {
  const images = useImages();
  const upload = useUploadImage();
  const input = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);
  const pick = (file: File | undefined) => {
    if (!file) return;
    upload.reset();
    setTooBig(file.size > LIMITS.imageBytes);
    if (file.size <= LIMITS.imageBytes) upload.mutate(file);
  };
  return (
    <Dialog.Root open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        size="lg"
        title="Pictures"
        description="Add a picture, then copy its link into the HTML, or give the link to the AI. Pictures load from this site, so they show in emails too."
        footer={
          <>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }} />
            <Button variant="primary" onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : <ImagePlus aria-hidden />}
              {upload.isPending ? 'Uploading…' : 'Add a picture'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">PNG, JPG, GIF or WebP, up to 2 MB. Never anything private: anyone with the link can see it.</p>
        {tooBig ? <InlineError error={true} words="That picture is over 2 MB. Make it smaller and add it again." className="mb-3" /> : null}
        {upload.isError ? <InlineError error={upload.error} className="mb-3" /> : null}
        {images.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        ) : images.isError ? (
          <ErrorState compact error={images.error} onRetry={() => void images.refetch()} />
        ) : !images.data.images.length ? (
          <EmptyState compact icon={Images} title="No pictures yet">
            Add one, and its link appears here to copy.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.data.images.map((image) => (
              <li key={image.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-muted object-contain p-1.5" />
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-xs text-muted-foreground">{kb(image.bytes)}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                    Copy link
                    <CopyButton value={image.fullUrl} label="Copy link" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog.Root>
  );
}
