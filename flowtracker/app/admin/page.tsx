"use client";
import Navbar from "@/components/Navbar";
import SectorsApiPanel from "@/components/SectorsApiPanel";
import TampermonkeyPanel from "@/components/TampermonkeyPanel";
import { API_BASE } from "@/lib/apiConfig";
import { useState, useEffect } from "react";

type BrokerInfo = { broker_code: string; stocks: number; days: number; last_date: string };
type DateInfo = { date: string; records: number };

const SAMPLE_CSV = `stockcode,buyval,buylot,sellval,selllot
BBCA,15200000000,2533333,8300000000,1383333
BBRI,28500000000,9284000,12100000000,3941000`;

export default function AdminDataHub() {
  const [tab, setTab] = useState<"upload"|"sectors"|"tampermonkey">("upload");
  const [mode, setMode] = useState<"csv"|"json"|"paste">("paste");
  const [brokerCode, setBrokerCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [textData, setTextData] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/brokers`).then(r => r.json()).then(d => setBrokers(d.data || [])).catch(() => {});
    fetch(`${API_BASE}/api/available-dates`).then(r => r.json()).then(d => setDates(d.data || [])).catch(() => {});
    fetch(`${API_BASE}/api/health`).then(r => r.json()).then(d => setHealth(d)).catch(() => setHealth({ status: "offline" }));
  }, []);

  const handleUpload = async () => {
    if (!brokerCode || brokerCode.length < 2) { setResult({ error: "Broker code harus 2 huruf" }); return; }
    if (!textData.trim()) { setResult({ error: "Data tidak boleh kosong" }); return; }
    setLoading(true); setResult(null);
    try {
      let endpoint: string, body: any;
      if (mode === "json") {
        endpoint = `${API_BASE}/api/broker-summary/upload`;
        body = { ...JSON.parse(textData), brokerCode: brokerCode.toUpperCase(), date };
      } else {
        const lines = textData.trim().split("\n");
        const sep = lines[0].includes("\t") ? "\t" : ",";
        const csv = lines.map(l => l.split(sep).map(c => c.trim()).join(",")).join("\n");
        endpoint = `${API_BASE}/api/broker-summary/upload-csv`;
        body = { brokerCode: brokerCode.toUpperCase(), date, csv };
      }
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setResult(json);
      fetch(`${API_BASE}/api/brokers`).then(r => r.json()).then(d => setBrokers(d.data || [])).catch(() => {});
    } catch (err: any) { setResult({ error: err.message }); }
    setLoading(false);
  };

  const tabs = [
    { id: "upload" as const, label: "📋 MANUAL UPLOAD", icon: "📋" },
    { id: "sectors" as const, label: "🌐 SECTORS API", icon: "🌐" },
    { id: "tampermonkey" as const, label: "🐒 TAMPERMONKEY", icon: "🐒" },
  ];

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 32, background: "#d29922", borderRadius: 2 }} />
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", margin: 0,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.04em" }}>
              ADMIN · DATA HUB
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 800, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "var(--accent-cyan)" }}>Dua opsi</strong> untuk mendapatkan data broker real-time:
            upload manual dari RTI/Stockbit, atau pull otomatis via Sectors.app API.
          </p>
        </div>

        {/* API Status Bar */}
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%",
              background: health?.status === "ok" ? "var(--accent-green)" : "var(--accent-red)",
              display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              VPS: <strong style={{ color: health?.status === "ok" ? "var(--accent-green)" : "var(--accent-red)" }}>
                {health?.status === "ok" ? "ONLINE" : "OFFLINE"}
              </strong>
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            📊 {health?.total_brokers || 0} brokers registered
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            🔑 Sectors: <strong style={{ color: health?.sectors_api === "configured" ? "var(--accent-green)" : "var(--accent-orange)" }}>
              {health?.sectors_api === "configured" ? "ACTIVE" : "NOT SET"}
            </strong>
          </span>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-secondary)",
          padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 800, fontSize: 12,
                background: tab === t.id ? "linear-gradient(135deg, #2f81f7, #39d2f5)" : "transparent",
                color: tab === t.id ? "#fff" : "var(--text-muted)",
                border: "none", cursor: "pointer", letterSpacing: "0.04em",
                transition: "all 0.2s" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }} className="admin-grid">
          {/* Left: Active Tab Content */}
          <div>
            {tab === "upload" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>MANUAL UPLOAD</h3>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>BROKER CODE *</label>
                    <input className="ft-input" value={brokerCode}
                      onChange={e => setBrokerCode(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="MG"
                      style={{ width: 100, fontSize: 18, fontWeight: 800, textAlign: "center",
                        letterSpacing: "0.2em", fontFamily: "'Space Grotesk', sans-serif" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>DATE</label>
                    <input className="ft-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>FORMAT</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["paste", "csv", "json"] as const).map(m => (
                        <button key={m} onClick={() => setMode(m)}
                          style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: mode === m ? "var(--accent-blue)" : "transparent",
                            color: mode === m ? "#fff" : "var(--text-muted)",
                            border: `1px solid ${mode === m ? "var(--accent-blue)" : "var(--border)"}`,
                            cursor: "pointer", textTransform: "uppercase" }}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <textarea className="ft-input" value={textData} onChange={e => setTextData(e.target.value)}
                  placeholder={SAMPLE_CSV}
                  style={{ width: "100%", minHeight: 250, fontFamily: "'Space Grotesk', monospace",
                    fontSize: 12, lineHeight: 1.6, resize: "vertical", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={handleUpload} disabled={loading}
                    style={{ padding: "10px 28px", borderRadius: 8, fontWeight: 800, fontSize: 13,
                      background: loading ? "var(--border)" : "linear-gradient(135deg, #2f81f7, #39d2f5)",
                      color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: loading ? "none" : "0 4px 16px rgba(47,129,247,0.3)" }}>
                    {loading ? "⏳ UPLOADING..." : "🚀 UPLOAD DATA"}
                  </button>
                  <button onClick={() => setTextData(SAMPLE_CSV)}
                    style={{ padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                    📝 Sample
                  </button>
                  <button onClick={() => { setTextData(""); setResult(null); }}
                    style={{ padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                    🗑️ Clear
                  </button>
                </div>
                {result && (
                  <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 8,
                    background: result.error ? "rgba(248,81,73,0.08)" : "rgba(63,185,80,0.08)",
                    border: `1px solid ${result.error ? "rgba(248,81,73,0.3)" : "rgba(63,185,80,0.3)"}` }}>
                    {result.error ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)", fontWeight: 700 }}>❌ {result.error}</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--accent-green)", fontWeight: 700 }}>
                        ✅ Uploaded! {result.brokerCode} — {result.parsed || result.uploaded || 0} records saved
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === "sectors" && <SectorsApiPanel />}
            {tab === "tampermonkey" && <TampermonkeyPanel />}
          </div>

          {/* Right: Stats */}
          <div>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", margin: "0 0 14px" }}>
                📊 BROKERS WITH DATA
              </h3>
              {brokers.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet. Upload or pull data first.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {brokers.map(b => (
                    <div key={b.broker_code} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "8px 12px", borderRadius: 8,
                      background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--accent-blue)",
                          fontFamily: "'Space Grotesk', sans-serif" }}>{b.broker_code}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                          {b.stocks} stocks · {b.days}d
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{b.last_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", margin: "0 0 14px" }}>📅 DATA DATES</h3>
              {dates.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dates.slice(0, 10).map(d => (
                    <div key={d.date} style={{ display: "flex", justifyContent: "space-between",
                      fontSize: 12, padding: "6px 12px", borderRadius: 6,
                      background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{d.date}</span>
                      <span style={{ color: "var(--accent-cyan)" }}>{d.records} records</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <style>{`@media (max-width: 900px) { .admin-grid { grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}
