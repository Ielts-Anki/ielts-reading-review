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

function ContextModal({ card, lessons, onClose }) {
  const lesson = lessons.find(l => l.id === card.lessonId);
  if (!lesson) {
     return (
       <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px' }}>
            Không tìm thấy dữ liệu gốc của thẻ này. <button onClick={onClose}>Đóng</button>
          </div>
       </div>
     );
  }
  
  const formatText = (val) => {
    return {
      __html: (val || "")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/\n/g, "<br/>")
       .replace(/==([^=]+)==/g, "<mark class='hl'>$1</mark>")
    };
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>📚 Ngữ cảnh</h3>
        <p style={{ color: '#666', fontSize: '13px' }}>Từ bài: <b style={{color: '#111'}}>{lesson.title}</b> {lesson.source ? `(${lesson.source})` : ""}</p>
        
        {lesson.mistake && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Mistake / Sai gì</div>
            <div dangerouslySetInnerHTML={formatText(lesson.mistake)} style={{ padding: '12px', background: '#fff9e6', borderLeft: '4px solid #f1c40f', borderRadius: '4px', fontSize: '14.5px', lineHeight: 1.5 }} />
          </div>
        )}
        
        {lesson.info && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Thông tin trong bài</div>
            <div dangerouslySetInnerHTML={formatText(lesson.info)} style={{ padding: '12px', background: '#f0f4f8', borderLeft: '4px solid #3498db', borderRadius: '4px', fontSize: '14.5px', lineHeight: 1.5 }} />
          </div>
        )}
        
        {lesson.paraphrase && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Paraphrase</div>
            <div dangerouslySetInnerHTML={formatText(lesson.paraphrase)} style={{ padding: '12px', background: '#f8f9fa', borderLeft: '4px solid #95a5a6', borderRadius: '4px', fontSize: '14.5px', lineHeight: 1.5 }} />
          </div>
        )}
        
        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <button className="btn" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

