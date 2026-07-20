"use client";
import { useCallback, useEffect, useState } from "react";
import Grid from "@/components/Grid.jsx";
import Review from "@/components/Review.jsx";
import CardsTable from "@/components/CardsTable.jsx";

export default function Page() {
  const [tab, setTab] = useState("grid");
  const [due, setDue] = useState(0);
  const [toastMsg, setToastMsg] = useState("");

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

  const onChanged = useCallback(() => {
    refreshDue();
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
        {tab === "grid" && <Grid onChanged={onChanged} toast={toast} />}
        {tab === "today" && <Review onChanged={onChanged} toast={toast} />}
        {tab === "cards" && <CardsTable onChanged={onChanged} toast={toast} />}
      </main>

      <div className={"toast " + (toastMsg ? "show" : "")}>{toastMsg}</div>
    </>
  );
}
