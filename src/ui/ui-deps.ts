// THE design-system seam: the only place this package's client files get
// their UI primitives and UI helpers. They are self-contained copies of
// @arvo/team's (themselves from @arvo/traffic and BetterFans Link; ./vendor,
// each file names its source and what changed), drawn with the shadcn color
// names that ../styles/tokens.css defines. Adapting the pages to another
// design system means editing exactly this file: point these exports at your
// own components with the same names and props.

export { StatusDot } from './vendor/badge';
export type { Tone } from './vendor/badge';
export { Button, buttonVariants, Spinner } from './vendor/button';
export { Card, CardBody, CardHeader } from './vendor/card';
export { cn } from './vendor/cn';
export { COPY_FAILED, CopyButton, useCopy } from './vendor/copy';
export { ConfirmDialog, Dialog, DialogContent } from './vendor/dialog';
export { errorFromBody, WhatsNewError } from './vendor/errors';
export { Field } from './vendor/field';
export { formatDate, formatNumber, plural } from './vendor/format';
export { Input } from './vendor/input';
export { Segmented } from './vendor/segmented';
export { Select } from './vendor/select';
export { Skeleton } from './vendor/skeleton';
export { EmptyState, ErrorState, errorWords, InlineError } from './vendor/states';
export { Checkbox, Switch } from './vendor/switch';
export { Table, TBody, Td, Th, THead, Tr } from './vendor/table';
export { Tab, TabList, Tabs } from './vendor/tabs';
export { Textarea } from './vendor/textarea';
export { RelativeTime } from './vendor/time';
export { Tip } from './vendor/tooltip';
