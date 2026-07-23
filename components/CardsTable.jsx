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
  
  const [enriching, setEnriching] = useState({ active: false, current: 0, total: 0 });

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/cards");
    setCards(await r.json());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function del(id) {
    if (!confirm("Xoá thẻ này vĩnh viễn?")) return;
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
  
  async function enrichAll() {
    const targets = cards.filter(c => !c.ipa || !c.topic || c.topic === "General" || c.topic === "Chưa phân loại" || c.topic === "Error");
    if (targets.length === 0) {
      toast && toast("Tất cả thẻ đã có dữ liệu AI đầy đủ!");
      return;
    }
    if (!confirm(`Tìm thấy ${targets.length} thẻ chưa được phân loại bằng AI. Bắt đầu quá trình quét tự động? (Bạn không nên đóng tab này)`)) return;
    
    setEnriching({ active: true, current: 0, total: targets.length });
    
    let successCount = 0;
    const newCards = [...cards];
    
    for (let i = 0; i < targets.length; i++) {
       const card = targets[i];
       try {
         const res = await fetch("/api/dictionary", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ word: card.front, context: "" })
         });
         const data = await res.json();
         if (data.error) throw new Error(data.error);

         const updatedCard = { ...card, ...data };
         if (!updatedCard.meaning) updatedCard.meaning = card.back;

         await fetch(`/api/cards/${card.id}`, {
           method: "PUT",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(updatedCard)
         });
         
         const idx = newCards.findIndex(c => c.id === card.id);
         if (idx !== -1) Object.assign(newCards[idx], updatedCard);
         
         setCards([...newCards]);
         successCount++;
       } catch (err) {
         console.error("Enrich error for", card.front, err);
       }
       setEnriching({ active: true, current: i + 1, total: targets.length });
    }
    
    setEnriching({ active: false, current: 0, total: 0 });
    toast && toast(`Hoàn tất điền AI cho ${successCount}/${targets.length} thẻ!`);
    onChanged && onChanged();
  }

  const now = Date.now();
  let list = cards.slice();
  if (filter === "due") list = list.filter((c) => c.due <= now);
  else if (filter === "new") list = list.filter((c) => c.reps === 0);
  else if (filter === "learned") list = list.filter((c) => c.reps >= 2);
  
  // Group by topic
  const groups = {};
  list.forEach(c => {
    let t = c.topic;
    if (!t || t === "General" || t === "Error") t = "Chưa phân loại";
    if (!groups[t]) groups[t] = [];
    groups[t].push(c);
  });
  
  const groupKeys = Object.keys(groups).sort((a,b) => {
    if (a === "Chưa phân loại") return 1;
    if (b === "Chưa phân loại") return -1;
    return a.localeCompare(b);
  });

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
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {enriching.active ? (
            <div style={{ background: '#fff9e6', color: '#e67e22', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #f1c40f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#e67e22', borderRightColor: '#e67e22', borderBottomColor: '#e67e22', borderLeftColor: 'transparent', borderWidth: 2, borderStyle: 'solid', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Đang quét AI: {enriching.current} / {enriching.total} thẻ...
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <button className="btn" style={{ background: '#f39c12', color: 'white', border: 'none' }} onClick={enrichAll}>
               ✨ Tự động điền AI tất cả thẻ
            </button>
          )}
          <button className="btn ghost" onClick={exportAnki}>Xuất sang Anki</button>
        </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
          {groupKeys.map(topic => (
            <div key={topic}>
              <h3 style={{ margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>{topic === "Chưa phân loại" ? "📦" : "🏷️"}</span>
                {topic}
                <span style={{ fontSize: '13px', color: '#999', fontWeight: 'normal' }}>({groups[topic].length} từ)</span>
              </h3>
              
              <table className="cards">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Từ vựng</th>
                    <th style={{ width: '45%' }}>Nghĩa & Thông tin</th>
                    <th style={{ width: '15%' }}>Bài học</th>
                    <th>Lần ôn tới</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {groups[topic].map((c) => {
                    const d = fmtDue(c.due);
                    return (
                      <tr key={c.id}>
                        <td style={{ verticalAlign: 'top' }}>
                          <b className="hl-text" style={{ fontSize: '16px' }}>{c.front}</b>
                          {c.ipa && <div style={{ fontSize: '13px', color: '#666', fontFamily: 'monospace', marginTop: '4px' }}>{c.ipa}</div>}
                          {c.pos && <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#3498db', fontStyle: 'italic', marginTop: '4px' }}>{c.pos}</div>}
                        </td>
                        <td style={{ verticalAlign: 'top' }}>
                          <div style={{ fontSize: '15px', fontWeight: '600' }}>🇻🇳 {c.meaning || c.back || "—"}</div>
                          {c.engMeaning && (
                             <div style={{ fontSize: '13px', color: '#9b59b6', marginTop: '6px' }}>🇬🇧 {c.engMeaning}</div>
                          )}
                          {c.example && (
                             <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', borderLeft: '2px solid #ccc', paddingLeft: '8px', marginTop: '8px' }}>
                               <div>📝 {c.example}</div>
                               {c.translatedExample && <div style={{ marginTop: '2px', color: '#888', fontSize: '12px' }}>↳ 🇻🇳 {c.translatedExample}</div>}
                             </div>
                          )}
                          {c.collocations && !c.collocations.includes("Lỗi") && !c.collocations.includes("Cần cấu hình") && (
                             <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', fontWeight: 'bold' }}>🔗 Collocations</div>
                                <div style={{ fontSize: '12px', color: '#333', whiteSpace: 'pre-wrap' }}>{c.collocations}</div>
                             </div>
                          )}
                        </td>
                        <td style={{ color: "var(--ink-soft)", verticalAlign: 'top', fontSize: '13px' }}>{c.lessonTitle || ""}</td>
                        <td style={{ verticalAlign: 'top' }}>
                           <span className={"due-tag " + d.cls}>{d.t}</span>
                           <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>Đã ôn {c.reps} lần</div>
                        </td>
                        <td style={{ verticalAlign: 'top' }}>
                          <button className="del-x" title="Xoá thẻ" onClick={() => del(c.id)}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
