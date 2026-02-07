// app/rankings/page.tsx
"use client";

import { useMemo, useState } from "react";

type TimeOpt = "Daily" | "Weekly" | "Monthly";
type CategoryOpt = "Food" | "Transportation" | "Savings" | "Entertainment" | "Flex";
type GroupOpt = "District" | "City" | "State" | "Gender" | "Age";

type Row = {
  rank: number;
  name: string;
  metricLabel: string;
  metricValue: number;
  trend: "▲" | "▼" | "•";
  isUser?: boolean;
  _score?: number; // internal only
};

function gaussian(x: number, mu: number, sigma: number) {
  const z = (x - mu) / sigma;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function makeCurve(mu: number, sigma: number, points = 220) {
  const start = mu - 4 * sigma;
  const end = mu + 4 * sigma;
  const step = (end - start) / (points - 1);
  const data: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const x = start + step * i;
    data.push({ x, y: gaussian(x, mu, sigma) });
  }
  return data;
}

function makeDemo(time: TimeOpt, category: CategoryOpt, group: GroupOpt) {
  const seed = Math.abs([...`${time}|${category}|${group}`].reduce((a, c) => a + c.charCodeAt(0), 0));
  const rng = (n: number) => {
    let t = (seed + n) % 2147483647;
    t = (t * 48271) % 2147483647;
    return t / 2147483647;
  };

  const N = group === "Gender" ? 4 : group === "Age" ? 7 : 40;
  const names =
    group === "Gender"
      ? ["Female", "Male", "Non-binary", "Prefer not to say"]
      : group === "Age"
      ? ["<18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"]
      : Array.from({ length: N }, (_, i) => `${group} ${String(i + 1).padStart(2, "0")}`);

  const metricLabel = category === "Savings" ? "Saved ($)" : "Spent ($)";

  const rows: Row[] = names.map((name, i) => {
    const base = 80 + 80 * rng(i + 1);
    const metricValue = Math.round((base + 20 * (rng(i + 11) - 0.5)) * 100) / 100;

    const score = category === "Savings" ? metricValue : 220 - metricValue;
    const trend: Row["trend"] = rng(i + 21) > 0.5 ? "▲" : "▼";

    return { rank: 0, name, metricLabel, metricValue, trend, _score: score };
  });

  // Put user at Top 1% (demo)
  const scores = rows.map((r) => r._score!).sort((a, b) => b - a);
  const userScore = scores[Math.max(0, Math.floor(0.01 * scores.length) - 1)] ?? scores[0];
  const userMetric = category === "Savings" ? userScore : 220 - userScore;

  rows.push({
    rank: 0,
    name: "You",
    metricLabel,
    metricValue: Math.round(userMetric * 100) / 100,
    trend: "•",
    isUser: true,
    _score: userScore,
  });

  rows.sort((a, b) => (b._score! - a._score!));
  rows.forEach((r, idx) => (r.rank = idx + 1));

  const userRank = rows.find((r) => r.isUser)!.rank;

  const allScores = rows.map((r) => r._score!);
  const mu = allScores.reduce((a, x) => a + x, 0) / allScores.length;
  const sigma = Math.sqrt(allScores.reduce((a, x) => a + (x - mu) * (x - mu), 0) / allScores.length) || 1;

  return { rows, mu, sigma, userScore, userRank, metricLabel };
}

function BellCurveSvg({
  mu,
  sigma,
  userScore,
  height = 220,
}: {
  mu: number;
  sigma: number;
  userScore: number;
  height?: number;
}) {
  const data = useMemo(() => makeCurve(mu, sigma, 220), [mu, sigma]);

  const minX = data[0].x;
  const maxX = data[data.length - 1].x;
  const maxY = Math.max(...data.map((d) => d.y));

  const w = 520;
  const h = height;

  const toX = (x: number) => ((x - minX) / (maxX - minX)) * w;
  const toY = (y: number) => h - (y / maxY) * (h * 0.92) - 8;

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.x).toFixed(2)} ${toY(d.y).toFixed(2)}`)
    .join(" ");

  const ux = toX(userScore);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* curve */}
      <path d={path} fill="none" stroke="black" strokeWidth="3" />
      {/* user marker */}
      <line x1={ux} x2={ux} y1={8} y2={h - 10} stroke="red" strokeWidth="4" />
      {/* label */}
      <text x={Math.min(ux + 8, w - 70)} y={20} fontSize="14" fontWeight="800" fill="red">
        Top 1%
      </text>
    </svg>
  );
}

export default function RankingsPage() {
  const [time, setTime] = useState<TimeOpt>("Weekly");
  const [category, setCategory] = useState<CategoryOpt>("Food");
  const [group, setGroup] = useState<GroupOpt>("City");

  const TOP_PCT = 1;

  const model = useMemo(() => makeDemo(time, category, group), [time, category, group]);

  return (
    <div className="w-full max-w-6xl rounded-3xl border-2 border-[var(--visa-navy)] bg-white p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-black text-neutral-900">Rankings</h1>
        <div className="text-xs text-neutral-500">Game-style distribution + leaderboard</div>
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
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-500">Category</div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryOpt)}
              >
                <option>Food</option>
                <option>Transportation</option>
                <option>Savings</option>
                <option>Entertainment</option>
                <option>Flex</option>
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-500">Group</div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={group}
                onChange={(e) => setGroup(e.target.value as GroupOpt)}
              >
                <option>District</option>
                <option>City</option>
                <option>State</option>
                <option>Gender</option>
                <option>Age</option>
              </select>
            </div>
          </div>
        </div>

        {/* Curve + badge */}
        <div className="col-span-12 md:col-span-5 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-neutral-900">Distribution</div>
            <div className="text-xs text-neutral-500">axes hidden</div>
          </div>

          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-2">
            <BellCurveSvg mu={model.mu} sigma={model.sigma} userScore={model.userScore} />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-semibold text-neutral-600">Your standing</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-black text-neutral-900">Top {TOP_PCT}%</div>
              <div className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-bold text-neutral-700">
                #{model.userRank} / {model.rows.length}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="col-span-12 md:col-span-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-bold text-neutral-900">Leaderboard</div>

          <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">{model.metricLabel}</th>
                  <th className="px-3 py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((r) => (
                  <tr
                    key={`${r.rank}-${r.name}`}
                    className={`border-t border-neutral-200 ${r.isUser ? "bg-neutral-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold">{r.rank}</td>
                    <td className="px-3 py-2">{r.isUser ? "👉 " : ""}{r.name}</td>
                    <td className="px-3 py-2">{r.metricValue.toFixed(2)}</td>
                    <td className="px-3 py-2">{r.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Score/delta hidden. Ordering is internal.
          </div>
        </div>
      </div>
    </div>
  );
}
