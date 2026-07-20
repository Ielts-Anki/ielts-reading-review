# Sổ ôn IELTS Reading

Bảng sửa đề IELTS Reading dạng lưới (giống Google Sheet) + flashcard học từ vựng theo
phương pháp lặp lại ngắt quãng (SM-2, giống Anki) + nhắc ôn qua email Gmail.

Cột trong bảng: **Link/nguồn · Tên bài · Mistake (sai gì / vì sao) · Thông tin trong bài ·
Paraphrase · Vocabulary**. Gõ vào ô Vocabulary theo dạng `từ : nghĩa`, mỗi dòng một từ, là
thẻ tự sinh ra và tự lên lịch ôn.

Dữ liệu lưu ở `data/db.json` ngay trong thư mục dự án — không cần cài database.

---

## 1. Cài đặt

Cần **Node.js phiên bản 18.17 trở lên**. Mở terminal trong thư mục dự án:

```bash
npm install
```

## 2. Chạy app

```bash
npm run dev
```

Mở trình duyệt vào **http://localhost:3000**.

- Tab **Bài học**: bảng lưới, sửa trực tiếp trong ô, ô tự lưu khi bấm ra ngoài.
- Tab **Hôm nay**: ôn các thẻ tới hạn, chấm điểm Quên/Khó/Được/Dễ.
- Tab **Từ vựng**: xem mọi thẻ, lọc, và nút **Xuất sang Anki**.

## 3. Bật nhắc qua email

1. Sao chép `.env.example` thành `.env`.
2. Điền `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `REMINDER_TO`.
   - `GMAIL_APP_PASSWORD` **không phải** mật khẩu đăng nhập. Bật Xác minh 2 bước, rồi tạo
     App Password tại https://myaccount.google.com/apppasswords
3. Gửi thử ngay:

```bash
npm run remind
```

Hoặc bấm nút **"Gửi email nhắc thử ngay"** trong tab Hôm nay.

### Gửi tự động mỗi ngày

**Cách A — giữ tiến trình chạy nền** (đơn giản):

```bash
npm run remind:watch
```

Cửa sổ này cứ để mở; mỗi ngày đến giờ `REMIND_HOUR` sẽ tự gửi.

**Cách B — dùng lịch của hệ điều hành** (không cần mở cửa sổ):

- **Windows – Task Scheduler**: tạo task chạy hằng ngày, chương trình `npm`, tham số
  `run remind`, "Start in" là thư mục dự án.
- **macOS/Linux – cron**: `crontab -e` rồi thêm (7h sáng mỗi ngày):

  ```
  0 7 * * * cd /duong/dan/den/du-an && /usr/bin/npm run remind
  ```

---

## Ghi chú

- Email chỉ hiển thị **mặt trước** (từ) để bạn tự kiểm tra trước khi mở app — đúng cách chống quên.
- Muốn có thông báo đẩy trên điện thoại: dùng nút **Xuất sang Anki** rồi Import vào app Anki.
- Thuật toán ôn nằm ở `lib/srs.mjs`; muốn chỉnh khoảng cách ôn thì sửa ở đó.
