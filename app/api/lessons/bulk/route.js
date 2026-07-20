import { upsertLessons } from "@/lib/db.mjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const dataArray = await req.json();
    if (!Array.isArray(dataArray)) {
      return NextResponse.json({ error: "Invalid data format, expected array" }, { status: 400 });
    }
    const results = await upsertLessons(dataArray);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
