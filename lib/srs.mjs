// Thuật toán lặp lại ngắt quãng (SM-2, giống Anki/SuperMemo).
// File thuần JS, không dùng module Node -> dùng được cả ở server lẫn client.

export const DAY = 86400000;

// Tách ô Vocabulary thành các thẻ. Mỗi dòng: "từ : nghĩa"
const SEPS = [" : ", " :", "::", ":", " ~ ", "~", " = ", "=", " – ", " - ", " — "];
export function parseVocab(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let front = line, back = "";
      for (const s of SEPS) {
        const i = line.indexOf(s);
        if (i > -1) {
          front = line.slice(0, i).trim();
          back = line.slice(i + s.length).trim();
          break;
        }
      }
      return { front, back };
    })
    .filter((x) => x.front);
}

// Xem trước khoảng cách ôn tới nếu bấm 1 nút, KHÔNG thay đổi thẻ.
export function preview(card, grade) {
  let { ease, reps, interval } = card;
  if (grade === "again") return { mins: 10 };
  if (grade === "hard") interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
  else if (grade === "good") interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
  else if (grade === "easy") interval = reps === 0 ? 4 : Math.round(interval * ease * 1.35);
  return { days: Math.max(1, interval) };
}

// Cập nhật thẻ sau khi chấm điểm.
export function applyGrade(card, grade) {
  const now = Date.now();
  if (grade === "again") {
    card.reps = 0;
    card.lapses = (card.lapses || 0) + 1;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.interval = 0;
    card.due = now + 10 * 60 * 1000; // ôn lại sau ~10 phút
  } else if (grade === "hard") {
    card.ease = Math.max(1.3, card.ease - 0.15);
    card.interval = card.reps === 0 ? 1 : Math.max(1, Math.round(card.interval * 1.2));
    card.reps++;
    card.due = now + card.interval * DAY;
  } else if (grade === "good") {
    card.interval = card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.round(card.interval * card.ease);
    card.reps++;
    card.due = now + card.interval * DAY;
  } else if (grade === "easy") {
    card.ease = card.ease + 0.15;
    card.interval = card.reps === 0 ? 4 : Math.round(card.interval * card.ease * 1.35);
    card.reps++;
    card.due = now + card.interval * DAY;
  }
  return card;
}

export function fmtInterval(p) {
  if (p.mins) return "~" + p.mins + " phút";
  const d = p.days;
  if (d < 30) return d + " ngày";
  if (d < 365) return Math.round(d / 30) + " tháng";
  return (d / 365).toFixed(1) + " năm";
}
