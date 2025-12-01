"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";
import { useSession } from "@/hooks/useSession";
import type { SessionRole } from "@/types/auth";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: Array<SessionRole>;
  group?: string;
};

const NAV_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", group: "main" },
  { href: "/employees", label: "Mitarbeiter", icon: "users", group: "main" },
  { href: "/lifecycle/onboarding", label: "Onboarding", icon: "user-plus", roles: ["ADMIN", "HR", "UNIT_LEAD"], group: "lifecycle" },
  { href: "/lifecycle/offboarding", label: "Offboarding", icon: "user-minus", roles: ["ADMIN", "HR", "UNIT_LEAD"], group: "lifecycle" },
  { href: "/certificates", label: "Zeugnisse", icon: "file-text", roles: ["ADMIN", "HR"], group: "hr" },
  { href: "/tickets", label: "HR-Tickets", icon: "ticket", roles: ["ADMIN", "HR", "UNIT_LEAD"], group: "hr" },
  { href: "/qualifications", label: "Qualifikationen", icon: "badge", roles: ["ADMIN", "HR"], group: "hr" },
  { href: "/fleet", label: "Fuhrpark", icon: "car", roles: ["ADMIN", "HR"], group: "hr" },
  { href: "/hardware", label: "Hardware", icon: "laptop", roles: ["ADMIN", "HR"], group: "hr" },
  { href: "/projects", label: "Projekte", icon: "folder", roles: ["ADMIN", "HR"], group: "hr" },
  { href: "/admin/reminders", label: "Erinnerungen", icon: "bell", roles: ["ADMIN", "UNIT_LEAD"], group: "admin" },
  { href: "/admin/lifecycle", label: "Vorlagen", icon: "template", roles: ["ADMIN"], group: "admin" },
  { href: "/admin/categories", label: "Kategorien", icon: "tag", roles: ["ADMIN"], group: "admin" },
  { href: "/admin/users", label: "Benutzer", icon: "shield", roles: ["ADMIN"], group: "admin" },
  { href: "/settings", label: "Einstellungen", icon: "settings", roles: ["ADMIN"], group: "admin" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "Übersicht",
  lifecycle: "Lifecycle",
  hr: "HR-Tools",
  admin: "Administration",
};

const GROUP_ICONS: Record<string, string> = {
  lifecycle: "refresh",
  hr: "briefcase",
  admin: "cog",
};

// Simple icon component
function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
    "user-plus": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
    "user-minus": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />,
    "file-text": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    template: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    settings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
    logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    ticket: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />,
    badge: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
    car: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M16 17h.01M4 11l1.664-4.993A2 2 0 017.565 4h8.87a2 2 0 011.9 1.38L20 11M4 11h16M4 11v6a1 1 0 001 1h1a1 1 0 001-1v-1h10v1a1 1 0 001 1h1a1 1 0 001-1v-6" />,
    folder: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    refresh: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
    briefcase: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    cog: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
    chevron: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
    tag: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
    laptop: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name] || icons.home}
    </svg>
  );
}

// Dropdown menu component
function NavDropdown({ 
  label, 
  icon, 
  links, 
  isActive,
  pathname 
}: { 
  label: string; 
  icon: string; 
  links: NavItem[]; 
  isActive: (href: string) => boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasActiveLink = links.some(l => isActive(l.href));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          hasActiveLink
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
            : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800"
        }`}
      >
        <NavIcon name={icon} className="w-4 h-4" />
        <span>{label}</span>
        <NavIcon name="chevron" className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/50 dark:hover:text-white"
              }`}
            >
              <NavIcon name={link.icon} className="w-4 h-4 text-zinc-400" />
              <span>{link.label}</span>
              {isActive(link.href) && (
                <svg className="w-4 h-4 ml-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppHeader() {
  const { user, loading, error } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const visibleLinks = user
    ? NAV_LINKS.filter((link) => {
        if (!link.roles) return true;
        return link.roles.includes(user.role);
      })
    : [];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href || pathname === "/";
    return pathname.startsWith(href);
  };

  const linkClasses = (href: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800"
    }`;

  // Group links
  const mainLinks = visibleLinks.filter(l => l.group === "main");
  const lifecycleLinks = visibleLinks.filter(l => l.group === "lifecycle");
  const hrLinks = visibleLinks.filter(l => l.group === "hr");
  const adminLinks = visibleLinks.filter(l => l.group === "admin");

  // Grouped links for mobile
  const groupedLinks = [
    { key: "main", links: mainLinks },
    { key: "lifecycle", links: lifecycleLinks },
    { key: "hr", links: hrLinks },
    { key: "admin", links: adminLinks },
  ].filter(g => g.links.length > 0);

  return (
    <>
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="https://realcore.info/bilder/rc-logo.png"
                alt="realcore"
                width={256}
                height={80}
                unoptimized
                className="h-7 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* Main links as direct buttons */}
              {mainLinks.map((link) => (
                <Link key={link.href} href={link.href} className={linkClasses(link.href)}>
                  <NavIcon name={link.icon} className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              
              {/* Lifecycle dropdown */}
              {lifecycleLinks.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                  <NavDropdown 
                    label={GROUP_LABELS.lifecycle}
                    icon={GROUP_ICONS.lifecycle}
                    links={lifecycleLinks}
                    isActive={isActive}
                    pathname={pathname}
                  />
                </>
              )}

              {/* HR Tools dropdown */}
              {hrLinks.length > 0 && (
                <NavDropdown 
                  label={GROUP_LABELS.hr}
                  icon={GROUP_ICONS.hr}
                  links={hrLinks}
                  isActive={isActive}
                  pathname={pathname}
                />
              )}

              {/* Admin dropdown */}
              {adminLinks.length > 0 && (
                <NavDropdown 
                  label={GROUP_LABELS.admin}
                  icon={GROUP_ICONS.admin}
                  links={adminLinks}
                  isActive={isActive}
                  pathname={pathname}
                />
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              
              {/* User info - desktop */}
              <div className="hidden md:flex items-center gap-3 text-sm">
                {loading && <span className="text-zinc-400">…</span>}
                {!loading && user && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-xs font-medium">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-right hidden lg:block">
                      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[100px]">
                        {user.email.split("@")[0]}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {user.role === "ADMIN" ? "Admin" : user.role === "HR" ? "HR" : "Unit-Leiter"}
                      </div>
                    </div>
                  </div>
                )}
                {!loading && !user && !error && (
                  <Link 
                    href="/login"
                    className="px-4 py-1.5 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    Anmelden
                  </Link>
                )}
                {user && <LogoutButton />}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Menü öffnen"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div 
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-[280px] max-w-[85vw] bg-white dark:bg-zinc-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">Menü</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Menü schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Info - Mobile */}
        {user && (
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-semibold text-zinc-600 dark:text-zinc-300">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 dark:text-white truncate">
                  {user.email.split("@")[0]}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {user.role === "ADMIN" ? "Administrator" : user.role === "HR" ? "HR Manager" : "Unit-Leiter"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-2">
          {groupedLinks.map((group, idx) => (
            <div key={group.key} className={idx > 0 ? "mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800" : ""}>
              <div className="px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {GROUP_LABELS[group.key]}
                </span>
              </div>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <NavIcon name={link.icon} className="w-5 h-5 shrink-0" />
                  <span>{link.label}</span>
                  {isActive(link.href) && (
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile Footer Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          {user ? (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                // Trigger logout
                fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/login";
                });
              }}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
            >
              <NavIcon name="logout" className="w-5 h-5" />
              Abmelden
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
            >
              Anmelden
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
