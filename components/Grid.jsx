"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { parseVocab } from "@/lib/srs.mjs";
import nlp from "compromise";

const COLS = [
  { key: "source", label: "🏷️ Nguồn", w: 120 },
  { key: "title", label: "📄 Tên bài", w: 150 },
  { key: "myAnswer", label: "👤 Tôi chọn", w: 80 },
  { key: "correctAnswer", label: "✅ Đáp án đúng", w: 90 },
  { key: "mistake", label: "❌ Mistake — sai gì / vì sao sai", w: 250 },
  { key: "info", label: "📖 Thông tin trong bài", w: 320 },
  { key: "paraphrase", label: "🔄 Paraphrase", w: 200 },
  { key: "vocabRaw", label: "📚 Vocabulary  ( từ : nghĩa )", w: 220, vocab: true },
  { key: "link", label: "🔗 Link/Web", w: 80 },
];

function AutoArea({ value, onChange, onBlur, className, style }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  
  useEffect(() => { if (editing) resize(); }, [value, editing]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) {
        let selected = value.substring(start, end);
        let newVal, newStart, newEnd;

        if (selected.startsWith("==") && selected.endsWith("==")) {
          newVal = value.substring(0, start) + selected.substring(2, selected.length - 2) + value.substring(end);
          newStart = start;
          newEnd = end - 4;
        } else if (start >= 2 && value.substring(start - 2, start) === "==" && value.substring(end, end + 2) === "==") {
          newVal = value.substring(0, start - 2) + selected + value.substring(end + 2);
          newStart = start - 2;
          newEnd = end - 2;
        } else {
          newVal = value.substring(0, start) + "==" + selected + "==" + value.substring(end);
          newStart = start + 2;
          newEnd = end + 2;
        }
        
        onChange(newVal);
        setTimeout(() => {
          el.selectionStart = newStart;
          el.selectionEnd = newEnd;
        }, 10);
      }
    }
  };

  const formattedHtml = (value || "")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/\n/g, "<br/>")
     .replace(/==([^=]+)==/g, "<mark>$1</mark>");

  if (!editing) {
     return (
       <div 
         className={"cell-area " + (className || "")} 
         onClick={() => setEditing(true)}
         style={{ minHeight: '38px', cursor: 'text', ...style }}
         dangerouslySetInnerHTML={{ __html: formattedHtml || "&nbsp;" }}
       />
     )
  }

  return (
    <textarea
      ref={ref}
      autoFocus
      className={"cell-area " + (className || "")}
      style={style}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onInput={resize}
      onBlur={() => { setEditing(false); onBlur && onBlur(); }}
      rows={1}
      spellCheck={false}
    />
  );
}

