"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "../lib/UserProvider";

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e5e7eb"/>
      <stop offset="1" stop-color="#f3f4f6"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="32" fill="url(#g)"/>
  <circle cx="32" cy="26" r="12" fill="#9ca3af"/>
  <path d="M14 56c3.5-12 14-18 18-18s14.5 6 18 18" fill="#9ca3af"/>
</svg>`;
const DEFAULT_AVATAR_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(
  DEFAULT_AVATAR_SVG
)}`;

type TimeOpt = "d" | "w" | "m";
type GroupOpt = "District" | "City" | "State" | "Gender" | "Age";

type CategoryOpt =
  | "food_dining"
  | "travel"
  | "entertainment"
  | "personal_care"
  | "grocery"
  | "health_fitness"
  | "kids_pets"
  | "misc"
  | "gas_transport"
  | "home"
  | "shopping";

type Row = {
  rank: number;
  name: string;
  metricLabel: string;
  metricValue: number;
  trend: "▲" | "▼" | "•";
  isUser?: boolean;
};

type ApiModel = {
  rows: Row[];
  metricLabel: string;

  userSpentRatio: number; // 0~1
  userRank: number | null;
  numUsers: number;
  topPercent: number | null;

  error?: string;
};

function invNorm(p: number) {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687,
    138.357751867269, -30.66479806614716, 2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];

  const plow = 0.02425;
  const phigh = 1 - plow;

  let q: number, r: number;

  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  q = p - 0.5;
  r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

function gaussianStd(x: number) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

