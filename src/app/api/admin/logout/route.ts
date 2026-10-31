import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in first." } },
      { status: 401 },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    maxAge: 0,
  });
  return response;
}
