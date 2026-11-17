'use client';

// "Copy the prompt": the words to give the AI, with the app's name and
// addresses filled in. The person runs it in the product's repo with the best
// AI model at the time, adds what it's about at the end, reads what it made,
// and pastes the HTML back here.
import { ClipboardCopy, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button, COPY_FAILED, Dialog, DialogContent, useCopy } from '../ui/ui-deps';

export function PromptButton({ prompt, title, steps }: { prompt: string; title: string; steps: string }) {
  const [open, setOpen] = useState(false);
  const { copied, failed, copy } = useCopy(2200);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Wand2 aria-hidden />
        Copy the prompt
      </Button>
      {open ? (
        <Dialog.Root open onOpenChange={(next) => (!next ? setOpen(false) : undefined)}>
          <DialogContent
            size="lg"
            title={title}
            description={steps}
            footer={
              <>
                <Dialog.Close render={<Button variant="ghost" />}>Close</Dialog.Close>
                <Button variant="primary" onClick={(e) => void copy(prompt, e.currentTarget)}>
                  <ClipboardCopy aria-hidden />
                  {copied ? 'Copied' : 'Copy the prompt'}
                </Button>
              </>
            }
          >
            <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">{prompt}</pre>
            {failed ? <p className="mt-2 text-xs text-danger-strong">{COPY_FAILED}</p> : null}
          </DialogContent>
        </Dialog.Root>
      ) : null}
    </>
  );
}
