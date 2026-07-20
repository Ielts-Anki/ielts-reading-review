"use client";
import { useEffect, useState } from "react";

const DAY = 86400000;
function fmtDue(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return { t: "Cần ôn", cls: "now" };
  const days = Math.ceil(diff / DAY);
  if (days <= 1) return { t: "Ngày mai", cls: "soon" };
  if (days < 7) return { t: days + " ngày nữa", cls: "soon" };
  if (days < 30) return { t: days + " ngày nữa", cls: "far" };
  if (days < 365) return { t: Math.round(days / 30) + " tháng nữa", cls: "far" };
  return { t: (days / 365).toFixed(1) + " năm nữa", cls: "far" };
}

export default function CardsTable({ onChanged, toast }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/cards");
    setCards(await r.json());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function del(id) {
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    setCards((cs) => cs.filter((c) => c.id !== id));
    onChanged && onChanged();
    toast && toast("Đã xoá thẻ");
  }

  function exportAnki() {
    if (cards.length === 0) return toast && toast("Chưa có thẻ để xuất");
    const text = cards.map((c) => `${c.front}\t${c.back}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ielts-vocab-anki.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    toast && toast("Đã tải file — mở Anki rồi Import");
  }

  const now = Date.now();
  let list = cards.slice();
  if (filter === "due") list = list.filter((c) => c.due <= now);
  else if (filter === "new") list = list.filter((c) => c.reps === 0);
  else if (filter === "learned") list = list.filter((c) => c.reps >= 2);
  list.sort((a, b) => a.due - b.due);

  const FILTERS = [
    ["all", "Tất cả"],
    ["due", "Cần ôn"],
    ["new", "Thẻ mới"],
    ["learned", "Đã thuộc"],
  ];

  return (
    <section>
      <div className="row-head">
        <div className="fill">
          <p className="eyebrow">Bộ thẻ của bạn</p>
          <h2 className="section">Từ vựng</h2>
        </div>
        <button className="btn ghost" onClick={exportAnki}>Xuất sang Anki</button>
      </div>

      <div className="filter-bar">
        {FILTERS.map(([f, lab]) => (
          <button
            key={f}
            className={"chip-toggle " + (filter === f ? "on" : "")}
            onClick={() => setFilter(f)}
          >
            {lab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Đang tải…</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <b>Không có thẻ ở mục này.</b>
          <br />
          {cards.length === 0 ? "Thêm Vocabulary trong tab Bài học để bắt đầu." : "Thử bộ lọc khác."}
        </div>
      ) : (
        <table className="cards">
          <thead>
            <tr>
              <th>Từ</th>
              <th>Nghĩa</th>
              <th>Bài</th>
              <th>Lần ôn tới</th>
              <th>Số lần</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const d = fmtDue(c.due);
              return (
                <tr key={c.id}>
                  <td><b className="hl-text">{c.front}</b></td>
                  <td>{c.back || "—"}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{c.lessonTitle || ""}</td>
                  <td><span className={"due-tag " + d.cls}>{d.t}</span></td>
                  <td className="mono">{c.reps}</td>
                  <td>
                    <button className="del-x" title="Xoá thẻ" onClick={() => del(c.id)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
