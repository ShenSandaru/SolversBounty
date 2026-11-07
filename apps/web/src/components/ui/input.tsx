import { cn } from "cn";
import * as React from "react";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
