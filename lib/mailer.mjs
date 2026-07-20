import nodemailer from "nodemailer";

export function makeTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong file .env. Xem .env.example."
    );
  }
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])
  );
}

// due: mảng thẻ tới hạn. Email chỉ hiện MẶT TRƯỚC (từ) để bạn tự kiểm tra.
export async function sendReminder({ due, to, appUrl = "http://localhost:3000" }) {
  const transport = makeTransport();
  const words = due
    .slice(0, 40)
    .map((c) => `<li style="margin:4px 0"><b>${esc(c.front)}</b></li>`)
    .join("");
  const extra = due.length > 40 ? `<p style="color:#666">…và ${due.length - 40} từ nữa.</p>` : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#20223A">
    <div style="background:#FFE34D;border-radius:12px;padding:18px 22px;margin-bottom:18px">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a6d00;font-weight:700">Sổ ôn IELTS Reading</div>
      <div style="font-size:26px;font-weight:700;margin-top:4px">Hôm nay có ${due.length} từ cần ôn</div>
    </div>
    <p style="color:#5A5D78">Thử nhớ nghĩa của từng từ trước khi mở app để kiểm tra — đúng cách chống quên theo đường cong Ebbinghaus.</p>
    <ul style="padding-left:20px">${words}</ul>
    ${extra}
    <a href="${esc(appUrl)}" style="display:inline-block;background:#20223A;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:600;margin-top:10px">Mở app ôn ngay →</a>
    <p style="color:#9a9db3;font-size:12px;margin-top:24px">Email tự động từ Sổ ôn IELTS Reading của bạn.</p>
  </div>`;

  await transport.sendMail({
    from: `"Sổ ôn IELTS" <${process.env.GMAIL_USER}>`,
    to,
    subject: `🔔 ${due.length} từ IELTS cần ôn hôm nay`,
    html,
  });
}
