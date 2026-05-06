"use client";
import Navbar from "@/components/Navbar";
import { brokerProfiles } from "@/lib/mockData";
import { API_BASE } from "@/lib/apiConfig";
import { useState, useEffect } from "react";

type BrokerRow = {
  ticker: string;
  action: "BUY" | "SELL" | "NEUTRAL";
  buyVal: string;
  buyLot: string;
  buyAvg: number;
  sellVal: string;
  sellLot: string;
  sellAvg: number;
  netVal: string;
  rawBuyVal: number;
  rawSellVal: number;
  rawNetVal: number;
};

type ApiResponse = {
  broker: string;
  date: string;
  source: string;
  count: number;
  buyCount: number;
  sellCount: number;
  data: BrokerRow[];
  error?: string;
};

// Full Indonesia Broker Directory — organized by category
const BROKER_LIST = [
  // === Top 10 by volume ===
  { code: "MG", name: "Mirae Asset Sekuritas (Semesta Indovest)" },
  { code: "CC", name: "Mandiri Sekuritas" },
  { code: "YP", name: "Indo Premier Sekuritas" },
  { code: "AK", name: "UBS Sekuritas Indonesia" },
  { code: "ZP", name: "Kim Eng Sekuritas (Maybank)" },
  { code: "PD", name: "CGS-CIMB Sekuritas" },
  { code: "DH", name: "CLSA Sekuritas Indonesia" },
  { code: "DB", name: "Deutsche Sekuritas" },
  { code: "RX", name: "Macquarie Sekuritas Indonesia" },
  { code: "AF", name: "BCA Sekuritas" },
  // === Major Institutional ===
  { code: "AZ", name: "Danareksa Sekuritas" },
  { code: "KZ", name: "Bahana Sekuritas" },
  { code: "NI", name: "Shinhan Sekuritas Indonesia" },
  { code: "KI", name: "Nomura Sekuritas Indonesia" },
  { code: "TP", name: "Trimegah Sekuritas" },
  { code: "EP", name: "RHB Sekuritas Indonesia" },
  { code: "GR", name: "Ciptadana Sekuritas Asia" },
  { code: "MS", name: "Morgan Stanley Sekuritas" },
  { code: "CP", name: "JP Morgan Sekuritas Indonesia" },
  { code: "CS", name: "Credit Suisse Sekuritas" },
  { code: "BK", name: "BNI Sekuritas" },
  { code: "LP", name: "Panin Sekuritas" },
  { code: "YJ", name: "NH Korindo Sekuritas" },
  { code: "FG", name: "Phillip Sekuritas Indonesia" },
  { code: "OD", name: "OCBC Sekuritas Indonesia" },
  { code: "BS", name: "Sinarmas Sekuritas" },
  // === Local/Retail Popular ===
  { code: "AI", name: "Ajaib Sekuritas Asia" },
  { code: "SQ", name: "Stockbit Sekuritas" },
  { code: "XC", name: "BNI Sekuritas (Sub)" },
  { code: "XL", name: "Macquarie Sekuritas (Sub)" },
  { code: "KK", name: "Mandiri Sekuritas (Online)" },
  { code: "IF", name: "Phintraco Sekuritas" },
  { code: "BZ", name: "KGI Sekuritas Indonesia" },
  { code: "DR", name: "Samuel Sekuritas" },
  { code: "IS", name: "Indo Capital Sekuritas" },
  { code: "EL", name: "Surya Fajar Sekuritas" },
  { code: "RI", name: "BRI Danareksa Sekuritas" },
  { code: "SK", name: "Sinarmas Sekuritas (Online)" },
  // === Foreign Firms ===
  { code: "CG", name: "HSBC Sekuritas Indonesia" },
  { code: "BW", name: "Citigroup Sekuritas Indonesia" },
  { code: "GL", name: "Goldman Sachs Sekuritas" },
  { code: "LG", name: "CIMB-GK Sekuritas" },
  { code: "DP", name: "DBS Vickers Sekuritas" },
  { code: "MU", name: "Samsung Sekuritas Indonesia" },
  { code: "IP", name: "Victoria Sekuritas Indonesia" },
  { code: "PC", name: "Jasa Utama Capital" },
  { code: "PF", name: "Waterfront Sekuritas" },
  { code: "PS", name: "Kresna Sekuritas" },
];

