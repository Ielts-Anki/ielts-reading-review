"use client";
import { useCallback, useEffect, useState } from "react";
import Grid from "@/components/Grid.jsx";
import Review from "@/components/Review.jsx";
import CardsTable from "@/components/CardsTable.jsx";

export default function Page() {
  const [tab, setTab] = useState("grid");
  const [due, setDue] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [remountKey, setRemountKey] = useState(0);

  const refreshDue = useCallback(async () => {
    try {
      const r = await fetch("/api/review");
      const d = await r.json();
      setDue(Array.isArray(d) ? d.length : 0);
    } catch {}
  }, []);

  useEffect(() => { refreshDue(); }, [refreshDue]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 1900);
  }, []);

  // Khi dữ liệu đổi ở một tab, làm mới tab khác lần sau mở.
  const onChanged = useCallback(() => {
    refreshDue();
    setRemountKey((k) => k + 1);
  }, [refreshDue]);

  const TABS = [
    ["grid", "Bài học"],
    ["today", "Hôm nay"],
    ["cards", "Từ vựng"],
  ];

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <h1>Sổ ôn IELTS Reading</h1>
            <span className="mark">spaced</span>
          </div>
          <nav className="tabs">
            {TABS.map(([id, lab]) => (
              <button
                key={id}
                className={tab === id ? "on" : ""}
                onClick={() => setTab(id)}
              >
                {lab}
                {id === "today" && due > 0 && <span className="badge">{due}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {tab === "grid" && <Grid key={"g" + remountKey} onChanged={onChanged} toast={toast} />}
        {tab === "today" && <Review key={"r" + remountKey} onChanged={onChanged} toast={toast} />}
        {tab === "cards" && <CardsTable key={"c" + remountKey} onChanged={onChanged} toast={toast} />}
      </main>

      <div className={"toast " + (toastMsg ? "show" : "")}>{toastMsg}</div>
    </>
  );
}
