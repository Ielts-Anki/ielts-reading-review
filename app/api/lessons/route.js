import { NextResponse } from "next/server";
import { getLessons, createLesson } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLessons());
}
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await createLesson(body));
}
