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
  budgetDelta: number; // budget - total
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

  // Local coordinates: 0..size
  const cx = R;
  const cy = R;

  const outerR = R;
  const innerR = R * 0.56;
  const insideLabelR = R * 0.78;

  const SMALL_SLICE_THRESHOLD = 0.03;
  const POP_OUT_DISTANCE = 12;

  // Padding: ensure popped slices are never clipped
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

          // Pop-out translation along mid-angle
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

              {/* Only show category label for sufficiently large slices */}
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

        {/* Donut hole: click toggles table panel */}
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
          {props.selectedLabel ? "Click center for table" : "Click slice"}
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

  async function load() {
    setLoading(true);
    setError("");

    try {
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
    } catch (e: any) {
      setData(null);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Per your rule: delta >= 0 => red (saved), delta < 0 => blue (lost).
  const deltaColor = saved ? "#dc2626" : "#2563eb";
  const deltaTitle = saved ? "You saved money" : "You lost money";
  const deltaSubtitle = saved
    ? "Your spending is under the budget for this timeframe."
    : "Your spending is above the budget for this timeframe.";

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

  return (
    <div className="w-full max-w-[1200px] mx-auto">
  <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
    Analytics
  </h1>
  <div style={{ opacity: 0.75, marginBottom: 18 }}>
    Spending breakdown and budget status for the selected timeframe.
  </div>

        {/* Controls: time only, no Refresh */}
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
            <div style={{ fontSize: 12, opacity: 0.7 }}>Total Spent</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${formatMoney(data?.total ?? 0)}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Selected timeframe: {time}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Budget</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${formatMoney(data?.budget ?? 0)}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>From search_user() output</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{deltaTitle}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: deltaColor }}>
              {saved ? "+" : "-"}${formatMoney(Math.abs(delta))}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{deltaSubtitle}</div>
          </div>
        </div>

        {/* Pie + right panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: showRightPanel ? "1fr 440px" : "1fr",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Spending by Category</div>
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
              Click a slice to open a single detail panel (and pop the slice out). Click the center hole to toggle the full category table.
              For categories under 3%, no label is shown on the chart to keep it readable.
            </div>

            {pieData.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No category spending found for this timeframe.</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center", // ALWAYS centered
                  alignItems: "center",
                  paddingTop: 8,
                }}
              >
                <PieSvg
                  data={pieData}
                  // bigger chart
                  size={520}
                  selectedLabel={selectedCategory}
                  onSelectSlice={onSelectSlice}
                  onCenterClick={onCenterClick}
                  colorMap={colorMap}
                />
              </div>
            )}
          </div>

          {showRightPanel ? (
            <div style={cardStyle}>
              {/* Single category detail */}
              {selectedCategory && selectedRow ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Category Detail</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                    Click the same slice again to close, or click the center to open the full table.
                  </div>

                  <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.75)" }}>
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

              {/* Category detail table (opened by center click) */}
              {showTable ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Category Detail Table</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                    Click the center hole again to close. Click a row to open a single-category panel.
                    Click column headers to sort (toggle asc/desc).
                  </div>

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

        {/* Budget section */}
        <div style={{ marginTop: 12, ...cardStyle }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Budget Status</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            This section uses only values returned by search_user(): total spending and overall budget.
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.75)" }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Total spent</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>${formatMoney(data?.total ?? 0)}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.75)" }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{deltaTitle}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: deltaColor }}>
                {saved ? "+" : "-"}${formatMoney(Math.abs(delta))}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{deltaSubtitle}</div>
            </div>
          </div>
        </div>
      </div>
  );
}
