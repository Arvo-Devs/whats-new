'use client';

// Vendored from betterfanslink components/ui/tabs.tsx (main cf653df): Tabs, TabList and Tab, on the package's color names, without TabNav.
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const Tabs = BaseTabs;

const tabClass = cn(
  'relative z-[1] inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none',
  'hover:text-foreground focus-visible:rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
);

/** In-page tabs over Base UI Tabs, with an underline that follows the active tab. On a phone the row scrolls inside itself. */
export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0', className)}>
      <BaseTabs.List className="relative flex border-b border-border">
        {children}
        <BaseTabs.Indicator className="absolute bottom-[-1px] left-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-full bg-primary transition-[translate,width] duration-200 ease-out" />
      </BaseTabs.List>
    </div>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <BaseTabs.Tab value={value} className={cn(tabClass, 'data-[active]:text-foreground')}>
      {children}
    </BaseTabs.Tab>
  );
}