const QUICK_BROKERS = ["MG", "CC", "YP", "AK", "ZP", "PD", "DH", "AF", "AI", "SQ"];

export default function BrokerActivity() {
  const [brokerCode, setBrokerCode] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [data, setData] = useState<BrokerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiMeta, setApiMeta] = useState<{ source: string; date: string; error?: string } | null>(null);
  const [searchEntity, setSearchEntity] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "matrix">("table");
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  const handleSearch = async (code?: string) => {
    const c = (code || brokerCode).toUpperCase().trim();
    if (c.length < 2) return;

    setSearched(c);
    setLoading(true);
    setData(null);
    setApiMeta(null);

    try {
      const res = await fetch(`${API_BASE}/api/broker-summary?code=${c}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setApiMeta({ source: json.source, date: json.date, error: json.error });
    } catch (err) {
      console.error("API error:", err);
      setApiMeta({ source: "error", date: "", error: "Network error fetching data" });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const brokerInfo = searched
    ? BROKER_LIST.find(b => b.code === searched) || { code: searched, name: searched }
    : null;

  const filteredData = data?.filter(row => {
    const matchFilter = filter === "ALL" || row.action === filter;
    const matchSearch = !searchEntity ||
      row.ticker.toLowerCase().includes(searchEntity.toLowerCase());
    return matchFilter && matchSearch;
  }) || [];

  const totalBuyVal = data?.reduce((a, r) => a + (r.rawBuyVal || 0), 0) || 0;
  const totalSellVal = data?.reduce((a, r) => a + (r.rawSellVal || 0), 0) || 0;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 32, background: "var(--accent-orange)", borderRadius: 2 }}></div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", margin: 0,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.04em" }}>
              BROKER ACTIVITY
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 700, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "var(--accent-cyan)" }}>&quot;Broker Stalker — Ikuti Kemana Uang Mengalir.&quot;</strong>{" "}
            Masukkan kode broker untuk melihat saham-saham yang sedang ditransaksikan. Data diambil dari IDX (idx.co.id).
          </p>
        </div>

        {/* Broker directory table */}
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Search input */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em",
                  display: "block", marginBottom: 4 }}>BROKER CODE</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="ft-input" placeholder="e.g. MG, AK..."
                    value={brokerCode}
                    onChange={e => setBrokerCode(e.target.value.toUpperCase().slice(0, 2))}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    style={{ width: 100, fontSize: 16, fontWeight: 800, textAlign: "center",
                      letterSpacing: "0.2em", fontFamily: "'Space Grotesk', sans-serif" }} />
                  <button onClick={() => handleSearch()} disabled={loading}
                    style={{ padding: "8px 20px", borderRadius: 8, fontWeight: 800, fontSize: 12,
                      background: loading ? "var(--border)" : "linear-gradient(135deg, #2f81f7, #39d2f5)",
                      color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer",
                      letterSpacing: "0.06em",
                      boxShadow: loading ? "none" : "0 4px 16px rgba(47,129,247,0.3)" }}>
                    {loading ? "⏳ LOADING..." : "🔍 RUN STALKER"}
                  </button>
                </div>
              </div>
            </div>

            {/* Search entity */}
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em",
                display: "block", marginBottom: 4 }}>SEARCH ENTITY...</label>
              <input className="ft-input" placeholder="Filter ticker..." value={searchEntity}
                onChange={e => setSearchEntity(e.target.value.toUpperCase())}
                style={{ width: 180 }} />
            </div>
          </div>

          {/* Broker directory */}
          <div style={{ overflowY: "auto", maxHeight: 420, borderRadius: 8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>BROKER CODE</th>
                  <th>ENTITY NAME</th>
                  <th style={{ textAlign: "center" }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {BROKER_LIST.filter(b =>
                  !searchEntity || b.code.includes(searchEntity) || b.name.toUpperCase().includes(searchEntity)
                ).map(b => (
                  <tr key={b.code}>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "var(--accent-blue)",
                        fontFamily: "'Space Grotesk', sans-serif" }}>{b.code}</span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600,
                      letterSpacing: "0.04em", textTransform: "uppercase" }}>{b.name}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => { setBrokerCode(b.code); handleSearch(b.code); }}
                        disabled={loading}
                        style={{ padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                          background: searched === b.code ? "var(--accent-blue)" : "var(--bg-secondary)",
                          color: searched === b.code ? "#fff" : "var(--text-primary)",
                          border: `1px solid ${searched === b.code ? "var(--accent-blue)" : "var(--border)"}`,
                          cursor: "pointer", letterSpacing: "0.06em" }}>
                        RUN STALKER
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Result section */}
        {searched && (
          <div style={{ animation: "slide-up 0.3s ease" }}>

            {/* Broker summary header */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12,
                    background: "linear-gradient(135deg, #2f81f7, #39d2f5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 900, color: "#fff",
                    fontFamily: "'Space Grotesk', sans-serif",
                    boxShadow: "0 0 24px rgba(47,129,247,0.3)" }}>
                    {searched}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)",
                      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.04em" }}>
                      {searched} TRANSACTION MATRIX
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {brokerInfo?.name} · {apiMeta?.source || "Loading..."} · {apiMeta?.date || "—"}
                    </p>
                  </div>
                </div>

                {/* Stat cards */}
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="card" style={{ padding: "10px 16px", textAlign: "center", minWidth: 100 }}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>TOTAL ACTIVE</p>
                    <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: "var(--text-primary)",
                      fontFamily: "'Space Grotesk'" }}>{data?.length || 0}</p>
                  </div>
                  <div className="card" style={{ padding: "10px 16px", textAlign: "center", minWidth: 100 }}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>NET BUY</p>
                    <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: "var(--accent-green)",
                      fontFamily: "'Space Grotesk'" }}>{data?.filter(d => d.action === "BUY").length || 0}</p>
                  </div>
                  <div className="card" style={{ padding: "10px 16px", textAlign: "center", minWidth: 100 }}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>NET SELL</p>
                    <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: "var(--accent-red)",
                      fontFamily: "'Space Grotesk'" }}>{data?.filter(d => d.action === "SELL").length || 0}</p>
                  </div>
                </div>
              </div>

              {/* API error notice */}
              {apiMeta?.error && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8,
                  background: "rgba(210,153,34,0.08)", border: "1px solid rgba(210,153,34,0.3)" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--accent-yellow)" }}>
                    ⚠️ {apiMeta.error} — Showing cached/mock data. IDX API may be limited outside Indonesian network.
                  </p>
                </div>
              )}

              {/* Filter pills */}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {(["ALL", "BUY", "SELL"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`pill-btn ${filter === f ? "active" : ""}`}
                    style={{ background: filter === f
                      ? f === "BUY" ? "var(--accent-green)"
                      : f === "SELL" ? "var(--accent-red)"
                      : "var(--accent-blue)"
                      : undefined,
                      borderColor: filter === f
                      ? f === "BUY" ? "var(--accent-green)"
                      : f === "SELL" ? "var(--accent-red)"
                      : "var(--accent-blue)"
                      : undefined,
                    }}>
                    {f === "ALL" ? "📊 FULL DATA" : f === "BUY" ? "🟢 ONLY BUY" : "🔴 ONLY SELL"}
                  </button>
                ))}
                <input className="ft-input" placeholder="Filter ticker..."
                  value={searchEntity} onChange={e => setSearchEntity(e.target.value.toUpperCase())}
                  style={{ marginLeft: "auto", width: 180, fontSize: 12 }} />
              </div>
            </div>

            {/* Transaction table */}
            <div className="card" style={{ overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: 64, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    Fetching broker data from IDX...
                  </p>
                  <div style={{ width: 200, height: 4, borderRadius: 2, background: "var(--border)",
                    margin: "16px auto", overflow: "hidden" }}>
                    <div style={{ width: "60%", height: "100%", borderRadius: 2,
                      background: "linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))",
                      animation: "shimmer 1.5s infinite" }}></div>
                  </div>
                </div>
              ) : filteredData.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>EMITEN</th>
                        <th style={{ textAlign: "center" }}>NET</th>
                        <th style={{ textAlign: "right" }}>BUY VAL</th>
                        <th style={{ textAlign: "right" }}>BUY LOT</th>
                        <th style={{ textAlign: "right" }}>AVG</th>
                        <th style={{ borderLeft: "1px solid var(--border)", textAlign: "right" }}>SELL VAL</th>
                        <th style={{ textAlign: "right" }}>SELL LOT</th>
                        <th style={{ textAlign: "right" }}>AVG</th>
                        <th style={{ borderLeft: "1px solid var(--border)", textAlign: "right" }}>NET VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, i) => (
                        <tr key={row.ticker} style={{ animation: `slide-up ${Math.min(0.05 * i + 0.05, 0.5)}s ease both` }}>
                          <td>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)",
                              fontFamily: "'Space Grotesk', sans-serif" }}>{row.ticker}</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4,
                              background: row.action === "BUY" ? "rgba(63,185,80,0.15)"
                                : row.action === "SELL" ? "rgba(248,81,73,0.15)"
                                : "rgba(139,148,158,0.12)",
                              color: row.action === "BUY" ? "var(--accent-green)"
                                : row.action === "SELL" ? "var(--accent-red)"
                                : "var(--text-muted)",
                              letterSpacing: "0.06em" }}>
                              {row.action === "BUY" ? "▲" : row.action === "SELL" ? "▼" : "—"} {row.action}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>{row.buyVal}</td>
                          <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>{row.buyLot}</td>
                          <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600 }}>
                            {row.buyAvg > 0 ? row.buyAvg.toLocaleString("id-ID") : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontSize: 12, color: "var(--accent-red)", fontWeight: 600,
                            borderLeft: "1px solid var(--border)" }}>{row.sellVal}</td>
                          <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>{row.sellLot}</td>
                          <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600 }}>
                            {row.sellAvg > 0 ? row.sellAvg.toLocaleString("id-ID") : "—"}
                          </td>
                          <td style={{ textAlign: "right", borderLeft: "1px solid var(--border)" }}>
                            <span style={{ fontWeight: 800, fontSize: 12,
                              color: row.rawNetVal > 0 ? "var(--accent-green)"
                                : row.rawNetVal < 0 ? "var(--accent-red)"
                                : "var(--text-muted)" }}>
                              {row.rawNetVal > 0 ? "+" : ""}{row.netVal}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : data && data.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    Tidak ada data transaksi untuk broker <strong style={{ color: "var(--accent-blue)" }}>{searched}</strong> hari ini.
                  </p>
                  {apiMeta?.error && (
                    <p style={{ fontSize: 12, color: "var(--accent-yellow)", marginTop: 8 }}>
                      IDX API mungkin memerlukan koneksi dari Indonesia atau VPN.
                    </p>
                  )}
                </div>
              ) : null}

              {/* Footer */}
              {data && data.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px",
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Showing {filteredData.length} of {data.length} tickers
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      Source: <strong style={{ color: "var(--accent-cyan)" }}>{apiMeta?.source}</strong>
                    </span>
                  </div>
                  <div className="card" style={{ padding: "4px 14px", fontSize: 11, fontWeight: 700,
                    color: "var(--accent-blue)", letterSpacing: "0.06em" }}>
                    MATRIX SIZE: {data.length} ACTIVE TICKERS
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!searched && (
          <div className="card" style={{ padding: 64, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Masukkan kode broker untuk mulai stalking
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Pilih dari daftar di atas atau ketik kode 2 huruf
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {QUICK_BROKERS.map(b => (
                <button key={b} onClick={() => { setBrokerCode(b); handleSearch(b); }}
                  className="pill-btn"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
