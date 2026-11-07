import { cn } from "cn";
import * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props} />
  );
}

export { Label };
