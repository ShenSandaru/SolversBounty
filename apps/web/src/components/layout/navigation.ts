export const navItems = [
  { href: "/bounties", label: "Marketplace" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bounties/create", label: "Create Bounty" },
  { href: "/research", label: "Research Analytics" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/bounties") {
    return pathname === "/bounties" || /^\/bounties\/(?!create$).+/.test(pathname);
  }
  return pathname === href;
}

export function pageContext(pathname: string): { section: string; detail: string } {
  if (pathname === "/") {
    return { section: "Home", detail: "Research marketplace" };
  }
  if (pathname === "/bounties") {
    return { section: "Marketplace", detail: "Open challenges" };
  }
  if (pathname === "/bounties/create") {
    return { section: "Create Bounty", detail: "Preview form" };
  }
  if (pathname.startsWith("/bounties/")) {
    return { section: "Challenge", detail: "Details" };
  }
  if (pathname === "/dashboard") {
    return { section: "Dashboard", detail: "Creator and solver" };
  }
  if (pathname === "/research") {
    return { section: "Research Analytics", detail: "Demonstration" };
  }
  return { section: "SolversBounty", detail: "Preview" };
}
