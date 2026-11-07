export function formatDeadline(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${formatted} UTC`;
}
