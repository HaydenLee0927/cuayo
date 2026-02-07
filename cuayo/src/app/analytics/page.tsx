"use client";

import React, { useEffect, useMemo, useState } from "react";

type TimeOpt = "d" | "w" | "m";

type ApiPieRow = {
  category: string;
  amount: number;
  proportion: number; // 0..1
};

type ApiResponse = {
  ok: boolean;
  pie: ApiPieRow[];
  total: number;
  budget: number;
  budgetDelta: number;
  advice?: string
};

function formatMoney(x: number) {
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(p: number) {
  if (!Number.isFinite(p)) return "-";
  return `${(p * 100).toFixed(1)}%`;
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 3,
        background: color,
        marginRight: 8,
        border: "1px solid rgba(255,255,255,0.65)",
        boxShadow: "0 1px 2px rgba(2,6,23,0.15)",
        flex: "0 0 auto",
      }}
    />
  );
}

/**
 * Fix mojibake like "You��re" (UTF-8 decoded wrong) by replacing common replacement characters.
 * This is a UI-side patch; best fix is to force UTF-8 in the python/route output.
 */
function sanitizeAdviceText(s: string) {
  if (!s) return "";
  let t = s;

  // Replace the Unicode replacement char and common mojibake sequences
  // Note: We can't perfectly recover the original apostrophe, but this makes it legible.
  t = t.replaceAll("\uFFFD", "'"); // �
  t = t.replaceAll("��", "'");

  // Normalize weird spacing
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

/**
 * Render advice with better readability (paragraphs) instead of one long raw line.
 */
function AdviceBlock({ text }: { text: string }) {
  const clean = sanitizeAdviceText(text);
  if (!clean) return null;

  const parts = clean.split(/\n\s*\n/g); // blank-line paragraphs
  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.78)",
        color: "rgba(15,23,42,0.92)",
        lineHeight: 1.6,
        fontSize: 13.5,
      }}
    >
      {parts.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0 0", whiteSpace: "pre-wrap" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * SVG donut pie chart:
 * - Category-only labels (no amount/proportion) for sufficiently large slices
 * - For small slices (< 3%), show NO label at all (even outside)
 * - Click slice -> select/deselect
 * - Click center -> toggle table panel (handled by parent)
 * - Selected slice pops out; viewBox padded so nothing gets clipped
 */
function PieSvg(props: {
  data: { label: string; value: number; proportion: number }[];
  size?: number;
  selectedLabel: string | null;
  onSelectSlice: (label: string | null) => void;
  onCenterClick: () => void;
  colorMap: Record<string, string>;
}) {
  const size = props.size ?? 520; // bigger chart
  const R = size / 2;

  const cx = R;
  const cy = R;

  const outerR = R;
  const innerR = R * 0.56;
  const insideLabelR = R * 0.78;

  const SMALL_SLICE_THRESHOLD = 0.03;
  const POP_OUT_DISTANCE = 12;
  const PADDING = POP_OUT_DISTANCE + 18;

  const slices = useMemo(() => {
    let acc = 0;
    return props.data.map((d) => {
      const start = acc;
      const delta = d.proportion * Math.PI * 2;
      const end = start + delta;
      acc = end;
      return { ...d, start, end };
    });
  }, [props.data]);

  function polarToCartesian(angle: number, radius: number) {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function arcPath(start: number, end: number) {
    const p1 = polarToCartesian(start, outerR);
    const p2 = polarToCartesian(end, outerR);
    const largeArc = end - start > Math.PI ? 1 : 0;

    const i1 = polarToCartesian(end, innerR);
    const i2 = polarToCartesian(start, innerR);

    return [
      `M ${p1.x} ${p1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
      "Z",
    ].join(" ");
  }

  function handleSliceClick(label: string) {
    props.onSelectSlice(props.selectedLabel === label ? null : label);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-PADDING} ${-PADDING} ${size + PADDING * 2} ${size + PADDING * 2}`}
      role="img"
      aria-label="Spending by category pie chart"
      style={{ display: "block", overflow: "visible" }}
    >
      <g transform={`translate(${PADDING}, ${PADDING})`}>
        {slices.map((s) => {
          const start = s.start - Math.PI / 2;
          const end = s.end - Math.PI / 2;
          const mid = (start + end) / 2;

          const isSelected = props.selectedLabel === s.label;
          const color = props.colorMap[s.label] ?? "#334155";

          const dx = isSelected ? POP_OUT_DISTANCE * Math.cos(mid) : 0;
          const dy = isSelected ? POP_OUT_DISTANCE * Math.sin(mid) : 0;

          const labelP = polarToCartesian(mid, insideLabelR);
          const showLabel = s.proportion >= SMALL_SLICE_THRESHOLD;

          return (
            <g
              key={s.label}
              style={{
                cursor: "pointer",
                transform: `translate(${dx}px, ${dy}px)` as any,
              }}
              onClick={() => handleSliceClick(s.label)}
            >
              <path
                d={arcPath(start, end)}
                fill={color}
                opacity={props.selectedLabel && !isSelected ? 0.35 : 0.95}
                stroke={isSelected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)"}
                strokeWidth={isSelected ? 2 : 1}
              >
                <title>{s.label}</title>
              </path>

              {showLabel ? (
                <text
                  x={labelP.x}
                  y={labelP.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(255,255,255,0.92)"
                  fontSize={12}
                  fontWeight={900}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {s.label}
                </text>
              ) : null}
            </g>
          );
        })}

        <circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="rgba(255,255,255,0.92)"
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            props.onCenterClick();
          }}
        >
          <title>Click to open category table</title>
        </circle>

        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(15,23,42,0.55)"
          fontSize={13}
          fontWeight={900}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
        </text>
      </g>
    </svg>
  );
}

type SortKey = "amount" | "proportion";
type SortDir = "asc" | "desc";

export default function AnalyticsPage() {
  const USER_ID = "EuLe21";
  const REF_TIME = "2019-02-15T00:00:00.000Z";

  const [time, setTime] = useState<TimeOpt>("m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<ApiResponse | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ✅ NEW: detailed report state
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [detailedError, setDetailedError] = useState<string>("");
  const [detailedReport, setDetailedReport] = useState<string>("");
  const [showDetailed, setShowDetailed] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      // default => short advice (route should default to short)
      const qs = new URLSearchParams({ userId: USER_ID, time, refTime: REF_TIME });
      const res = await fetch(`/api/analytics?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json?.ok) {
        setData(null);
        setError((json as any)?.error ?? `HTTP ${res.status}`);
        return;
      }

      setData(json);
      setSelectedCategory(null);
      setShowTable(false);

      // reset detailed when timeframe changes/reloads
      setDetailedReport("");
      setDetailedError("");
      setShowDetailed(false);
    } catch (e: any) {
      setData(null);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetailedReport() {
    setDetailedLoading(true);
    setDetailedError("");

    try {
      const qs = new URLSearchParams({
        userId: USER_ID,
        time,
        refTime: REF_TIME,
        mode: "detailed",
      });

      const res = await fetch(`/api/analytics?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json?.ok) {
        setDetailedReport("");
        setDetailedError((json as any)?.error ?? `HTTP ${res.status}`);
        setShowDetailed(true);
        return;
      }

      const text = sanitizeAdviceText(String(json.advice ?? ""));
      setDetailedReport(text);
      setShowDetailed(true);
    } catch (e: any) {
      setDetailedReport("");
      setDetailedError(String(e?.message ?? e));
      setShowDetailed(true);
    } finally {
      setDetailedLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [time]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.pie.map((r) => ({ label: r.category, value: r.amount, proportion: r.proportion }));
  }, [data]);

  const colorMap = useMemo(() => {
    const palette = [
      "#1f3a8a",
      "#0f766e",
      "#7c3aed",
      "#b45309",
      "#be123c",
      "#047857",
      "#334155",
      "#1d4ed8",
      "#0ea5e9",
      "#a21caf",
      "#16a34a",
      "#f97316",
    ];
    const map: Record<string, string> = {};
    pieData.forEach((r, i) => (map[r.label] = palette[i % palette.length]));
    return map;
  }, [pieData]);

  const selectedRow = useMemo(() => {
    if (!data || !selectedCategory) return null;
    return data.pie.find((r) => r.category === selectedCategory) ?? null;
  }, [data, selectedCategory]);

  const sortedTableRows = useMemo(() => {
    const rows = [...pieData];
    rows.sort((a, b) => {
      const av = sortKey === "amount" ? a.value : a.proportion;
      const bv = sortKey === "amount" ? b.value : b.proportion;
      const diff = av - bv;
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [pieData, sortKey, sortDir]);

  const showRightPanel = Boolean((selectedCategory && selectedRow) || showTable);

  const cardStyle: React.CSSProperties = {
    borderRadius: 14,
    padding: 16,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(15,23,42,0.10)",
    boxShadow: "0 8px 22px rgba(2,6,23,0.08)",
  };

  const delta = data?.budgetDelta ?? 0;
  const saved = delta >= 0;

  const deltaColor = saved ? "#2563eb" : "#dc2626";
  const deltaTitle = saved ? "You saved money" : "You lost money";

  function onSelectSlice(label: string | null) {
    setSelectedCategory(label);
    setShowTable(false);
  }

  function onCenterClick() {
    setSelectedCategory(null);
    setShowTable((prev) => !prev);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const shortAdvice = sanitizeAdviceText(String(data?.advice ?? ""));

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Analytics</h1>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Time</div>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value as TimeOpt)}
            style={{
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            <option value="d">day</option>
            <option value="w">week</option>
            <option value="m">month</option>
          </select>
        </div>

        <div style={{ fontSize: 12, opacity: 0.65, paddingBottom: 6 }}>{loading ? "Loading..." : " "}</div>
      </div>

      {error ? (
        <div
          style={{
            ...cardStyle,
            background: "rgba(254, 226, 226, 0.85)",
            border: "1px solid rgba(220,38,38,0.25)",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 800 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Total Spent</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>${formatMoney(data?.total ?? 0)}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Budget</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>${formatMoney(data?.budget ?? 0)}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{deltaTitle}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: deltaColor }}>
            {saved ? "+" : "-"}${formatMoney(Math.abs(delta))}
          </div>
          </div>
        </div>
      </div>

      {/* Pie + right panel */
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showRightPanel ? "1fr 440px" : "1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Spending by Category card */}
        <div style={cardStyle}>
          {/* ✅ Header row with button on right top */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Spending by Category</div>

              {/* ✅ Replace the old helper text block with the short advice (no separate section) */}
              <div style={{ opacity: 0.78, fontSize: 12.5, lineHeight: 1.5 }}>
                {shortAdvice
                  ? shortAdvice
                  : "short advice"}
              </div>
            </div>

            {/* Button top-right */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={async () => {
                  // If already generated, just toggle visibility
                  if (detailedReport || detailedError) {
                    setShowDetailed((v) => !v);
                    return;
                  }
                  await loadDetailedReport();
                }}
                disabled={detailedLoading}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: detailedLoading ? "rgba(15, 23, 42, 0.06)" : "rgba(15, 23, 42, 0.10)",
                  cursor: detailedLoading ? "default" : "pointer",
                  fontWeight: 800,
                  fontSize: 12.5,
                  whiteSpace: "nowrap",
                }}
                title="Generate a long-form spending report"
              >
                {detailedLoading
                  ? "Generating..."
                  : detailedReport || detailedError
                    ? "Toggle report"
                    : "Generate detailed report"}
              </button>

              {(detailedReport || detailedError) ? (
                <button
                  onClick={() => {
                    setDetailedReport("");
                    setDetailedError("");
                    setShowDetailed(false);
                  }}
                  style={{
                    height: 36,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(255,255,255,0.65)",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 12.5,
                    whiteSpace: "nowrap",
                  }}
                  title="Clear the generated report"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Pie */}
          {pieData.length === 0 ? (
            <div style={{ opacity: 0.7, marginTop: 10 }}>No category spending found for this timeframe.</div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                paddingTop: 8,
              }}
            >
              <PieSvg
                data={pieData}
                size={520}
                selectedLabel={selectedCategory}
                onSelectSlice={onSelectSlice}
                onCenterClick={onCenterClick}
                colorMap={colorMap}
              />
            </div>
          )}

          {/* ✅ Detailed report output (shows only when generated / toggled) */}
          {showDetailed ? (
            <div style={{ marginTop: 12 }}>
              {detailedError ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(220,38,38,0.25)",
                    background: "rgba(254,226,226,0.70)",
                    whiteSpace: "pre-wrap",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                  }}
                >
                  {sanitizeAdviceText(detailedError)}
                </div>
              ) : null}

              {detailedReport ? (
                <div>
                  {/* title row */}
                  <div style={{ fontWeight: 900, marginBottom: 6, marginTop: detailedError ? 10 : 0 }}>
                    Detailed Report
                  </div>
                  <AdviceBlock text={detailedReport} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right panel */}
        {showRightPanel ? (
          <div style={cardStyle}>
            {/* Single category detail */}
            {selectedCategory && selectedRow ? (
              <>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Category Detail</div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "rgba(255,255,255,0.75)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Category</div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                    <ColorSwatch color={colorMap[selectedRow.category] ?? "#334155"} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedRow.category}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>${formatMoney(selectedRow.amount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Share of total</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{formatPct(selectedRow.proportion)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                    Total spent (timeframe): ${formatMoney(data?.total ?? 0)}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    marginTop: 12,
                    height: 38,
                    width: "100%",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(15, 23, 42, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </>
            ) : null}

            {/* Category detail table */}
            {showTable ? (
              <>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Category Detail Table</div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>Category</th>

                        <th
                          style={{
                            padding: "10px 8px",
                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => toggleSort("amount")}
                          title="Sort by amount"
                        >
                          Amount{sortIndicator("amount")}
                        </th>

                        <th
                          style={{
                            padding: "10px 8px",
                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => toggleSort("proportion")}
                          title="Sort by proportion"
                        >
                          Proportion{sortIndicator("proportion")}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {sortedTableRows.map((r) => (
                        <tr
                          key={r.label}
                          onClick={() => {
                            setSelectedCategory(r.label);
                            setShowTable(false);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 800 }}>
                            <span style={{ display: "inline-flex", alignItems: "center" }}>
                              <ColorSwatch color={colorMap[r.label] ?? "#334155"} />
                              {r.label}
                            </span>
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            ${formatMoney(r.value)}
                          </td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {formatPct(r.proportion)}
                          </td>
                        </tr>
                      ))}
                      {sortedTableRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: 14, opacity: 0.7 }}>
                            No rows.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      }
    </div>
  );
}
