import { APP_NAME } from "@solversbounty/shared";
import { cn } from "cn";
import Link from "next/link";

export function Brand({
  className,
  subtitle = "Devnet research preview",
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <Link href="/" className={cn("flex items-center gap-3 rounded-lg", className)}>
      <span className="grid size-9 place-items-center rounded-lg bg-brand-gradient font-mono text-sm font-bold text-[#111116]">
        Sb
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{APP_NAME}</span>
        {subtitle ? <span className="hidden text-xs text-brand-green sm:block">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
