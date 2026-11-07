import { cn } from "cn";
import * as React from "react";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
