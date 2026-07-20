"use client";
import { useEffect, useRef, useState } from "react";
import { parseVocab } from "@/lib/srs.mjs";

const COLS = [
  { key: "link", label: "Link/nguồn", w: 150 },
  { key: "title", label: "Tên bài", w: 150 },
  { key: "mistake", label: "Mistake — sai gì / vì sao sai", w: 280 },
  { key: "info", label: "Thông tin trong bài", w: 320 },
  { key: "paraphrase", label: "Paraphrase", w: 200 },
  { key: "vocabRaw", label: "Vocabulary  ( từ : nghĩa )", w: 220, vocab: true },
];

function AutoArea({ value, onChange, onBlur, className }) {
  const ref = useRef(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffect(resize, [value]);
  return (
    <textarea
      ref={ref}
      className={"cell-area " + (className || "")}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      onBlur={onBlur}
      rows={1}
      spellCheck={false}
    />
  );
}

export default function Grid({ onChanged, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const dirty = useRef(new Set());

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/lessons");
      setRows(await r.json());
      setLoading(false);
    })();
  }, []);

  function setCell(id, key, val) {
    dirty.current.add(id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }

  async function saveRow(id) {
    if (!dirty.current.has(id)) return;
    dirty.current.delete(id);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSavingId(id);
    await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    setSavingId(null);
    onChanged && onChanged();
  }

  async function addRow() {
    const r = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const ls = await r.json();
    setRows((rs) => [ls, ...rs]);
  }

  async function delRow(id) {
    if (!confirm("Xoá bài này và tất cả thẻ từ vựng của nó?")) return;
    await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    setRows((rs) => rs.filter((r) => r.id !== id));
    onChanged && onChanged();
    toast && toast("Đã xoá bài");
  }

  return (
    <section>
      <div className="row-head">
        <div className="fill">
          <p className="eyebrow">Sửa đề &amp; ghi chú</p>
          <h2 className="section">Bài học</h2>
          <p className="sub">
            Nhìn được hết các cột cùng lúc như bảng tính. Ô <b>Mistake</b> ghi rõ câu nào sai,
            sai gì, vì sao — để lần sau tránh. Ô <b>Vocabulary</b> (mỗi dòng{" "}
            <span className="mono">từ : nghĩa</span>) tự sinh thẻ ôn.
          </p>
        </div>
        <button className="btn" onClick={addRow}>+ Thêm bài</button>
      </div>

      {loading ? (
        <div className="empty">Đang tải…</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <b>Chưa có bài nào.</b><br />
          Bấm “+ Thêm bài” để ghi lại đề vừa sửa.
        </div>
      ) : (
        <>
          <div className="grid-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th className="num-col">#</th>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.vocab ? "vocab-head" : ""} style={{ minWidth: c.w }}>
                      {c.vocab ? <span className="hl-text">{c.label}</span> : c.label}
                    </th>
                  ))}
                  <th style={{ width: 46 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const vcount = parseVocab(row.vocabRaw).length;
                  return (
                    <tr key={row.id} className={savingId === row.id ? "saving" : ""}>
                      <td className="num-col">
                        <div className="row-n">{idx + 1}</div>
                        {vcount > 0 && <div className="row-vc">{vcount} từ</div>}
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} style={{ minWidth: c.w }}>
                          <AutoArea
                            value={row[c.key]}
                            className={c.vocab ? "vocab" : ""}
                            onChange={(v) => setCell(row.id, c.key, v)}
                            onBlur={() => saveRow(row.id)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="del-x" title="Xoá bài" onClick={() => delRow(row.id)}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="grid-hint">
            Ô tự lưu khi bấm ra chỗ khác. Ví dụ Vocabulary:{" "}
            <span className="mono">dotted around : rải rác xung quanh</span> — mỗi dòng một từ.
          </p>
        </>
      )}
    </section>
  );
}
