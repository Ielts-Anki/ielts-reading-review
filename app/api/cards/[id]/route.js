import { NextResponse } from "next/server";
import { deleteCard } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  await deleteCard(params.id);
  return NextResponse.json({ ok: true });
}