function Forecast({ cards }) {
  const base = startOfToday();
  const counts = new Array(7).fill(0);
  for (const c of cards) {
    let i = Math.floor((c.due - base) / DAY);
    if (i < 0) i = 0; 
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
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(false);
  const [cramMode, setCramMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [showCtxCard, setShowCtxCard] = useState(null);

  const [queue, setQueue] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [justFinished, setJustFinished] = useState(0);

  const [enriching, setEnriching] = useState(false);

  async function enrichCard(card) {
    if (enriching) return;
    setEnriching(true);
    toast && toast("AI đang phân tích từ...");
    try {
      const lesson = lessons.find(l => l.id === card.lessonId);
      const ctx = lesson ? lesson.info : "";
      const res = await fetch("/api/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.front, context: ctx })
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
      
      setQueue(q => q.map(c => c.id === card.id ? updatedCard : c));
      toast && toast("Đã điền thành công!");
    } catch (e) {
      toast && toast("Lỗi: " + e.message);
    }
    setEnriching(false);
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, c, l] = await Promise.all([
      fetch("/api/review"), 
      fetch("/api/cards"),
      fetch("/api/lessons")
    ]);
    setDue(await d.json());
    setAll(await c.json());
    setLessons(await l.json());
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
    setCramMode(false);
    setHistory([]);
  }

  function startCram() {
    const shuffled = [...all].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(20, shuffled.length));
    if (selected.length === 0) {
       toast && toast("Chưa có thẻ nào để học");
       return;
    }
    setQueue(selected);
    setTotal(selected.length);
    setDone(0);
    setFlipped(false);
    setJustFinished(0);
    setSession(true);
    setCramMode(true);
    setHistory([]);
  }

  const undo = useCallback(async () => {
    if (cramMode || history.length === 0) return;
    
    const last = history[history.length - 1];
    const prevCard = last.card;
    
    // Revert DB state
    await fetch(`/api/cards/${prevCard.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prevCard),
    });
    
    setHistory(h => h.slice(0, -1));
    // Put card back at front and remove any later instance of it
    setQueue(q => [prevCard, ...q.filter(c => c.id !== prevCard.id)]);
    setDone(d => Math.max(0, d - 1));
    setFlipped(false);
    toast && toast("Đã hoàn tác (Undo)");
  }, [history, cramMode, toast]);

  const grade = useCallback(
    (g) => {
      setQueue((q) => {
        if (q.length === 0) return q;
        const card = q[0];
        
        if (!cramMode) {
          setHistory(h => [...h, { card: { ...card } }]);
          fetch("/api/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: card.id, grade: g }),
          });
        }
        
        let next;
        if (g === "again") {
          next = q.slice(1).concat(card); 
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
    [total, refresh, onChanged, cramMode]
  );

  useEffect(() => {
    if (!session) return;
    const onKey = (e) => {
      if (showCtxCard) return; // Disable keys when modal open
      if (e.code === "KeyZ") {
        e.preventDefault();
        undo();
        return;
      }
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
  }, [session, flipped, grade, undo, showCtxCard]);

  if (loading) return <div className="empty">Đang tải…</div>;

  const newCount = all.filter((c) => c.reps === 0).length;
  const young = all.filter((c) => c.reps > 0 && c.interval < 21).length;
  const mature = all.filter((c) => c.interval >= 21).length;

  if (session && queue.length > 0) {
    const card = queue[0];
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <section>
        {showCtxCard && <ContextModal card={showCtxCard} lessons={lessons} onClose={() => setShowCtxCard(null)} />}
        
        <div className="prog-wrap">
          <div className="prog-top">
            <span>{done}/{total} thẻ {cramMode ? <span style={{color: 'var(--warn)'}}>(Ôn tự do)</span> : ""}</span>
            <div>
              {!cramMode && history.length > 0 && <button className="link-btn" onClick={undo} style={{marginRight: '16px', color: '#e67e22'}}>↩️ Quay lại (Z)</button>}
              <button className="link-btn" onClick={() => { setSession(false); refresh(); }}>Thoát</button>
            </div>
          </div>
          <div className="prog-track"><div className="prog-fill" style={{ width: pct + "%" }} /></div>
        </div>

        <div className="flip" onClick={() => setFlipped(!flipped)} style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className={"flip-inner" + (flipped ? " is-flipped" : "")}>
            <div className="face front">
              <div className="ctx">{card.lessonTitle || "—"} · còn {queue.length}</div>
              <div className="word">
                <span className="hl-text">{card.front}</span>
                <button title="Xem ngữ cảnh" onClick={(e) => { e.stopPropagation(); setShowCtxCard(card); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', verticalAlign: 'text-bottom', marginLeft: '12px' }}>👁️</button>
              </div>
              <div className="tap-hint">Nhấn để xem nghĩa · phím Space</div>
            </div>
            <div className="face back">
              <div className="ctx">{card.lessonTitle || "—"}</div>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <div className="word sm"><span className="hl-text">{card.front}</span></div>
                {card.ipa && <div style={{ fontSize: '15px', color: '#666', fontFamily: 'monospace' }}>{card.ipa}</div>}
                {card.pos && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#3498db', fontStyle: 'italic' }}>{card.pos}</div>}
                <button title="Xem ngữ cảnh" onClick={(e) => { e.stopPropagation(); setShowCtxCard(card); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', verticalAlign: 'text-bottom' }}>👁️</button>
              </div>
              
              <div className="face-divider" />
              
              <div className="meaning" style={{ fontSize: '18px', fontWeight: '500' }}>🇻🇳 {card.meaning || card.back || "(chưa nhập nghĩa)"}</div>
              
              {card.engMeaning && (
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#9b59b6', fontWeight: '500' }}>
                  🇬🇧 {card.engMeaning}
                </div>
              )}
              
              {card.example && (
                <div style={{ marginTop: '12px', fontSize: '14px', color: '#555', fontStyle: 'italic', borderLeft: '3px solid #ccc', paddingLeft: '8px' }}>
                  <div>📝 {card.example}</div>
                  {card.translatedExample && <div style={{ marginTop: '4px', color: '#888', fontSize: '13px' }}>↳ 🇻🇳 {card.translatedExample}</div>}
                </div>
              )}
              
              {card.collocations && !card.collocations.includes("Lỗi") && (
                <div style={{ marginTop: '20px', textAlign: 'left', background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                   <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>🔗 Collocations</div>
                   <div style={{ fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{card.collocations}</div>
                </div>
              )}
              {card.collocations && card.collocations.includes("Lỗi") && (
                <div style={{ marginTop: '20px', textAlign: 'center', background: '#fff3f3', padding: '10px', borderRadius: '10px' }}>
                   <div style={{ fontSize: '12px', color: '#e74c3c', fontWeight: 'bold' }}>⚠️ AI chưa điền thành công (Hãy ấn nút quét lại ở tab Từ Vựng)</div>
                </div>
              )}
              
              {card.topic && (
                <div style={{ marginTop: '8px', display: 'inline-block', background: '#eee', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', color: '#555' }}>
                  🏷️ {card.topic}
                </div>
              )}
              
              {!card.ipa && (
                 <div style={{ marginTop: '16px', textAlign: 'center' }}>
                   <button 
                     className="btn ghost" 
                     onClick={(e) => { e.stopPropagation(); enrichCard(card); }}
                     style={{ fontSize: '12px', padding: '4px 8px', color: '#e67e22', background: '#fff9e6' }}
                     disabled={enriching}
                   >
                     {enriching ? "Đang chạy AI..." : "✨ Tự động điền bằng AI"}
                   </button>
                 </div>
              )}
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
                  <span className="g-int">{cramMode ? "—" : fmtInterval(preview(card, g))}</span>
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
          <button className="btn ghost" onClick={startCram} style={{ marginTop: '16px', background: '#f5f5f5', color: '#333' }}>
            🎲 Ôn tập tự do (Học lại tiếp)
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="link-btn" onClick={startCram} style={{ fontSize: '13px', color: '#999' }}>
             Hoặc Ôn tập tự do (Không lưu điểm)
          </button>
        </div>
      )}

      <div className="note">
        <b>Nhắc qua email:</b> để được báo mỗi ngày kể cả khi không mở app, chạy{" "}
        <span className="mono">npm run remind</span> (hoặc đặt lịch tự động — xem README).
      </div>
    </section>
  );
}
