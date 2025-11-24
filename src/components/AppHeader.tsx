"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";
import { useSession } from "@/hooks/useSession";
import type { SessionRole } from "@/types/auth";

const NAV_LINKS: { href: string; label: string; roles?: Array<SessionRole> }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/lifecycle/onboarding", label: "Onboarding", roles: ["ADMIN", "HR", "UNIT_LEAD"] },
  { href: "/lifecycle/offboarding", label: "Offboarding", roles: ["ADMIN", "HR", "UNIT_LEAD"] },
  { href: "/settings", label: "Settings", roles: ["ADMIN"] },
  { href: "/admin/lifecycle", label: "Lifecycle", roles: ["ADMIN"] },
  { href: "/admin/users", label: "Benutzer", roles: ["ADMIN"] },
];

export default function AppHeader() {
  const { user, loading, error } = useSession();

  const visibleLinks = user
    ? NAV_LINKS.filter((link) => {
        if (!link.roles) return true;
        return link.roles.includes(user.role);
      })
    : [];

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Image
          src="https://realcore.info/bilder/rc-logo.png"
          alt="realcore"
          width={256}
          height={80}
          unoptimized
          className="h-6 w-auto object-contain"
        />
        <span className="hidden sm:inline">Anniversaries</span>
      </Link>
      <div className="flex items-center gap-6 text-sm">
        <nav className="flex items-center gap-4">
          {visibleLinks.map((link) => (
            <Link key={link.href} className="hover:underline" href={link.href}>
              {link.label}
            </Link>
          ))}
          {loading && <span className="text-xs text-zinc-400">lädt…</span>}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="text-right text-xs sm:text-sm">
            {loading && <span className="text-zinc-500">Authentifizierung…</span>}
            {!loading && user && (
              <>
                <div>{user.email}</div>
                <div className="text-zinc-500">
                  {user.role === "ADMIN" ? "Admin" : "Unit-Leiter"}
                  {user.unitName ? ` · ${user.unitName}` : ""}
                </div>
              </>
            )}
            {!loading && !user && !error && <span className="text-zinc-500">Nicht angemeldet</span>}
            {!loading && error && <span className="text-red-500">{error}</span>}
          </div>
          {user ? (
            <LogoutButton />
          ) : !loading ? (
            <Link className="rounded border px-3 py-1 text-xs sm:text-sm" href="/login">
              Login
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
