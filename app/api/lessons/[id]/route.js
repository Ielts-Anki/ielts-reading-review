import { NextResponse } from "next/server";
import { updateLesson, deleteLesson } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const updated = await updateLesson(params.id, body);
  return NextResponse.json(updated);
}
export async function DELETE(_req, { params }) {
  await deleteLesson(params.id);
  return NextResponse.json({ ok: true });
}
