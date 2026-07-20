"use client";
import { useCallback, useEffect, useState } from "react";
import { preview, fmtInterval } from "@/lib/srs.mjs";

const DAY = 86400000;
const GRADES = [
  ["again", "Quên", "1"],
  ["hard", "Khó", "2"],
  ["good", "Được", "3"],
  ["easy", "Dễ", "4"],
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Biểu đồ số thẻ tới hạn trong 7 ngày tới
function Forecast({ cards }) {
  const base = startOfToday();
  const counts = new Array(7).fill(0);
  for (const c of cards) {
    let i = Math.floor((c.due - base) / DAY);
    if (i < 0) i = 0; // quá hạn dồn vào hôm nay
    if (i >= 0 && i < 7) counts[i]++;
  }
  const max = Math.max(...counts, 1);
  const labels = counts.map((_, i) => {
    if (i === 0) return "Hôm nay";
    if (i === 1) return "Mai";
    const d = new Date(base + i * DAY);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  return (
    <div className="forecast">
      <div className="forecast-head">Lịch ôn 7 ngày tới</div>
      <div className="bars">
        {counts.map((n, i) => (
          <div className="bar-col" key={i}>
            <div className="bar-num">{n || ""}</div>
            <div
              className={"bar" + (i === 0 ? " today" : "")}
              style={{ height: Math.max(4, (n / max) * 84) + "px" }}
            />
            <div className="bar-lab">{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Review({ onChanged, toast }) {
  const [all, setAll] = useState([]);
  const [due, setDue] = useState([]);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(false);
  const [queue, setQueue] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [justFinished, setJustFinished] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, c] = await Promise.all([fetch("/api/review"), fetch("/api/cards")]);
    setDue(await d.json());
    setAll(await c.json());
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  function start() {
    setQueue(due.slice());
    setTotal(due.length);
    setDone(0);
    setFlipped(false);
    setJustFinished(0);
    setSession(true);
  }

  const grade = useCallback(
    (g) => {
      setQueue((q) => {
        if (q.length === 0) return q;
        const card = q[0];
        fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, grade: g }),
        });
        let next;
        if (g === "again") {
          next = q.slice(1).concat(card); // học lại ngay: đẩy xuống cuối
        } else {
          next = q.slice(1);
          setDone((n) => n + 1);
        }
        setFlipped(false);
        if (next.length === 0) {
          setSession(false);
          setJustFinished(total);
          refresh();
          onChanged && onChanged();
        }
        return next;
      });
    },
    [total, refresh, onChanged]
  );

  // Phím tắt
  useEffect(() => {
    if (!session) return;
    const onKey = (e) => {
      if (!flipped) {
        if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") {
          e.preventDefault();
          setFlipped(true);
        }
        return;
      }
      const map = { Digit1: "again", Digit2: "hard", Digit3: "good", Digit4: "easy", Space: "good" };
      if (map[e.code]) {
        e.preventDefault();
        grade(map[e.code]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, flipped, grade]);

  if (loading) return <div className="empty">Đang tải…</div>;

  const newCount = all.filter((c) => c.reps === 0).length;
  const young = all.filter((c) => c.reps > 0 && c.interval < 21).length;
  const mature = all.filter((c) => c.interval >= 21).length;

  // ----- ĐANG TRONG PHIÊN ÔN -----
  if (session && queue.length > 0) {
    const card = queue[0];
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <section>
        <div className="prog-wrap">
          <div className="prog-top">
            <span>{done}/{total} thẻ</span>
            <button className="link-btn" onClick={() => { setSession(false); refresh(); }}>Thoát</button>
          </div>
          <div className="prog-track"><div className="prog-fill" style={{ width: pct + "%" }} /></div>
        </div>

        <div className="flip" onClick={() => !flipped && setFlipped(true)}>
          <div className={"flip-inner" + (flipped ? " is-flipped" : "")}>
            <div className="face front">
              <div className="ctx">{card.lessonTitle || "—"} · còn {queue.length}</div>
              <div className="word"><span className="hl-text">{card.front}</span></div>
              <div className="tap-hint">Nhấn để xem nghĩa · phím Space</div>
            </div>
            <div className="face back">
              <div className="ctx">{card.lessonTitle || "—"}</div>
              <div className="word sm"><span className="hl-text">{card.front}</span></div>
              <div className="face-divider" />
              <div className="meaning">{card.back || "(chưa nhập nghĩa)"}</div>
            </div>
          </div>
        </div>

        {flipped ? (
          <>
            <div className="grade-row">
              {GRADES.map(([g, lab, key]) => (
                <button key={g} className={"grade " + g} onClick={() => grade(g)}>
                  <span className="g-key">{key}</span>
                  <span className="g-lab">{lab}</span>
                  <span className="g-int">{fmtInterval(preview(card, g))}</span>
                </button>
              ))}
            </div>
            <p className="kbd-hint">Phím tắt: <b>1</b> Quên · <b>2</b> Khó · <b>3</b> Được · <b>4</b> Dễ · <b>Space</b> = Được</p>
          </>
        ) : (
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button className="btn" onClick={() => setFlipped(true)}>Hiện nghĩa</button>
          </div>
        )}
      </section>
    );
  }

  // ----- MÀN CHÍNH -----
  return (
    <section>
      <p className="eyebrow">Ôn tập theo lịch quên</p>
      <h2 className="section">Hôm nay</h2>
      <p className="sub">
        Mỗi thẻ được lên lịch bằng thuật toán lặp lại ngắt quãng (SM-2, giống Anki/SuperMemo):
        nhớ tốt thì giãn dần, quên thì lặp lại sớm.
      </p>

      <div className="today-grid">
        <div className="due-card">
          <div className="bignum">{due.length}</div>
          <div className="due-lab">{due.length ? "thẻ cần ôn hôm nay" : "không còn thẻ cần ôn"}</div>
          {due.length > 0 && (
            <button className="btn" onClick={start} style={{ marginTop: 14 }}>Bắt đầu ôn →</button>
          )}
        </div>
        <div className="stat-strip">
          <div className="stat"><span className="stat-n" style={{ color: "#8a6d00" }}>{newCount}</span><span className="stat-l">Thẻ mới</span></div>
          <div className="stat"><span className="stat-n" style={{ color: "var(--warn)" }}>{young}</span><span className="stat-l">Đang học</span></div>
          <div className="stat"><span className="stat-n" style={{ color: "var(--good)" }}>{mature}</span><span className="stat-l">Đã thuộc</span></div>
          <div className="stat"><span className="stat-n">{all.length}</span><span className="stat-l">Tổng</span></div>
        </div>
      </div>

      {all.length > 0 && <Forecast cards={all} />}

      {all.length === 0 ? (
        <div className="empty">
          <b>Chưa có thẻ nào.</b><br />
          Sang tab <b style={{ fontFamily: "inherit" }}>Bài học</b> và nhập ô Vocabulary để tạo thẻ tự động.
        </div>
      ) : due.length === 0 ? (
        <div className="done-state" style={{ paddingTop: 30 }}>
          <div className="tick">✓</div>
          <h3>{justFinished ? `Đã ôn xong ${justFinished} thẻ!` : "Xong hết rồi!"}</h3>
          <p>Hôm nay không còn thẻ nào tới hạn. Xem biểu đồ trên để biết ngày mai phải ôn bao nhiêu.</p>
        </div>
      ) : null}

      <div className="note">
        <b>Nhắc qua email:</b> để được báo mỗi ngày kể cả khi không mở app, chạy{" "}
        <span className="mono">npm run remind</span> (hoặc đặt lịch tự động — xem README).
      </div>
      <button
        className="btn ghost sm"
        style={{ marginTop: 12 }}
        onClick={async () => {
          const r = await fetch("/api/remind", { method: "POST" });
          const d = await r.json();
          toast && toast(d.sent ? `Đã gửi mail ${d.count} thẻ` : d.error || d.message || "Không gửi được");
        }}
      >
        Gửi email nhắc thử ngay
      </button>
    </section>
  );
}
