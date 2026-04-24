import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";

const API           = process.env.REACT_APP_API_URL || "";
const WS_URL        = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/game`;
const GH_REPO       = "MishaPetrovskui/SFML_MainPlatformer";
const GH_BRANCH     = "pixelrun%2Bserver";
const GH_API        = `https://api.github.com/repos/${GH_REPO}/commits?sha=${GH_BRANCH}&per_page=20`;
const POLL_INTERVAL = 5000;
const LEVELS        = [1, 2, 3];

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

/* ── Auth Provider ─────────────────────────────────────────────────────────── */
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const t = localStorage.getItem("pr_token");
      const u = localStorage.getItem("pr_user");
      if (t && u) return { ...JSON.parse(u), token: t };
    } catch {}
    return null;
  });

  const login = (data, token) => {
    localStorage.setItem("pr_token", token);
    localStorage.setItem("pr_user", JSON.stringify(data));
    setUser({ ...data, token });
  };

  const logout = useCallback((wsRef) => {
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: "logout", src: "web" })); } catch {}
      setTimeout(() => { try { wsRef.current?.close(); } catch {} }, 120);
    }
    localStorage.removeItem("pr_token");
    localStorage.removeItem("pr_user");
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...data };
      localStorage.setItem("pr_user", JSON.stringify({ ...next, token: undefined }));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user?.token) return;
    const sync = async () => {
      try {
        const res  = await fetch(`${API}/api/player/me`,
          { headers: { Authorization: `Bearer ${user.token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setUser(prev => {
          if (!prev) return prev;
          if (prev.coins === data.coins && prev.username === data.username) return prev;
          const next = { ...prev, coins: data.coins, username: data.username, email: data.email };
          localStorage.setItem("pr_user", JSON.stringify({ ...next, token: undefined }));
          return next;
        });
      } catch {}
    };
    sync();
    const id = setInterval(sync, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user?.token]);

  return (
    <AuthCtx.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const fmt = (sec) => {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, "0");
  return m > 0 ? `${m}:${s}` : `${s}s`;
};
const ago = (iso) => {
  const now = Date.now();
  const d = Math.floor((now - new Date(iso)) / 86400000);
  const h = Math.floor((now - new Date(iso)) / 3600000);
  const m = Math.floor((now - new Date(iso)) / 60000);
  if (m < 2)  return "just now";
  if (h < 1)  return `${m}m ago`;
  if (d < 1)  return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};
const commitType = (msg = "") => {
  const m = msg.match(/^(feat|fix|refactor|docs|chore|style|test|perf)(\(.+?\))?:/i);
  return m ? m[1].toLowerCase() : "other";
};
const typeColor = {
  feat: "#7fff6a", fix: "#60aaff", refactor: "#c084fc",
  docs: "#fbbf24", chore: "#9ca3af", style: "#f472b6",
  test: "#34d399", perf: "#fb923c", other: "#7a7a90",
};

/* ── UI Primitives ─────────────────────────────────────────────────────────── */
const inp = {
  width: "100%", background: "var(--bg2)", border: "1px solid var(--border)",
  color: "var(--text)", padding: "11px 14px", borderRadius: 6,
  fontFamily: "var(--mono)", fontSize: 14, outline: "none",
  transition: "border-color 0.2s", boxSizing: "border-box",
};

function Field({ label, ...p }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", display: "block", marginBottom: 4 }}>{label}</label>}
      <input {...p} style={{ ...inp, borderColor: f ? "rgba(127,255,106,0.5)" : "var(--border)", ...(p.style || {}) }}
        onFocus={() => setF(true)} onBlur={() => setF(false)} />
    </div>
  );
}
function Btn({ children, v = "primary", loading: l, style: s = {}, ...p }) {
  const vs = {
    primary: { background: "var(--accent)", color: "#0a1a07", border: "none" },
    outline: { background: "transparent", color: "var(--text)", border: "1px solid var(--border)" },
    ghost:   { background: "transparent", color: "var(--muted)", border: "none" },
    danger:  { background: "rgba(255,92,92,0.1)", color: "var(--danger)", border: "1px solid rgba(255,92,92,0.3)" },
    accent2: { background: "rgba(255,205,60,0.12)", color: "var(--accent2)", border: "1px solid rgba(255,205,60,0.3)" },
  };
  return (
    <button {...p} disabled={l || p.disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "10px 22px", borderRadius: 6, fontFamily: "var(--sans)",
      fontSize: 14, fontWeight: 700, cursor: l || p.disabled ? "not-allowed" : "pointer",
      opacity: l || p.disabled ? 0.6 : 1, transition: "opacity .2s, transform .15s",
      ...vs[v], ...s,
    }}
      onMouseEnter={e => { if (!l && !p.disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      {l ? <span style={{ animation: "pulse 1s infinite" }}>…</span> : children}
    </button>
  );
}
function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ padding: "0.85rem 1.1rem", background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.2)", borderRadius: 6, fontSize: 13, color: "var(--danger)", fontFamily: "var(--mono)", marginTop: 10 }}>{msg}</div>;
}
function OkBox({ msg }) {
  if (!msg) return null;
  return <div style={{ padding: "0.85rem 1.1rem", background: "rgba(127,255,106,0.07)", border: "1px solid rgba(127,255,106,0.25)", borderRadius: 6, fontSize: 13, color: "var(--accent)", fontFamily: "var(--mono)", marginTop: 10 }}>✓ {msg}</div>;
}
function Loader({ text = "Loading" }) {
  return <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 14 }}>
    <span style={{ animation: "pulse 1.2s ease infinite" }}>{text}…</span>
  </div>;
}
function Tag({ label, color = "var(--accent)" }) {
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", color, border: `1px solid ${color}50`, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase", background: `${color}10` }}>{label}</span>;
}
function RankBadge({ rank }) {
  const map = { 1: ["rgba(255,205,60,0.15)", "var(--accent2)"], 2: ["rgba(180,180,200,0.12)", "#b4b4cc"], 3: ["rgba(180,100,60,0.12)", "#cc8866"] };
  const [bg, c] = map[rank] || ["var(--bg2)", "var(--muted)"];
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 3, fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, background: bg, color: c }}>{rank}</span>;
}
function Card({ children, style: s = {} }) {
  return <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, ...s }}>{children}</div>;
}
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem", overflowX: "auto" }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
          color: active === t ? "var(--accent)" : "var(--muted)",
          borderBottom: `2px solid ${active === t ? "var(--accent)" : "transparent"}`,
          marginBottom: -1, textTransform: "capitalize", transition: "color .2s",
        }}>{t}</button>
      ))}
    </div>
  );
}

/* ── Animated pixel character (CSS-only, no images needed) ────────────────── */
function PixelChar({ anim = "idle", facingRight = true, color = "#7fff6a", size = 32 }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const SPEEDS = { idle: 600, walking: 110, run: 110, attack: 140, fall: 200, jump: 200 };
    const speed  = SPEEDS[anim] ?? 300;
    const total  = anim === "idle" ? 4 : anim === "attack" ? 4 : 6;
    const id = setInterval(() => setFrame(f => (f + 1) % total), speed);
    return () => clearInterval(id);
  }, [anim]);

  const s         = size / 16;
  const isWalking = anim === "walking" || anim === "run";
  const isAttack  = anim === "attack";
  const legL      = isWalking ? Math.sin(frame * Math.PI)  * 2 * s : 0;
  const legR      = isWalking ? Math.sin(frame * Math.PI + Math.PI) * 2 * s : 0;
  const bodyBob   = isWalking ? Math.abs(Math.sin(frame * Math.PI)) * s : 0;
  const armRot    = isAttack  ? (frame < 2 ? -25 : 20)
                  : isWalking ? Math.sin(frame * Math.PI) * 25 : 0;
  const flip      = facingRight ? 1 : -1;

  return (
    <div style={{ position: "relative", width: size, height: size * 1.6, display: "inline-block", flexShrink: 0 }}>
      <div style={{
        position: "absolute", top: 0, left: "50%",
        transform: `translateX(-50%) translateY(${-bodyBob}px)`,
        width: 8 * s, height: 8 * s,
        background: color, borderRadius: 1 * s,
        border: `${0.5 * s}px solid rgba(0,0,0,0.5)`,
        boxSizing: "border-box",
      }}>
        <div style={{
          position: "absolute", top: 3 * s,
          left: facingRight ? 5 * s : 1 * s,
          width: 1.5 * s, height: 1.5 * s,
          background: "#000", borderRadius: "50%",
        }} />
      </div>
      <div style={{
        position: "absolute", top: 8.5 * s, left: "50%",
        transform: `translateX(-50%) translateY(${-bodyBob}px)`,
        width: 6 * s, height: 6 * s,
        background: color, opacity: 0.85, borderRadius: 0.5 * s,
      }} />
      <div style={{
        position: "absolute",
        top: 9.5 * s,
        left: facingRight ? "68%" : "12%",
        transform: `translateY(${-bodyBob}px) rotate(${armRot * flip}deg)`,
        transformOrigin: "top center",
        width: 2 * s, height: 4 * s,
        background: color, opacity: 0.8, borderRadius: 1 * s,
      }} />
      <div style={{
        position: "absolute", top: 14.5 * s, left: "28%",
        transform: `translateY(${legL}px)`,
        width: 2.5 * s, height: 5 * s,
        background: color, opacity: 0.9, borderRadius: 1 * s,
      }} />
      <div style={{
        position: "absolute", top: 14.5 * s, left: "52%",
        transform: `translateY(${legR}px)`,
        width: 2.5 * s, height: 5 * s,
        background: color, opacity: 0.9, borderRadius: 1 * s,
      }} />
    </div>
  );
}

/* ── Nav ───────────────────────────────────────────────────────────────────── */
function Nav({ page, setPage, wsRef }) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const go = (id) => {
    setPage("home");
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const navLinks = [
    { lbl: "Leaderboard", action: () => go("leaderboard") },
    { lbl: "Multiplayer",  action: () => setPage("multiplayer") },
    { lbl: "News",         action: () => setPage("news") },
    { lbl: "About",        action: () => go("about") },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem",
      background: scrolled ? "rgba(8,8,16,0.97)" : "rgba(8,8,16,0.7)",
      backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", transition: "background 0.3s",
    }}>
      <button onClick={() => setPage("home")} style={{ fontFamily: "var(--sans)", fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
        PIXEL<span style={{ color: "var(--text)" }}>RUN</span>
      </button>
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
        {navLinks.map(({ lbl, action }) => (
          <button key={lbl} onClick={action} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600,
            color: (page === "news" && lbl === "News") || (page === "multiplayer" && lbl === "Multiplayer") ? "var(--accent)" : "var(--muted)",
            transition: "color 0.2s",
          }}
            onMouseEnter={e => e.target.style.color = "var(--text)"}
            onMouseLeave={e => e.target.style.color =
              (page === "news" && lbl === "News") || (page === "multiplayer" && lbl === "Multiplayer") ? "var(--accent)" : "var(--muted)"}
          >{lbl}</button>
        ))}
        {user ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setPage("profile")} style={{
              background: page === "profile" ? "rgba(127,255,106,0.08)" : "none",
              border: "1px solid var(--border)", borderRadius: 6, padding: "5px 14px",
              color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 13, cursor: "pointer",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >{user.username} <span style={{ color: "var(--muted)", fontSize: 11 }}>🪙{user.coins ?? 0}</span></button>
            <button onClick={() => { logout(wsRef); setPage("home"); }}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)", cursor: "pointer" }}>exit</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="outline" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setPage("login")}>Login</Btn>
            <Btn v="primary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setPage("register")}>Register</Btn>
          </div>
        )}
      </div>
    </nav>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
function Hero({ setPage }) {
  return (
    <div style={{ padding: "140px 2rem 90px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(127,255,106,0.07) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: "linear-gradient(var(--text) 1px,transparent 1px),linear-gradient(90deg,var(--text) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <div style={{ position: "relative" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--accent)", border: "1px solid rgba(127,255,106,0.3)", padding: "4px 14px", borderRadius: 20, marginBottom: "1.5rem", textTransform: "uppercase", background: "rgba(127,255,106,0.06)", animation: "fadeUp .6s ease both" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.5s infinite" }} /> v1.3 · Live
        </span>
        <h1 style={{ fontSize: "clamp(3.5rem,9vw,8rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.95, marginBottom: "1.5rem", animation: "fadeUp .6s .1s ease both", opacity: 0, animationFillMode: "forwards" }}>
          PIXEL<span style={{ color: "var(--accent)" }}>RUN</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--muted)", maxWidth: 520, margin: "0 auto 2.5rem", animation: "fadeUp .6s .2s ease both", opacity: 0, animationFillMode: "forwards" }}>
          A pixel-art 2D platformer with precise combat, global leaderboards, quest system, cosmetics — and real-time multiplayer.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp .6s .3s ease both", opacity: 0, animationFillMode: "forwards" }}>
          <Btn v="primary" style={{ padding: "13px 28px", fontSize: 16 }} onClick={() => setPage("multiplayer")}>🎮 Play Together</Btn>
          <Btn v="outline" style={{ padding: "13px 28px", fontSize: 16 }} onClick={() => document.getElementById("leaderboard")?.scrollIntoView({ behavior: "smooth" })}>🏆 Leaderboard</Btn>
          <Btn v="outline" style={{ padding: "13px 28px", fontSize: 16 }} onClick={() => setPage("news")}>📋 Updates</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Stats Strip ───────────────────────────────────────────────────────────── */
function StatsStrip() {
  const [s, setS] = useState({});
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(d => { setS(d); setOk(true); }).catch(() => setOk(true));
  }, []);
  const items = [
    { n: ok ? (s.totalPlayers ?? "—") : "…", l: "Players" },
    { n: ok ? (s.totalRecords ?? "—") : "…", l: "Records" },
    { n: ok ? (s.totalLevels  ?? "—") : "…", l: "Levels"  },
    { n: "Free", l: "Forever", c: "var(--accent2)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "var(--border)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: "4rem" }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: "var(--bg1)", padding: "2rem 1.5rem", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "2.2rem", fontWeight: 700, color: it.c || "var(--accent)", display: "block", marginBottom: 4 }}>{it.n}</span>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>{it.l}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Leaderboard ───────────────────────────────────────────────────────────── */
function Leaderboard() {
  const [level, setLevel] = useState(1);
  const [rows,  setRows]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [hov, setHov] = useState(null);

  useEffect(() => {
    setLoading(true); setError("");
    fetch(`${API}/api/records/leaderboard/${level}?top=10`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(d); setLoading(false); })
      .catch(() => { setError("Could not reach the server."); setLoading(false); });
  }, [level]);

  return (
    <section id="leaderboard" style={{ padding: "3rem 2rem", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ fontSize: 13, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 4 }}>rankings</p>
      <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1.5rem" }}>Leaderboard</h2>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => setLevel(l)} style={{
            padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600,
            color: level === l ? "var(--accent)" : "var(--muted)",
            borderBottom: `2px solid ${level === l ? "var(--accent)" : "transparent"}`,
            marginBottom: -1, transition: "color .2s",
          }}>Level {l}</button>
        ))}
      </div>
      {loading ? <Loader /> : error ? <ErrBox msg={error} /> : rows.length === 0
        ? <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 14 }}>No records yet.</p>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Player", "Time", "Kills", "Coins", "Date"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "#" ? "center" : "left", fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                    style={{ borderBottom: "1px solid var(--border)", background: hov === i ? "rgba(255,255,255,0.02)" : "transparent", transition: "background .15s" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}><RankBadge rank={r.rank} /></td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15 }}>{r.username}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 700 }}>{fmt(r.time)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--mono)" }}>{r.kills}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", color: "var(--accent2)" }}>🪙{r.coins}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)" }}>{ago(r.setAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

/* ── About ─────────────────────────────────────────────────────────────────── */
function About() {
  const features = [
    { icon: "⚔️", title: "Precise Combat",      desc: "Directional attacks, cooldowns, and satisfying hit feedback." },
    { icon: "🗺️", title: "3 Levels",             desc: "Hand-crafted binary maps with colliders, traps, and boss rooms." },
    { icon: "🏆", title: "Leaderboards",         desc: "Per-level global rankings tracked in real time." },
    { icon: "🧩", title: "Quest System",          desc: "Complete objectives to earn coins and unlock cosmetics." },
    { icon: "🎨", title: "Cosmetics Shop",        desc: "Player, bar, and slash skins purchasable with in-game coins." },
    { icon: "🌐", title: "Real-time Multiplayer", desc: "See other players live via WebSocket — join lobbies and race levels." },
  ];
  return (
    <section id="about" style={{ padding: "4rem 2rem", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ fontSize: 13, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 4 }}>the game</p>
      <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "2rem" }}>About PixelRun</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {features.map((f, i) => (
          <Card key={i} style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── News ──────────────────────────────────────────────────────────────────── */
function NewsPage() {
  const [commits,  setCommits]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch(GH_API, { headers: { Accept: "application/vnd.github.v3+json" } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setCommits(d); setLoading(false); })
      .catch(() => { setError("Could not reach GitHub API."); setLoading(false); });
  }, []);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "90px 2rem 4rem" }}>
      <p style={{ fontSize: 12, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 4 }}>changelog</p>
      <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Development News</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: "2rem" }}>Latest commits from the <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>pixelrun+server</code> branch.</p>
      {loading ? <Loader text="Fetching commits" /> : error ? <ErrBox msg={error} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {commits.map((c, i) => {
            const lines = c.commit.message.split("\n");
            const title = lines[0]; const body = lines.slice(2).join("\n").trim();
            const type = commitType(title); const col = typeColor[type];
            return (
              <div key={c.sha} style={{ animation: `fadeUp .4s ${i * 0.04}s ease both`, opacity: 0, animationFillMode: "forwards" }}>
                <Card style={{ padding: "1rem 1.25rem", cursor: "pointer", transition: "border-color .2s", borderColor: expanded === i ? "rgba(255,255,255,0.12)" : "var(--border)" }}
                  onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Tag label={type} color={col} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>{title}</p>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{c.commit.author.name}</span> · {ago(c.commit.author.date)}
                        </span>
                        <a href={c.html_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--accent)", textDecoration: "none" }}>{c.sha?.slice(0, 10)} ↗</a>
                      </div>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 14, flexShrink: 0 }}>{expanded === i ? "▲" : "▼"}</span>
                  </div>
                  {expanded === i && body && (
                    <pre style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, background: "var(--bg2)", padding: "0.75rem 1rem", borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--mono)", marginTop: 12 }}>{body}</pre>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Auth Form ─────────────────────────────────────────────────────────────── */
function AuthForm({ mode, setPage }) {
  const { login } = useAuth();
  const isLogin   = mode === "login";
  const [form, setF]   = useState({ username: "", email: "", password: "" });
  const [loading, setL] = useState(false);
  const [error,   setE] = useState("");
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.email || !form.password) { setE("Fill in all fields."); return; }
    setL(true); setE("");
    try {
      const url  = isLogin ? `${API}/api/auth/login` : `${API}/api/auth/register`;
      const body = isLogin
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password };
      const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong");
      login({ id: data.id, username: data.username, email: data.email, coins: data.coins || 0 }, data.token);
      setPage("profile");
    } catch (err) { setE(err.message); }
    setL(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <Card style={{ padding: "2.5rem", width: "100%", maxWidth: 420 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.6rem", marginBottom: 4 }}>{isLogin ? "Welcome back" : "Join PixelRun"}</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: "1.75rem" }}>{isLogin ? "Access your profile, records and quests." : "Create account and start competing."}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!isLogin && <Field label="Username" placeholder="coolrunner99" value={form.username} onChange={set("username")} />}
          <Field label="Email"    type="email"    placeholder="you@example.com" value={form.email}    onChange={set("email")} />
          <Field label="Password" type="password" placeholder="••••••••"       value={form.password} onChange={set("password")} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <ErrBox msg={error} />
        <Btn onClick={submit} loading={loading} style={{ width: "100%", marginTop: 16, justifyContent: "center" }}>
          {isLogin ? "Login" : "Create Account"}
        </Btn>
        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 14, color: "var(--muted)" }}>
          {isLogin ? "No account? " : "Already registered? "}
          <button onClick={() => setPage(isLogin ? "register" : "login")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14, fontFamily: "var(--sans)", fontWeight: 700 }}>
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </Card>
    </div>
  );
}

/* ── Profile Page ──────────────────────────────────────────────────────────── */
function ProfilePage({ setPage, wsRef }) {
  const { user, logout, updateUser } = useAuth();
  const [records,  setRec]  = useState({ 1: null, 2: null, 3: null });
  const [quests,   setQ]    = useState([]);
  const [tab,      setTab]  = useState("overview");
  const [dataLoading, setDL] = useState(true);
  const [claiming, setClaiming] = useState(null);

  const [uname,  setUname]  = useState(user?.username || "");
  const [email,  setEmail]  = useState(user?.email    || "");
  const [newPw,  setNewPw]  = useState("");
  const [curPw,  setCurPw]  = useState("");
  const [editL,  setEditL]  = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editOk,  setEditOk]  = useState("");

  const hdrs = { Authorization: `Bearer ${user?.token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!user) return;
    const load = () => Promise.all([
      fetch(`${API}/api/records/my/1`, { headers: hdrs }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/records/my/2`, { headers: hdrs }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/records/my/3`, { headers: hdrs }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/quests`,       { headers: hdrs }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([r1, r2, r3, q]) => { setRec({ 1: r1, 2: r2, 3: r3 }); setQ(q); setDL(false); });

    load();
    const id = setInterval(() => {
      fetch(`${API}/api/quests`, { headers: hdrs })
        .then(r => r.ok ? r.json() : null)
        .then(q => { if (q) setQ(q); })
        .catch(() => {});
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user?.token]);

  const saveProfile = async () => {
    setEditL(true); setEditErr(""); setEditOk("");
    try {
      const body = {
        ...(uname !== user.username ? { username: uname } : {}),
        ...(email !== user.email   ? { email }            : {}),
        ...(newPw ? { newPassword: newPw, currentPassword: curPw } : {}),
      };
      if (!Object.keys(body).length) { setEditOk("Nothing to change."); setEditL(false); return; }
      const res = await fetch(`${API}/api/player/me`, { method: "PATCH", headers: hdrs, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Server error ${res.status}`); }
      const data = await res.json();
      updateUser({ username: data.username || uname, email: data.email || email });
      setEditOk("Profile updated!"); setNewPw(""); setCurPw("");
    } catch (err) { setEditErr(err.message); }
    setEditL(false);
  };

  const claimQuest = async (qid) => {
    setClaiming(qid);
    try {
      const res  = await fetch(`${API}/api/quests/claim/${qid}`, { method: "POST", headers: hdrs, body: "{}" });
      const data = await res.json();
      if (res.ok) {
        setQ(q => q.map(quest => quest.questId === qid ? { ...quest, claimed: true } : quest));
        const meRes = await fetch(`${API}/api/player/me`, { headers: hdrs });
        if (meRes.ok) { const me = await meRes.json(); updateUser({ coins: me.coins }); }
      }
    } catch {}
    setClaiming(null);
  };

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ color: "var(--muted)" }}>You need to be logged in.</p>
      <Btn onClick={() => setPage("login")}>Login</Btn>
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "90px 2rem 4rem" }}>
      <Card style={{ padding: "2rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>signed in as</p>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 2 }}>{user.username}</h2>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>{user.email}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 16, color: "var(--accent2)", fontWeight: 700 }}>🪙 {user.coins ?? 0}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>coins</span>
          </div>
        </div>
        <Btn v="danger" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => { logout(wsRef); setPage("home"); }}>Logout</Btn>
      </Card>

      <TabBar tabs={["overview", "quests", "edit profile"]} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Personal records</p>
          {dataLoading ? <Loader /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
              {LEVELS.flatMap(lvl => {
                const r = records[lvl];
                return [
                  <div key={`${lvl}t`} style={{ background: "var(--bg2)", borderRadius: 6, padding: "1rem" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Level {lvl} · Time</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 700, color: r ? "var(--accent)" : "var(--muted)" }}>{r ? fmt(r.time) : "—"}</div>
                  </div>,
                  <div key={`${lvl}k`} style={{ background: "var(--bg2)", borderRadius: 6, padding: "1rem" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Level {lvl} · Kills</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 700 }}>{r ? r.kills : "—"}</div>
                  </div>,
                ];
              })}
            </div>
          )}
          {!dataLoading && quests.length > 0 && (
            <Card style={{ padding: "1rem 1.25rem", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{quests.filter(q => q.completed && !q.claimed).length}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Ready to claim</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent2)" }}>{quests.filter(q => q.claimed).length}/{quests.length}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Completed</div></div>
              <Btn v="outline" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => setTab("quests")}>View quests →</Btn>
            </Card>
          )}
        </div>
      )}

      {tab === "quests" && (
        <div>
          {dataLoading ? <Loader /> : quests.length === 0
            ? <p style={{ color: "var(--muted)", fontSize: 14 }}>No quests available.</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {quests.map(q => {
                  const progress = Math.min(1, (q.currentValue || 0) / (q.targetValue || 1));
                  return (
                    <Card key={q.questId} style={{ padding: "1.1rem 1.25rem", opacity: q.claimed ? .5 : 1, borderColor: q.completed && !q.claimed ? "rgba(127,255,106,0.25)" : "var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{q.title}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent2)", marginLeft: 10 }}>+{q.reward} 🪙</span>
                        </div>
                        {q.completed && !q.claimed && <Btn style={{ fontSize: 12, padding: "5px 14px" }} loading={claiming === q.questId} onClick={() => claimQuest(q.questId)}>Claim</Btn>}
                        {q.claimed && <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#22aa17" }}>✓ claimed</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{q.description}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 5, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${progress * 100}%`, background: q.completed ? "var(--accent)" : "rgba(127,255,106,0.4)", transition: "width .6s cubic-bezier(.25,1,.5,1)" }} />
                        </div>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{q.currentValue || 0}/{q.targetValue}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {tab === "edit profile" && (
        <Card style={{ padding: "1.75rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "1.25rem" }}>Update your info</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Username" value={uname} onChange={e => setUname(e.target.value)} />
            <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Leave password fields empty to keep current password.</p>
            <Field label="Current password" type="password" placeholder="required for password change" value={curPw} onChange={e => setCurPw(e.target.value)} />
            <Field label="New password"     type="password" placeholder="min 8 characters"              value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <ErrBox msg={editErr} /><OkBox msg={editOk} />
          <div style={{ marginTop: "1.25rem" }}>
            <Btn onClick={saveProfile} loading={editL}>Save Changes</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Multiplayer constants ─────────────────────────────────────────────────── */
const LEVEL_NAMES = { 1: "Forest Run", 2: "Dark Caves", 3: "Sky Fortress" };
const LEVEL_DESCS = {
  1: "Beginner friendly. Forests, basic enemies, open paths.",
  2: "Underground caves with spike traps and tougher enemies.",
  3: "High altitude fortress — hardest level, best records.",
};
const LEVEL_ICONS = { 1: "🌲", 2: "🕳️", 3: "🏰" };
const LEVEL_DIFF  = { 1: ["var(--accent)", "Easy"], 2: ["var(--accent2)", "Medium"], 3: ["var(--danger)", "Hard"] };

/* ── Server-side lobby poll ──────────────────────────────────────────────── */
function useLobbyRooms() {
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    const load = () =>
      fetch(`${API}/api/lobby/rooms`)
        .then(r => r.ok ? r.json() : [])
        .then(setRooms)
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  return rooms;
}

/* ── WebSocket hook ──────────────────────────────────────────────────────── */
function useWebSocketPlayers(token, username) {
  const [players,   setPlayers]   = useState([]);
  const [connected, setConnected] = useState(false);
  const [myLevel,   setMyLevel]   = useState(null);
  const wsRef = useRef(null);
  const lvRef = useRef(1);
  const unRef = useRef(username);
  unRef.current = username;

  const _close = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    setConnected(false); setMyLevel(null); setPlayers([]);
  }, []);

  const connect = useCallback((level) => {
    if (!token) return;
    _close();
    lvRef.current = level;
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true); setMyLevel(level);
      ws.send(JSON.stringify({ x: -1, y: -1, lv: level, fr: true, anim: "idle", name: unRef.current, src: "web" }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "players") setPlayers(msg.players || []);
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; setConnected(false); setMyLevel(null); setPlayers([]); };
    ws.onerror = () => setConnected(false);
  }, [token, _close]);

  useEffect(() => { if (!token) _close(); }, [token, _close]);

  useEffect(() => {
    const id = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ x: -1, y: -1, lv: lvRef.current, fr: true, anim: "idle", name: unRef.current, src: "web" }));
    }, 2000);
    return () => { clearInterval(id); _close(); };
  }, [_close]);

  return { players, connected, myLevel, connect, disconnect: _close, wsRef };
}

/* ── Animated player row ─────────────────────────────────────────────────── */
function PlayerRow({ name, anim, facingRight = true, isSelf, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "9px 14px", borderRadius: 8,
      background: isSelf ? "rgba(127,255,106,0.06)" : "var(--bg2)",
      border: `1px solid ${isSelf ? "rgba(127,255,106,0.2)" : "var(--border)"}`,
    }}>
      <PixelChar anim={isSelf ? "idle" : (anim || "idle")} facingRight={facingRight} color={color} size={30} />
      <span style={{ fontWeight: isSelf ? 700 : 400, fontSize: 14, flex: 1 }}>{name}</span>
      {isSelf
        ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>You</span>
        : <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>{anim ? `[${anim}]` : "in-game"}</span>
      }
    </div>
  );
}

/* ── Multiplayer Page ────────────────────────────────────────────────────── */
function MultiplayerPage({ setPage }) {
  const { user } = useAuth();
  const rooms    = useLobbyRooms();
  const { players, connected, myLevel, connect, disconnect, wsRef } =
    useWebSocketPlayers(user?.token, user?.username);
  const [tab, setTab] = useState("lobbies");

  useEffect(() => { if (!connected) setTab("lobbies"); }, [connected]);

  const joinLobby = (level) => {
    if (!user) { setPage("login"); return; }
    connect(level); setTab("session");
  };

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "2rem" }}>
      <div style={{ fontSize: 48 }}>🎮</div>
      <h2 style={{ fontWeight: 800, fontSize: "1.6rem" }}>Multiplayer</h2>
      <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", maxWidth: 380 }}>
        You need an account to join multiplayer sessions and see who's online.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={() => setPage("login")}>Login</Btn>
        <Btn v="outline" onClick={() => setPage("register")}>Register</Btn>
      </div>
    </div>
  );

  const tabList = ["lobbies", connected ? "session" : null].filter(Boolean);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "90px 2rem 4rem" }}>
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>real-time multiplayer</p>
          <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Server Lobbies</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0,
            background: connected ? "var(--accent)" : "rgba(255,255,255,0.15)",
            animation: connected ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: connected ? "var(--accent)" : "var(--muted)" }}>
            {connected && myLevel
              ? `Connected · Level ${myLevel} — ${LEVEL_NAMES[myLevel]}`
              : "Not in a lobby"}
          </span>
          {connected && <Btn v="danger" style={{ fontSize: 12, padding: "5px 12px" }} onClick={disconnect}>Leave</Btn>}
        </div>
      </div>

      <TabBar tabs={tabList} active={tab} onChange={setTab} />

      {tab === "lobbies" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18, marginBottom: "2rem" }}>
            {LEVELS.map(l => {
              const room        = rooms.find(r => r.level === l);
              const online      = room ? room.online : 0;
              const roomPlayers = room ? (room.players || []) : [];
              const inThis      = connected && myLevel === l;
              const [diffColor, diffLabel] = LEVEL_DIFF[l];

              return (
                <Card key={l} style={{
                  padding: "1.5rem", position: "relative", overflow: "hidden",
                  borderColor: inThis ? "rgba(127,255,106,0.4)" : "var(--border)",
                  transition: "border-color .2s, transform .15s",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
                    background: inThis
                      ? "linear-gradient(90deg,var(--accent),rgba(127,255,106,0.2))"
                      : `linear-gradient(90deg,${diffColor}50,transparent)` }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 28 }}>{LEVEL_ICONS[l]}</span>
                      <div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Level {l}</div>
                        <h3 style={{ fontSize: 16, fontWeight: 800 }}>{LEVEL_NAMES[l]}</h3>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: diffColor, background: `${diffColor}12`, border: `1px solid ${diffColor}40`, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>{diffLabel}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: online > 0 ? "var(--accent)" : "var(--muted)" }}>
                        {online > 0 ? `🟢 ${online} online` : "⚫ Empty"}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>{LEVEL_DESCS[l]}</p>

                  {roomPlayers.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>In lobby</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {roomPlayers.slice(0, 6).map((p, i) => (
                          <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "2px 8px", borderRadius: 3, background: "rgba(100,180,255,0.08)", border: "1px solid rgba(100,180,255,0.18)", color: "rgba(160,210,255,0.9)" }}>👤 {p.username}</span>
                        ))}
                        {roomPlayers.length > 6 && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", padding: "2px 6px" }}>+{roomPlayers.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {inThis ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn v="outline" style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px 0" }} onClick={() => setTab("session")}>View Session ↗</Btn>
                      <Btn v="danger" style={{ fontSize: 13, padding: "8px 12px" }} onClick={disconnect}>Leave</Btn>
                    </div>
                  ) : (
                    <Btn style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={() => joinLobby(l)}>
                      {connected ? "Switch lobby" : "Join Lobby"}
                    </Btn>
                  )}
                </Card>
              );
            })}
          </div>

          <Card style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--mono)" }}>How multiplayer works</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              {[
                { icon: "1️⃣", text: "Pick a lobby and click Join" },
                { icon: "2️⃣", text: "Open PixelRun, log in and select the same level" },
                { icon: "3️⃣", text: "Other players appear with their names above them" },
                { icon: "🏆", text: "Race to best time and compete on the board" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, lineHeight: 1.4 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "session" && connected && (
        <div>
          <Card style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Active session</p>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{LEVEL_ICONS[myLevel]} {LEVEL_NAMES[myLevel]} — Level {myLevel}</h3>
              </div>
              <Btn v="danger" style={{ fontSize: 13, padding: "8px 16px" }} onClick={disconnect}>Leave Session</Btn>
            </div>

            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Players in lobby ({players.length + 1})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <PlayerRow name={user.username} isSelf color="var(--accent)" />
              {players.length === 0 ? (
                <div style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: 6, fontSize: 13, color: "var(--muted)", fontFamily: "var(--mono)", border: "1px solid var(--border)", fontStyle: "italic" }}>
                  Waiting for other players… Open PixelRun on the same level.
                </div>
              ) : players.map((p, i) => (
                <PlayerRow
                  key={p.id ?? i}
                  name={p.username || `Player #${p.id}`}
                  anim={p.anim}
                  facingRight={p.facingRight ?? true}
                  color="rgba(100,180,255,0.85)"
                />
              ))}
            </div>
          </Card>

          <Card style={{ padding: "1.5rem" }}>
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Level {myLevel} · Top records</p>
            <MiniLeaderboard level={myLevel} />
          </Card>
        </div>
      )}
    </div>
  );
}

