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
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
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

  // --- IMPORT / EXPORT LOGIC ---
  function groupRows(rawData) {
    const grouped = [];
    let current = null;

    for (const row of rawData) {
      // Find matching keys flexibly
      const getVal = (keywords) => {
        const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
        return key ? (row[key] || "") : "";
      };

      const link = getVal(["link", "nguồn", "nguon"]);
      const title = getVal(["tên", "ten", "bài", "bai", "title"]);
      const mistake = getVal(["mistake", "sai"]);
      const info = getVal(["thông tin", "thong tin", "info"]);
      const paraphrase = getVal(["paraphrase"]);
      const vocabRaw = getVal(["vocab", "từ", "tu"]);

      // If title or link exists, it might be a new lesson, unless it's identical to current
      if ((title && (!current || title !== current.title)) || (link && (!current || link !== current.link && !title))) {
        current = { link, title, mistake, info, paraphrase, vocabRaw };
        grouped.push(current);
      } else if (current) {
        // Append to current
        if (mistake) current.mistake += (current.mistake ? "\n" : "") + mistake;
        if (info) current.info += (current.info ? "\n" : "") + info;
        if (paraphrase) current.paraphrase += (current.paraphrase ? "\n" : "") + paraphrase;
        if (vocabRaw) current.vocabRaw += (current.vocabRaw ? "\n" : "") + vocabRaw;
      } else {
        // No current, just create one
        current = { link, title, mistake, info, paraphrase, vocabRaw };
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
      const grouped = groupRows(rawData);
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
      
      const grouped = groupRows(rawData);
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

  // --- FILTER ---
  const filteredRows = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.title || "").toLowerCase().includes(q) || (r.link || "").toLowerCase().includes(q);
  });

  return (
    <section>
      <div className="row-head">
        <div className="fill">
          <p className="eyebrow">Sửa đề &amp; ghi chú</p>
          <h2 className="section">Bài học</h2>
          <p className="sub">
            Nhìn được hết các cột cùng lúc như bảng tính. Ô <b>Mistake</b> ghi rõ câu nào sai,
            sai gì, vì sao. Ô <b>Vocabulary</b> (mỗi dòng <span className="mono">từ : nghĩa</span>) tự sinh thẻ ôn.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="cell-area" 
              style={{ width: '250px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)' }}
              placeholder="Tìm kiếm bài học (vd: Cam 11)..."
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
              {syncing ? "Đang xử lý..." : "Đồng bộ"}
            </button>
            <span style={{ color: 'var(--text-light)' }}>|</span>
            <input type="file" ref={fileInputRef} hidden accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            <button className="btn" style={{ padding: '4px 8px', fontSize: '13px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => fileInputRef.current.click()} disabled={syncing}>
              ⬆ Nhập File
            </button>
            <button className="btn" style={{ padding: '4px 8px', fontSize: '13px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={exportExcel}>
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
                {filteredRows.length === 0 && search && (
                  <tr>
                    <td colSpan={COLS.length + 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                      Không tìm thấy bài học nào khớp với "{search}"
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