function VisualParserModal({ onClose }) {
  const [text, setText] = useState("");
  const [chunks, setChunks] = useState([]);

  function analyze(val) {
    setText(val);
    if (!val) {
      setChunks([]);
      return;
    }
    const doc = nlp(val);
    const terms = doc.terms().json();
    
    const newChunks = [];
    let currentChunk = null;

    for (const termObj of terms) {
      const term = termObj.terms[0]; 
      let rawTag = term.tags[0] || "Other";
      
      let tag = "OTHER";
      if (term.tags.includes("Noun") || term.tags.includes("Pronoun")) tag = "NOUN";
      else if (term.tags.includes("Verb")) tag = "VERB";
      else if (term.tags.includes("Adjective")) tag = "ADJ";
      else if (term.tags.includes("Adverb")) tag = "ADV";
      else if (term.tags.includes("Determiner")) tag = "DET";
      else if (term.tags.includes("Preposition")) tag = "PREP";
      else if (term.tags.includes("Conjunction")) tag = "CONJ";
      
      const wordObj = { text: term.text, tag };
      const isCoreTag = ["NOUN", "VERB", "ADJ", "ADV"].includes(tag);

      if (!currentChunk) {
         currentChunk = { tag: isCoreTag ? tag : "SKIP", words: [wordObj] };
      } else {
         if (isCoreTag && currentChunk.tag === tag) {
            currentChunk.words.push(wordObj);
         } else {
            newChunks.push(currentChunk);
            currentChunk = { tag: isCoreTag ? tag : "SKIP", words: [wordObj] };
         }
      }
    }
    if (currentChunk) newChunks.push(currentChunk);
    setChunks(newChunks);
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.2rem' }}>🔍 Visual Parser (Phân tích cú pháp)</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
        </div>
        
        <p style={{ marginTop: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>Dán câu tiếng Anh vào đây, AI sẽ tự động khoanh vùng các cụm từ (Phrases) có cùng loại từ (POS) để bạn dễ học.</p>
        
        <textarea 
          className="cell-area"
          style={{ width: '100%', minHeight: '80px', padding: '12px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '24px' }}
          placeholder="Ví dụ: The Dow just had its biggest point drop in history."
          value={text}
          onChange={e => analyze(e.target.value)}
        />
        
        {chunks.length > 0 && (
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'flex-end', lineHeight: 1 }}>
              {chunks.map((chunk, i) => {
                const isGroup = chunk.words.length >= 1 && chunk.tag !== "SKIP";
                let color = "#333";
                if (chunk.tag === "NOUN") color = "#e74c3c";
                if (chunk.tag === "VERB") color = "#3498db";
                if (chunk.tag === "ADJ") color = "#9b59b6";
                if (chunk.tag === "ADV") color = "#e67e22";

                const borderStyle = isGroup ? `2px solid ${color}` : "2px solid transparent";
                const opacity = chunk.tag === "SKIP" ? 0.4 : 1;
                
                return (
                  <div key={i} style={{ border: borderStyle, borderRadius: '6px', padding: '6px 8px', display: 'flex', gap: '6px', opacity, alignItems: 'flex-end', background: isGroup ? color + '11' : 'transparent' }}>
                     {chunk.words.map((w, j) => (
                        <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                           <span style={{ fontSize: '16px', fontWeight: chunk.tag !== "SKIP" ? '600' : '400', color: chunk.tag !== "SKIP" ? '#111' : '#666' }}>{w.text}</span>
                           <span style={{ fontSize: '10px', color: chunk.tag !== "SKIP" ? color : '#999', fontWeight: 'bold', letterSpacing: '0.5px' }}>{w.tag}</span>
                        </div>
                     ))}
                  </div>
                )
              })}
            </div>
            
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #ddd', fontSize: '0.85rem', color: '#666' }}>
               <b>Chú giải:</b> <span style={{color: '#e74c3c', fontWeight: 'bold'}}>NOUN</span>, <span style={{color: '#3498db', fontWeight: 'bold'}}>VERB</span>, <span style={{color: '#9b59b6', fontWeight: 'bold'}}>ADJ</span>, <span style={{color: '#e67e22', fontWeight: 'bold'}}>ADV</span>. Mờ là mạo/giới từ.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Grid({ onChanged, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [showParser, setShowParser] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState("ALL");
  const dirty = useRef(new Set());
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const r = await fetch("/api/lessons");
    setRows(await r.json());
    setLoading(false);
  }

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const src = r.source?.trim() || "";
      const tit = r.title?.trim() || "";
      const lnk = r.link?.trim() || "";
      
      const key = (src || tit || lnk) ? `${src}||${tit}||${lnk}` : "UNCATEGORIZED";
      if (!map.has(key)) {
        map.set(key, { 
          key, 
          source: src, 
          title: tit, 
          link: lnk,
          count: 0,
          label: tit || src || "Chưa phân loại",
          fullLabel: `${src ? src + " - " : ""}${tit}`
        });
      }
      map.get(key).count++;
    });
    return Array.from(map.values()).sort((a, b) => a.fullLabel.localeCompare(b.fullLabel));
  }, [rows]);
  
  const activeGroup = groups.find(g => g.key === activeGroupKey);

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
  
  async function updateGroupInfo(field, value) {
     if (!activeGroup || activeGroupKey === "ALL") return;
     const oldKey = activeGroupKey;
     
     const toUpdate = rows.filter(r => {
        const src = r.source?.trim() || "";
        const tit = r.title?.trim() || "";
        const lnk = r.link?.trim() || "";
        const key = (src || tit || lnk) ? `${src}||${tit}||${lnk}` : "UNCATEGORIZED";
        return key === oldKey;
     });
     
     const updatedRows = toUpdate.map(r => ({ ...r, [field]: value }));
     
     setRows(rs => rs.map(r => {
        const match = updatedRows.find(u => u.id === r.id);
        return match ? match : r;
     }));
     
     let newSource = activeGroup.source;
     let newTitle = activeGroup.title;
     let newLink = activeGroup.link;
     if (field === "source") newSource = value;
     if (field === "title") newTitle = value;
     if (field === "link") newLink = value;
     
     const newKey = (newSource || newTitle || newLink) ? `${newSource}||${newTitle}||${newLink}` : "UNCATEGORIZED";
     setActiveGroupKey(newKey);
     
     setSyncing(true);
     await Promise.all(updatedRows.map(r => 
        fetch(`/api/lessons/${r.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        })
     ));
     setSyncing(false);
     onChanged && onChanged();
  }

  async function addRow() {
    let prefill = {};
    if (activeGroup && activeGroupKey !== "ALL") {
       prefill = { source: activeGroup.source, title: activeGroup.title, link: activeGroup.link };
    }
    const r = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefill),
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

  function groupRowsForSync(rawData) {
    const grouped = [];
    let current = null;

    for (const row of rawData) {
      const getVal = (keywords) => {
        const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
        return key ? (row[key] || "") : "";
      };

      const source = getVal(["nguồn", "nguon", "source", "cam"]);
      const title = getVal(["tên", "ten", "bài", "bai", "title", "passage"]);
      const link = getVal(["link", "url", "web"]);
      const myAnswer = getVal(["tôi chọn", "tôi nhập", "my answer"]);
      const correctAnswer = getVal(["đáp án", "correct", "đúng"]);
      const mistake = getVal(["mistake", "sai"]);
      const info = getVal(["thông tin", "thong tin", "info"]);
      const paraphrase = getVal(["paraphrase"]);
      const vocabRaw = getVal(["vocab", "từ", "tu"]);

      if ((title && (!current || title !== current.title)) || (link && (!current || link !== current.link && !title))) {
        current = { source, link, title, myAnswer, correctAnswer, mistake, info, paraphrase, vocabRaw };
        grouped.push(current);
      } else if (current) {
        if (myAnswer) current.myAnswer += (current.myAnswer ? "\n" : "") + myAnswer;
        if (correctAnswer) current.correctAnswer += (current.correctAnswer ? "\n" : "") + correctAnswer;
        if (mistake) current.mistake += (current.mistake ? "\n" : "") + mistake;
        if (info) current.info += (current.info ? "\n" : "") + info;
        if (paraphrase) current.paraphrase += (current.paraphrase ? "\n" : "") + paraphrase;
        if (vocabRaw) current.vocabRaw += (current.vocabRaw ? "\n" : "") + vocabRaw;
      } else {
        current = { source, link, title, myAnswer, correctAnswer, mistake, info, paraphrase, vocabRaw };
        grouped.push(current);
      }
    }
    return grouped;
  }

  async function handleBulkUpsert(groupedData) {
    setSyncing(true);
    try {
      const r = await fetch("/api/lessons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupedData),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Lỗi đồng bộ");
      }
      toast && toast("Đồng bộ thành công!");
      await loadData();
      onChanged && onChanged();
    } catch (err) {
      alert("Lỗi: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncFromSheet() {
    if (!sheetUrl) return alert("Vui lòng dán link Google Sheets");
    setSyncing(true);
    try {
      const r = await fetch("/api/lessons/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Lỗi tải Google Sheet");
      }
      const rawData = await r.json();
      const grouped = groupRowsForSync(rawData);
      await handleBulkUpsert(grouped);
      setSheetUrl("");
    } catch (err) {
      alert(err.message);
      setSyncing(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSyncing(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });
      
      const grouped = groupRowsForSync(rawData);
      await handleBulkUpsert(grouped);
    } catch (err) {
      alert("Lỗi đọc file: " + err.message);
      setSyncing(false);
    }
    e.target.value = ""; 
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map(r => {
        const rowData = {};
        COLS.forEach(c => rowData[c.label] = r[c.key] || "");
        return rowData;
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "IELTS Reading");
      XLSX.writeFile(wb, "Ielts-Reading-Review.xlsx");
    } catch (err) {
      alert("Lỗi xuất Excel: " + err.message);
    }
  }

  const displayCols = activeGroupKey === "ALL" 
    ? COLS 
    : COLS.filter(c => !["source", "title", "link"].includes(c.key));

  const filteredRows = rows.filter(r => {
    if (activeGroupKey !== "ALL") {
      const src = r.source?.trim() || "";
      const tit = r.title?.trim() || "";
      const lnk = r.link?.trim() || "";
      const key = (src || tit || lnk) ? `${src}||${tit}||${lnk}` : "UNCATEGORIZED";
      if (key !== activeGroupKey) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.title || "").toLowerCase().includes(q) || (r.source || "").toLowerCase().includes(q) || (r.link || "").toLowerCase().includes(q) || (r.mistake || "").toLowerCase().includes(q) || (r.vocabRaw || "").toLowerCase().includes(q);
  });

  return (
    <section>
      {showParser && <VisualParserModal onClose={() => setShowParser(false)} />}
      
      <div className="row-head">
        <div className="fill">
          <p className="eyebrow">Sửa đề &amp; ghi chú</p>
          <h2 className="section">Bài học</h2>
          <p className="sub">
            Nhìn được hết các cột cùng lúc. Ô <b>Mistake</b> ghi rõ câu nào sai, vì sao. 
            Ô <b>Vocabulary</b> (mỗi dòng <span className="mono">từ : nghĩa</span>) tự sinh thẻ ôn.
          </p>
          <button className="btn" style={{ marginTop: '12px', background: 'var(--accent)', color: 'white' }} onClick={() => setShowParser(true)}>
             🔍 Mở Visual Parser (Phân tích câu)
          </button>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="cell-area" 
              style={{ width: '250px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)' }}
              placeholder="Tìm kiếm bài học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn" onClick={addRow}>+ Thêm bài</button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              className="cell-area" 
              style={{ width: '200px', padding: '4px 8px', fontSize: '13px' }}
              placeholder="Dán link Google Sheet..."
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
            />
            <button className="btn" style={{ padding: '4px 8px', fontSize: '13px' }} onClick={syncFromSheet} disabled={syncing}>
              {syncing ? "Đang..." : "Đồng bộ"}
            </button>
            <span style={{ color: 'var(--text-light)' }}>|</span>
            <input type="file" ref={fileInputRef} hidden accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            <button className="btn ghost" style={{ padding: '4px 8px', fontSize: '13px' }} onClick={() => fileInputRef.current.click()} disabled={syncing}>
              ⬆ Nhập File
            </button>
            <button className="btn ghost" style={{ padding: '4px 8px', fontSize: '13px' }} onClick={exportExcel}>
              ⬇ Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty">Đang tải…</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <b>Chưa có bài nào.</b><br />
          Bấm “+ Thêm bài” hoặc “Đồng bộ” từ Google Sheets.
        </div>
      ) : (
        <div className="grid-layout" style={{ display: 'flex', gap: '20px', marginTop: '16px', alignItems: 'flex-start' }}>
          
          {/* SIDEBAR TABS */}
          <div className="grid-sidebar" style={{ width: '220px', flexShrink: 0, paddingRight: '12px', borderRight: '1px solid var(--border)' }}>
             <div 
               style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', marginBottom: '4px', background: activeGroupKey === "ALL" ? 'var(--plum)' : 'transparent', color: activeGroupKey === "ALL" ? '#fff' : '#333', fontWeight: activeGroupKey === "ALL" ? 'bold' : 'normal', transition: 'all 0.15s' }}
               onClick={() => setActiveGroupKey("ALL")}
             >
               Tất cả các bài ({rows.length})
             </div>
             
             <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#999', marginTop: '16px', marginBottom: '8px', fontWeight: 'bold' }}>Từng bài đọc</div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '600px', overflowY: 'auto' }}>
               {groups.map(g => (
                 <div 
                   key={g.key}
                   style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', background: activeGroupKey === g.key ? 'var(--plum)' : 'transparent', color: activeGroupKey === g.key ? '#fff' : '#333', fontSize: '14px', transition: 'all 0.15s' }}
                   onClick={() => setActiveGroupKey(g.key)}
                   title={g.fullLabel}
                 >
                   <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: activeGroupKey === g.key ? '600' : '400' }}>
                     {g.label}
                   </div>
                   {g.source && g.title && <div style={{ fontSize: '11px', color: activeGroupKey === g.key ? 'rgba(255,255,255,0.7)' : '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.source}</div>}
                 </div>
               ))}
             </div>
          </div>
          
          {/* MAIN GRID */}
          <div style={{ flex: 1, minWidth: 0 }}>
             
             {/* Group Header (if not ALL) */}
             {activeGroup && activeGroupKey !== "ALL" && (
               <div className="group-header" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>Nguồn</div>
                     <AutoArea className="cell-area" style={{ background: '#fff' }} value={activeGroup.source} onChange={v => updateGroupInfo("source", v)} />
                  </div>
                  <div style={{ flex: 2 }}>
                     <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>Tên bài đọc</div>
                     <AutoArea className="cell-area" style={{ background: '#fff', fontWeight: 'bold' }} value={activeGroup.title} onChange={v => updateGroupInfo("title", v)} />
                  </div>
                  <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>Link / Web</div>
                     <AutoArea className="cell-area" style={{ background: '#fff' }} value={activeGroup.link} onChange={v => updateGroupInfo("link", v)} />
                  </div>
               </div>
             )}

             <div className="grid-scroll">
               <table className="grid">
                 <thead>
                   <tr>
                     <th className="num-col">#</th>
                     {displayCols.map((c) => (
                       <th key={c.key} className={c.vocab ? "vocab-head" : ""} style={{ minWidth: c.w }}>
                         {c.vocab ? <span className="hl-text">{c.label}</span> : c.label}
                       </th>
                     ))}
                     <th style={{ width: 46 }}></th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredRows.length === 0 && (
                     <tr>
                       <td colSpan={displayCols.length + 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                         {search ? `Không tìm thấy kết quả khớp với "${search}"` : "Nhóm này chưa có dòng nào."}
                       </td>
                     </tr>
                   )}
                   {filteredRows.map((row, idx) => {
                     const vcount = parseVocab(row.vocabRaw).length;
                     return (
                       <tr key={row.id} className={savingId === row.id ? "saving" : ""}>
                         <td className="num-col">
                           <div className="row-n">{idx + 1}</div>
                           {vcount > 0 && <div className="row-vc">{vcount} từ</div>}
                         </td>
                         {displayCols.map((c) => (
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
                           <button className="del-x" title="Xoá dòng" onClick={() => delRow(row.id)}>×</button>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
             <p className="grid-hint" style={{marginTop: '12px'}}>
               {activeGroupKey !== "ALL" && <span>Sửa <b style={{color: '#111'}}>Nguồn / Tên bài</b> ở phía trên sẽ tự động áp dụng cho <b>TẤT CẢ {filteredRows.length} dòng</b> trong nhóm này. </span>}
               Ô tự lưu khi bấm ra chỗ khác.
             </p>
          </div>
        </div>
      )}
    </section>
  );
}
