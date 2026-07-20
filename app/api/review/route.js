import { NextResponse } from "next/server";
import { getDueCards, gradeCard } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDueCards());
}
export async function POST(req) {
  const { id, grade } = await req.json().catch(() => ({}));
  return NextResponse.json(await gradeCard(id, grade));
}