function MiniLeaderboard({ level }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/records/leaderboard/${level}?top=5`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setRows(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [level]);
  if (loading) return <Loader text="Loading records" />;
  if (!rows.length) return <p style={{ color: "var(--muted)", fontSize: 13 }}>No records yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: i === 0 ? "rgba(255,205,60,0.05)" : "var(--bg2)", borderRadius: 6, border: `1px solid ${i === 0 ? "rgba(255,205,60,0.15)" : "var(--border)"}` }}>
          <RankBadge rank={r.rank} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{r.username}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--accent)", fontWeight: 700 }}>{fmt(r.time)}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>💀{r.kills}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Home ──────────────────────────────────────────────────────────────────── */
function HomePage({ setPage }) {
  return (
    <>
      <Hero setPage={setPage} />
      <StatsStrip />
      <Leaderboard />
      <About />
      <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem", textAlign: "center", fontSize: 13, color: "var(--muted)", fontFamily: "var(--mono)" }}>
        PIXELRUN · SFML 3 + ASP.NET Core · {new Date().getFullYear()} ·{" "}
        <a href={`https://github.com/${GH_REPO}/tree/${GH_BRANCH}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>GitHub ↗</a>
      </footer>
    </>
  );
}

/* ── App Root ──────────────────────────────────────────────────────────────── */
export default function App() {
  const [page, setPage] = useState("home");
  const wsRef = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  return (
    <AuthProvider>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#080810;--bg1:#0f0f1a;--bg2:#14141f;
          --border:rgba(255,255,255,.07);
          --accent:#7fff6a;--accent2:#ffcd3c;
          --text:#e8e8f0;--muted:#7a7a90;--danger:#ff5c5c;
          --mono:'Space Mono',monospace;--sans:'Syne',sans-serif
        }
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.6;min-height:100vh}
        button{font-family:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:var(--bg)}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
        ::selection{background:rgba(127,255,106,.2)}
        a{color:inherit}
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, background: "repeating-linear-gradient(to bottom,transparent 0,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px)", opacity: .35 }} />

      <Nav page={page} setPage={setPage} wsRef={wsRef} />

      <main>
        {page === "home"        && <HomePage setPage={setPage} />}
        {page === "news"        && <NewsPage />}
        {page === "login"       && <AuthForm mode="login"    setPage={setPage} />}
        {page === "register"    && <AuthForm mode="register" setPage={setPage} />}
        {page === "profile"     && <ProfilePage setPage={setPage} wsRef={wsRef} />}
        {page === "multiplayer" && <MultiplayerPage setPage={setPage} />}
      </main>
    </AuthProvider>
  );
}