"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const kinds = [
  { key: "birthdays", label: "Geburtstage" },
  { key: "jubilees", label: "Jubiläen" },
  { key: "hires", label: "Eintritte" },
] as const;

type Kind = typeof kinds[number]["key"];

export default function KindSwitcher() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = (sp.get("kind") ?? "birthdays") as Kind;

  function setKind(k: Kind) {
    const p = new URLSearchParams(sp.toString());
    p.set("kind", k);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {kinds.map((k) => (
        <button
          key={k.key}
          onClick={() => setKind(k.key)}
          className={`border rounded px-2 py-1 ${current === k.key ? "bg-black text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          aria-pressed={current === k.key}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
