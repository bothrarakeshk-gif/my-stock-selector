import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace with your deployed Azure Function App base URL.
// e.g. "https://my-func-app.azurewebsites.net/api"
// For local testing with Azurite: "http://localhost:7071/api"
const API_BASE = "/api"; // Azure Static Web Apps routes /api/* to your Functions automatically

// ─── PRODUCT CATALOGUE ───────────────────────────────────────────────────────
const ALL_PRODUCTS = [
  { id: "prod-001", name: "Azure Blob Storage",        category: "Storage"   },
  { id: "prod-002", name: "Azure SQL Database",        category: "Database"  },
  { id: "prod-003", name: "Azure Cosmos DB",           category: "Database"  },
  { id: "prod-004", name: "Azure Functions",           category: "Compute"   },
  { id: "prod-005", name: "Azure App Service",         category: "Compute"   },
  { id: "prod-006", name: "Azure Kubernetes Service",  category: "Compute"   },
  { id: "prod-007", name: "Azure Service Bus",         category: "Messaging" },
  { id: "prod-008", name: "Azure Event Hub",           category: "Messaging" },
  { id: "prod-009", name: "Azure API Management",      category: "Gateway"   },
  { id: "prod-010", name: "Azure Active Directory",    category: "Security"  },
  { id: "prod-011", name: "Azure Key Vault",           category: "Security"  },
  { id: "prod-012", name: "Azure Monitor",             category: "Observability" },
  { id: "prod-013", name: "Azure Log Analytics",       category: "Observability" },
  { id: "prod-014", name: "Azure CDN",                 category: "Networking"},
  { id: "prod-015", name: "Azure Virtual Network",     category: "Networking"},
];

