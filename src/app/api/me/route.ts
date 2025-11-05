import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  return Response.json(user);
}
