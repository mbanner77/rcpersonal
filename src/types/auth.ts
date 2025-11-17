export type SessionRole = "ADMIN" | "HR" | "PEOPLE_MANAGER" | "UNIT_LEAD" | "TEAM_LEAD";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: SessionRole;
  unitId: string | null;
  unitName: string | null;
};