const CATEGORIES = [...new Set(ALL_PRODUCTS.map(p => p.category))];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const categoryColors = {
  Storage:       { bg: "#EFF6FF", dot: "#3B82F6" },
  Database:      { bg: "#F0FDF4", dot: "#22C55E" },
  Compute:       { bg: "#FFF7ED", dot: "#F97316" },
  Messaging:     { bg: "#FDF4FF", dot: "#A855F7" },
  Gateway:       { bg: "#FFFBEB", dot: "#EAB308" },
  Security:      { bg: "#FFF1F2", dot: "#F43F5E" },
  Observability: { bg: "#F0FDFA", dot: "#14B8A6" },
  Networking:    { bg: "#F8FAFC", dot: "#64748B" },
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function ProductSelector() {
  const [codename,         setCodename]         = useState("");
  const [selected,         setSelected]         = useState(new Set());
  const [filterCategory,   setFilterCategory]   = useState("All");
  const [filterText,       setFilterText]       = useState("");
  const [status,           setStatus]           = useState(null); // { type: "success"|"error"|"info", msg }
  const [loadState,        setLoadState]        = useState("idle"); // idle | loading | loaded | error
  const [saveState,        setSaveState]        = useState("idle"); // idle | saving | saved | error

  // Show a status message that auto-dismisses after 4 s
  const showStatus = useCallback((type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  // ── Load saved selection from Azure ────────────────────────────────────────
  const loadSelection = useCallback(async (name) => {
    if (!name.trim()) return;
    setLoadState("loading");
    try {
      const res = await fetch(`${API_BASE}/selections/${encodeURIComponent(name.trim())}`);
      if (res.status === 404) {
        setSelected(new Set());
        setLoadState("loaded");
        showStatus("info", `No saved selection found for "${name.trim()}". Starting fresh.`);
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setSelected(new Set(data.selectedProducts ?? []));
      setLoadState("loaded");
      const count = (data.selectedProducts ?? []).length;
      const d = new Date(data.savedAt).toLocaleString();
      showStatus("success", `Loaded ${count} product${count !== 1 ? "s" : ""} saved on ${d}.`);
    } catch (err) {
      setLoadState("error");
      showStatus("error", `Load failed: ${err.message}`);
    }
  }, [showStatus]);

  // Load on mount if codename is pre-filled (or user hits Enter)
  const handleCodenameLoad = (e) => {
    if (e.key === "Enter") loadSelection(codename);
  };

  // ── Save selection to Azure ─────────────────────────────────────────────────
  const saveSelection = useCallback(async () => {
    if (!codename.trim()) {
      showStatus("error", "Please enter a codename before saving.");
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch(`${API_BASE}/selections`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          codename:         codename.trim(),
          selectedProducts: [...selected],
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setSaveState("saved");
      showStatus("success", `Selection saved as "${codename.trim()}" (${selected.size} products).`);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      showStatus("error", `Save failed: ${err.message}`);
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [codename, selected, showStatus]);

  // ── Toggle a product ────────────────────────────────────────────────────────
  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const visible = filtered.map(p => p.id);
    const allOn   = visible.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allOn) visible.forEach(id => next.delete(id));
      else       visible.forEach(id => next.add(id));
      return next;
    });
  };

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = ALL_PRODUCTS.filter(p => {
    const catOk  = filterCategory === "All" || p.category === filterCategory;
    const textOk = !filterText || p.name.toLowerCase().includes(filterText.toLowerCase());
    return catOk && textOk;
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));

  // ── Styles (inline so single-file JSX works) ────────────────────────────────
  const S = styles;

  return (
    <div style={S.root}>
      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoRow}>
            <span style={S.logoIcon}>⬡</span>
            <span style={S.logoText}>Product Selector</span>
          </div>
          <p style={S.subtitle}>Choose your Azure products and save the configuration.</p>
        </div>
      </header>

      <main style={S.main}>

        {/* ── Codename card ── */}
        <section style={S.card}>
          <label style={S.cardLabel}>Configuration Codename</label>
          <div style={S.codenameRow}>
            <input
              style={S.input}
              placeholder="e.g. prod-east-2026"
              value={codename}
              onChange={e => setCodename(e.target.value)}
              onKeyDown={handleCodenameLoad}
            />
            <button
              style={{ ...S.btnOutline, ...(loadState === "loading" ? S.btnDisabled : {}) }}
              onClick={() => loadSelection(codename)}
              disabled={loadState === "loading"}
            >
              {loadState === "loading" ? "Loading…" : "↓ Load"}
            </button>
          </div>
          <p style={S.hint}>Press Enter or click Load to restore a saved selection.</p>
        </section>

        {/* ── Status banner ── */}
        {status && (
          <div style={{ ...S.banner, ...S.bannerTypes[status.type] }}>
            <span style={S.bannerIcon}>{bannerIcon[status.type]}</span>
            {status.msg}
          </div>
        )}

        {/* ── Filters ── */}
        <section style={S.filtersRow}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="Search products…"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
          <div style={S.categoryTabs}>
            {["All", ...CATEGORIES].map(cat => (
              <button
                key={cat}
                style={{
                  ...S.catTab,
                  ...(filterCategory === cat ? S.catTabActive : {}),
                }}
                onClick={() => setFilterCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* ── Product list ── */}
        <section style={S.card}>
          {/* List header */}
          <div style={S.listHeader}>
            <label style={S.listHeaderLabel}>
              <input
                type="checkbox"
                style={S.checkbox}
                checked={allVisibleSelected}
                onChange={toggleAll}
              />
              <span style={S.listHeaderText}>
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
                {filterCategory !== "All" ? ` in ${filterCategory}` : ""}
              </span>
            </label>
            <span style={S.selectedBadge}>{selected.size} selected</span>
          </div>

          {/* Rows */}
          <ul style={S.list}>
            {filtered.length === 0 && (
              <li style={S.emptyRow}>No products match your filter.</li>
            )}
            {filtered.map((product, i) => {
              const isOn   = selected.has(product.id);
              const color  = categoryColors[product.category] ?? { bg: "#F8FAFC", dot: "#64748B" };
              return (
                <li
                  key={product.id}
                  style={{
                    ...S.row,
                    ...(isOn ? S.rowActive : {}),
                    borderTop: i === 0 ? "none" : "1px solid #F1F5F9",
                  }}
                  onClick={() => toggle(product.id)}
                >
                  <input
                    type="checkbox"
                    style={S.checkbox}
                    checked={isOn}
                    onChange={() => toggle(product.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span style={S.productName}>{product.name}</span>
                  <span style={{ ...S.catBadge, background: color.bg, color: color.dot }}>
                    <span style={{ ...S.dot, background: color.dot }} />
                    {product.category}
                  </span>
                  <span style={S.productId}>{product.id}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Save button ── */}
        <div style={S.saveRow}>
          <button
            style={{
              ...S.btnPrimary,
              ...(saveState === "saving" ? S.btnDisabled : {}),
              ...(saveState === "saved"  ? S.btnSaved : {}),
            }}
            onClick={saveSelection}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…"
             : saveState === "saved"  ? "✓ Saved!"
             : `Save ${selected.size} product${selected.size !== 1 ? "s" : ""}`}
          </button>
          {selected.size > 0 && (
            <button style={S.btnGhost} onClick={() => setSelected(new Set())}>
              Clear all
            </button>
          )}
        </div>

      </main>
    </div>
  );
}

// ─── ICON MAP ────────────────────────────────────────────────────────────────
const bannerIcon = { success: "✓", error: "✕", info: "ℹ" };

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = {
  root: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    background: "#F8FAFC",
    minHeight: "100vh",
    color: "#0F172A",
  },
  header: {
    background: "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)",
    padding: "2.5rem 1.5rem 2rem",
  },
  headerInner: {
    maxWidth: 780,
    margin: "0 auto",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoIcon: {
    fontSize: 28,
    color: "#BAE6FD",
    lineHeight: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    color: "#BAE6FD",
    fontSize: 14,
  },
  main: {
    maxWidth: 780,
    margin: "0 auto",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
  },
  cardLabel: {
    display: "block",
    padding: "1rem 1.25rem 0.5rem",
    fontWeight: 600,
    fontSize: 13,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  codenameRow: {
    display: "flex",
    gap: 8,
    padding: "0 1.25rem",
  },
  input: {
    flex: 1,
    padding: "0.6rem 0.85rem",
    border: "1.5px solid #CBD5E1",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    color: "#0F172A",
    background: "#fff",
    transition: "border-color 0.15s",
  },
  hint: {
    margin: "0.4rem 1.25rem 1rem",
    fontSize: 12,
    color: "#94A3B8",
  },
  filtersRow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  categoryTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  catTab: {
    padding: "0.35rem 0.8rem",
    borderRadius: 20,
    border: "1.5px solid #CBD5E1",
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
    color: "#475569",
    fontWeight: 500,
    transition: "all 0.15s",
  },
  catTabActive: {
    background: "#0EA5E9",
    borderColor: "#0EA5E9",
    color: "#fff",
  },
  listHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.85rem 1.25rem",
    borderBottom: "1px solid #F1F5F9",
    background: "#F8FAFC",
  },
  listHeaderLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    userSelect: "none",
  },
  listHeaderText: {
    fontWeight: 600,
    fontSize: 13,
    color: "#475569",
  },
  selectedBadge: {
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: 700,
    padding: "0.2rem 0.65rem",
    borderRadius: 20,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  emptyRow: {
    padding: "2rem",
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 14,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0.85rem 1.25rem",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  rowActive: {
    background: "#F0F9FF",
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
    accentColor: "#0EA5E9",
    flexShrink: 0,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
    color: "#1E293B",
  },
  catBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },
  productId: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  saveRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: "1rem",
  },
  btnPrimary: {
    padding: "0.7rem 1.6rem",
    background: "linear-gradient(135deg, #0EA5E9, #0369A1)",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.15s",
    letterSpacing: "-0.01em",
  },
  btnSaved: {
    background: "linear-gradient(135deg, #22C55E, #16A34A)",
  },
  btnOutline: {
    padding: "0.6rem 1rem",
    background: "transparent",
    color: "#0EA5E9",
    border: "1.5px solid #0EA5E9",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGhost: {
    padding: "0.7rem 1rem",
    background: "transparent",
    color: "#94A3B8",
    border: "1.5px solid #E2E8F0",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  banner: {
    borderRadius: 10,
    padding: "0.85rem 1.1rem",
    fontSize: 14,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  bannerTypes: {
    success: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" },
    error:   { background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" },
    info:    { background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD" },
  },
  bannerIcon: {
    fontWeight: 800,
    fontSize: 15,
  },
};
