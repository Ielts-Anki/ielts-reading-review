import { NextResponse } from "next/server";
import { getDueCards } from "@/lib/db.mjs";
import { sendReminder } from "@/lib/mailer.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const due = await getDueCards();
    if (!due.length)
      return NextResponse.json({ sent: false, message: "Không có thẻ nào cần ôn." });
    
    await sendReminder({
      due,
      to: process.env.REMINDER_TO || process.env.GMAIL_USER,
      appUrl: process.env.APP_URL || "https://ielts-reading-review-eight.vercel.app",
    });
    return NextResponse.json({ sent: true, count: due.length });
  } catch (e) {
    return NextResponse.json({ sent: false, error: e.message }, { status: 500 });
  }
}