function StandardBellCurveSvg({
  topPercent,
  height = 220,
}: {
  topPercent: number | null;
  height?: number;
}) {
  const NAVY = "rgb(0, 32, 91)";
  const w = 520;
  const h = height;

  const minX = -4;
  const maxX = 4;
  const points = 220;
  const step = (maxX - minX) / (points - 1);

  const data = Array.from({ length: points }, (_, i) => {
    const x = minX + step * i;
    return { x, y: gaussianStd(x) };
  });

  const maxY = Math.max(...data.map((d) => d.y));
  const toX = (x: number) => ((x - minX) / (maxX - minX)) * w;
  const toY = (y: number) => h - (y / maxY) * (h * 0.92) - 8;

  const path = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${toX(d.x).toFixed(2)} ${toY(d.y).toFixed(2)}`
    )
    .join(" ");

  const showLine = topPercent !== null && topPercent !== undefined;

  let p = showLine ? 1 - topPercent! / 100 : 0.5;
  p = Math.min(0.999999, Math.max(0.000001, p));

  const z = invNorm(p);
  const ux = toX(Math.min(maxX, Math.max(minX, z)));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={path} fill="none" stroke={NAVY} strokeWidth="3" />
      {showLine ? (
        <>
          <line x1={ux} x2={ux} y1={8} y2={h - 10} stroke="red" strokeWidth="4" />
          <text x={Math.min(ux + 8, w - 200)} y={20} fontSize="14" fontWeight="800" fill="red">
            {`Top ${topPercent!.toFixed(1)}%`}
          </text>
        </>
      ) : (
        <text x={12} y={20} fontSize="14" fontWeight="800" fill="red">
          No spend in this category/timeframe
        </text>
      )}
    </svg>
  );
}

export default function RankingsPage() {
  const userId = "EuLe21";
  const { user } = useUser();

  const [time, setTime] = useState<TimeOpt>("w");
  const [category, setCategory] = useState<CategoryOpt>("food_dining");
  const [group, setGroup] = useState<GroupOpt>("City");
  const [groupValue, setGroupValue] = useState<string>("PA");

  const [model, setModel] = useState<ApiModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ 핵심: 복원 완료 전에는 저장하지 않기 위한 플래그
  const [filtersReady, setFiltersReady] = useState(false);

  // ✅ 1) 마운트 시 localStorage에서 필터 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cuayo_rank_filters_v1");
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          time: TimeOpt;
          category: CategoryOpt;
          group: GroupOpt;
          groupValue: string;
        }>;

        if (saved.time) setTime(saved.time);
        if (saved.category) setCategory(saved.category);
        if (saved.group) setGroup(saved.group);
        if (typeof saved.groupValue === "string") setGroupValue(saved.groupValue);
      }
    } catch {
      // ignore
    } finally {
      // ✅ 복원 시도 끝났으면 저장 허용
      setFiltersReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 2) 필터 변경 시 localStorage에 저장 (복원 완료 후에만)
  useEffect(() => {
    if (!filtersReady) return; // ✅ 이게 없으면 기본값이 저장되어 덮어씀
    try {
      localStorage.setItem(
        "cuayo_rank_filters_v1",
        JSON.stringify({
          time,
          category,
          group,
          groupValue: group === "State" ? groupValue : "",
        })
      );
    } catch {
      // ignore
    }
  }, [filtersReady, time, category, group, groupValue]);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams();

    params.set("userId", userId);
    params.set("time", time);
    params.set("category", category);
    params.set("group", group);

    if (group === "State" && groupValue.trim()) {
      params.set("groupValue", groupValue.trim().toUpperCase());
    }

    setLoading(true);
    setError("");

    fetch(`/api/rankings?${params.toString()}`, { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        if (!text.trim()) throw new Error("Empty response body from /api/rankings");
        try {
          return JSON.parse(text) as ApiModel;
        } catch {
          throw new Error(`Invalid JSON from /api/rankings:\n${text.slice(0, 400)}`);
        }
      })
      .then((m) => {
        if ((m as any)?.error) throw new Error((m as any).error);
        setModel(m);
      })
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        setError(String(e?.message || e));
        setModel(null);
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [userId, time, category, group, groupValue]);

  const topLabel = useMemo(() => {
    if (model?.topPercent == null) return "—";
    return `Top ${model.topPercent.toFixed(1)}%`;
  }, [model]);

  const spentRatioPct = useMemo(() => {
    const v = model?.userSpentRatio ?? 0;
    return `${(v * 100).toFixed(2)}%`;
  }, [model]);

  const userRowStyle = useMemo(
    () => ({
      backgroundColor: "rgba(0, 32, 91, 0.22)",
    }),
    []
  );

  const meInLeaderboard = useMemo(() => {
    if (!model?.rows) return false;
    return model.rows.some((r) => r.isUser === true || r.name === userId);
  }, [model, userId]);

  return (
    <div className="w-full max-w-6xl rounded-3xl border-2 border-[var(--visa-navy)] bg-white p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-black text-neutral-900">Rankings</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Filters */}
        <div className="col-span-12 md:col-span-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-bold text-neutral-900">Filters</div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-500">Time</div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={time}
                onChange={(e) => setTime(e.target.value as TimeOpt)}
              >
                <option value="d">daily (d)</option>
                <option value="w">weekly (w)</option>
                <option value="m">monthly (m)</option>
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-500">Category</div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryOpt)}
              >
                <option value="food_dining">food_dining</option>
                <option value="travel">travel</option>
                <option value="entertainment">entertainment</option>
                <option value="personal_care">personal_care</option>
                <option value="grocery">grocery</option>
                <option value="health_fitness">health_fitness</option>
                <option value="kids_pets">kids_pets</option>
                <option value="misc">misc</option>
                <option value="gas_transport">gas_transport</option>
                <option value="home">home</option>
                <option value="shopping">shopping</option>
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-500">Group</div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={group}
                onChange={(e) => setGroup(e.target.value as GroupOpt)}
              >
                <option value="District">District</option>
                <option value="City">City</option>
                <option value="State">State</option>
                <option value="Gender">Gender</option>
                <option value="Age">Age</option>
              </select>
            </div>

            {group === "State" ? (
              <div>
                <div className="mb-1 text-xs font-semibold text-neutral-500">State code</div>
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  value={groupValue}
                  onChange={(e) => setGroupValue(e.target.value)}
                  placeholder="PA"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Curve + summary */}
        <div className="col-span-12 md:col-span-5 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-neutral-900">Distribution</div>
          </div>

          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-2">
            {loading ? (
              <div className="p-4 text-sm text-neutral-600">Loading…</div>
            ) : error ? (
              <div className="p-4 text-sm font-semibold text-red-600">{error}</div>
            ) : model ? (
              <StandardBellCurveSvg topPercent={model.topPercent} />
            ) : (
              <div className="p-4 text-sm text-neutral-600">No data</div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-semibold text-neutral-600">Your standing</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-black text-neutral-900">{topLabel}</div>
              <div className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-bold text-neutral-700">
                #{model?.userRank ?? "—"} / {model?.numUsers ?? "—"}
              </div>
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              spent_ratio: <b>{spentRatioPct}</b>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="col-span-12 md:col-span-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-bold text-neutral-900">Leaderboard</div>

          <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-neutral-200">
            {loading ? (
              <div className="p-4 text-sm text-neutral-600">Loading…</div>
            ) : error ? (
              <div className="p-4 text-sm font-semibold text-red-600">{error}</div>
            ) : !model ? (
              <div className="p-4 text-sm text-neutral-600">No data</div>
            ) : model.rows.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">
                No transactions in this category/timeframe.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">{model.metricLabel}</th>
                    <th className="px-3 py-2">Trend</th>
                  </tr>
                </thead>

                <tbody>
                  {model.rows.map((r) => {
                    const isUser = r.isUser === true || r.name === userId;
                    const applyAnonUi = isUser && meInLeaderboard;

                    const displayName = applyAnonUi
                      ? user?.anonymousMode
                        ? user.nickname
                        : user.name
                      : r.name;

                    const displayImgSrc = applyAnonUi
                      ? user?.anonymousMode
                        ? DEFAULT_AVATAR_SRC
                        : (user.profileImage as string | undefined) || DEFAULT_AVATAR_SRC
                      : DEFAULT_AVATAR_SRC;

                    return (
                      <tr
                        key={`${r.rank}-${r.name}`}
                        className="border-t border-neutral-200"
                        style={isUser ? userRowStyle : undefined}
                      >
                        <td
                          className={`px-3 py-2 ${
                            isUser ? "font-extrabold text-[rgb(0,32,91)]" : "font-semibold"
                          }`}
                        >
                          {r.rank}
                        </td>

                        <td
                          className={`px-3 py-2 ${
                            isUser ? "font-extrabold text-[rgb(0,32,91)]" : "font-semibold"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={displayImgSrc}
                              alt=""
                              className={`h-6 w-6 rounded-full ${
                                isUser ? "ring-2 ring-[rgb(0,32,91)]" : "ring-1 ring-neutral-200"
                              }`}
                              draggable={false}
                            />
                            <span>{displayName}</span>
                          </div>
                        </td>

                        <td className="px-3 py-2">{(Number(r.metricValue) * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2">{r.trend}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
