// Chạy nền, tự gửi mail nhắc mỗi ngày lúc REMIND_HOUR giờ.
// Chạy: npm run remind:watch   (giữ cửa sổ này mở, Ctrl+C để dừng)
import "dotenv/config";
import cron from "node-cron";
import { getDueCards } from "../lib/db.mjs";
import { sendReminder } from "../lib/mailer.mjs";

const hour = Number(process.env.REMIND_HOUR || 7);
const to = process.env.REMINDER_TO || process.env.GMAIL_USER;

console.log(`Scheduler đang chạy. Sẽ gửi nhắc mỗi ngày lúc ${hour}h. Ctrl+C để dừng.`);

cron.schedule(`0 ${hour} * * *`, async () => {
  const due = await getDueCards();
  if (due.length === 0) {
    console.log(new Date().toLocaleString(), "- không có thẻ cần ôn.");
    return;
  }
  try {
    await sendReminder({ due, to, appUrl: process.env.APP_URL || "http://localhost:3000" });
    console.log(new Date().toLocaleString(), `- đã gửi ${due.length} thẻ.`);
  } catch (e) {
    console.error("Lỗi gửi mail:", e.message);
  }
});
