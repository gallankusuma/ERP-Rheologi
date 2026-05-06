"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "DASHBOARD",          href: "/" },
  { label: "FLOW ANALYZER",      href: "/flow-analyzer" },
  { label: "ACCUMULATION STREAK",href: "/accumulation-streak" },
  { label: "INSIDER MOVES",      href: "/insider-moves" },
  { label: "BROKER ACTIVITY",    href: "/broker-activity" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{
      background: "var(--bg-secondary)",
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg, #2f81f7, #39d2f5)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 16px rgba(47,129,247,0.4)"
            }}>F</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.08em", fontFamily: "'Space Grotesk', sans-serif" }}>FLOWTRACKER</div>
              <div style={{ fontSize: 9, color: "var(--accent-cyan)", letterSpacing: "0.15em", fontWeight: 600, marginTop: -2 }}>UNCOVER THE HIDDEN MOVES</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav style={{ display: "flex", gap: 28, alignItems: "center" }} className="hidden-mobile">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-tab ${isActive ? "active" : ""}`}
                  style={{ textDecoration: "none", display: "block" }}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="badge-live">
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }}></span>
              LIVE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12, color: "var(--text-secondary)"
            }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%",
                background: "linear-gradient(135deg,#2f81f7,#39d2f5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff" }}>G</span>
              <span>gallankusuma41</span>
              <span style={{ fontSize: 10 }}>▾</span>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="mobile-nav" style={{ display: "none" }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className={`nav-tab ${pathname === item.href ? "active" : ""}`}
              style={{ textDecoration: "none", display: "block", padding: "12px 0" }}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .mobile-nav { display: flex !important; flex-direction: column; border-top: 1px solid var(--border); padding: 0 24px; }
        }
      `}</style>
    </header>
  );
}
