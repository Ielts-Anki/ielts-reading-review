import { NextResponse } from "next/server";
import { updateCardState } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  const { id } = params;
  const state = await req.json().catch(() => ({}));
  await updateCardState(id, state);
  return NextResponse.json({ success: true });
}
