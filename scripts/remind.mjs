// Gửi email nhắc ôn NGAY BÂY GIỜ, dựa trên số thẻ đang tới hạn.
// Chạy: npm run remind
import "dotenv/config";
import { getDueCards } from "../lib/db.mjs";
import { sendReminder } from "../lib/mailer.mjs";

const due = await getDueCards();
const to = process.env.REMINDER_TO || process.env.GMAIL_USER;

if (due.length === 0) {
  console.log("Không có thẻ nào cần ôn — không gửi mail.");
  process.exit(0);
}
try {
  await sendReminder({
    due,
    to,
    appUrl: process.env.APP_URL || "http://localhost:3000",
  });
  console.log(`Đã gửi nhắc ${due.length} thẻ tới ${to}`);
} catch (e) {
  console.error("Lỗi gửi mail:", e.message);
  process.exit(1);
}
