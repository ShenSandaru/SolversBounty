"use client";

import { useQuery } from "@tanstack/react-query";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function HealthStatus() {
  const query = useQuery({
    queryKey: ["health"],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/health`);
      if (!response.ok) {
        throw new Error("API unavailable");
      }
      return (await response.json()) as { status: string; service: string };
    },
  });

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Checking the API.</p>;
  }

  if (query.isError) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />
        API unavailable.
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-brand-green" aria-hidden="true" />
      {query.data.service} API: {query.data.status}
    </p>
  );
}
