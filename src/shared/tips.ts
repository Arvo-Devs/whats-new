// What makes a good post, for the editor's empty preview.
export type Tip = Readonly<{ title: string; detail: string }>;

export const POST_TIPS: readonly Tip[] = [
  { title: 'Make it with the prompt', detail: "Copy the prompt, run it in the product's repo with the best AI model at the time, and paste what it makes." },
  { title: 'Say what people can do now', detail: '"Export any list to a spreadsheet", not "Export improvements".' },
  { title: 'Draw the change working', detail: "Drawn in HTML from the real page, with made-up names and numbers. Never a real customer's data." },
  { title: 'A button that goes straight there', detail: 'Name it for the action: "Open exports".' },
];
