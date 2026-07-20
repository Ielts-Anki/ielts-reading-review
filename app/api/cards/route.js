import { NextResponse } from "next/server";
import { getCards } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCards());
}
