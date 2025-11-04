"use client";

import { useSearchParams } from "next/navigation";
import DrilldownClient from "./DrilldownClient";

type Row = { id: string; name: string; email: string; date: string; extra?: string };

type Props = {
  birthdays: Row[];
  hires: Row[];
  jubilees: Row[];
  initialMonth: number | null;
};

export default function DrilldownChooser({ birthdays, hires, jubilees, initialMonth }: Props) {
  const sp = useSearchParams();
  const rawKind = (sp.get("kind") || "birthdays").toLowerCase();
  const kind: "birthdays" | "hires" | "jubilees" = rawKind === "hires" ? "hires" : rawKind === "jubilees" ? "jubilees" : "birthdays";
  const monthParam = sp.get("month");
  const initialM = monthParam != null ? Math.max(0, Math.min(11, Number(monthParam))) : initialMonth;

  const rows = kind === "hires" ? hires : kind === "jubilees" ? jubilees : birthdays;
  const dateLabel = kind === "hires" || kind === "jubilees" ? "Eintritt" : "Geburtstag";
  const extraLabel = kind === "jubilees" ? "Jahre" : undefined;

  return (
    <DrilldownClient initialRows={rows} initialMonth={initialM} dateLabel={dateLabel} extraLabel={extraLabel} />
  );
}
