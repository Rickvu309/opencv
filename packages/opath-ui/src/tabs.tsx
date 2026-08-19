import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "./cn";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn("flex flex-wrap gap-1", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-[var(--size-touch)] items-center rounded-[var(--radius-control)] px-3 text-[13px] text-ink-muted md:min-h-10",
        "data-[state=active]:bg-surface-3 data-[state=active]:text-accent",
        "hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

const TabsContent = TabsPrimitive.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
