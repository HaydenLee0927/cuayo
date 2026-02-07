import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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

type TimeOpt = "d" | "w" | "m";
type GroupOpt = "District" | "City" | "State" | "Gender" | "Age";

type DisplayEntry = {
  name: string;
  rank: number;
  spent_ratio: number;
};

type PyPayload = {
  userId: string;
  userName: string | null;
  userSpentRatio: number;
  userRank: number | null;
  numUsers: number;
  topUsers: string[];
  topSpentRatios: number[];
  displayEntries?: DisplayEntry[];
  topPercent: number | null;
  refTime?: string;
};

type Row =
  | {
      kind: "data";
      rank: number;
      name: string;
      metricLabel: string;
      metricValue: number;
      trend: "▲" | "▼" | "•";
      isUser?: boolean;
    }
  | { kind: "ellipsis"; id: string };

function resolvePyPath() {
  const candidates = [
    path.join(process.cwd(), "data", "rank_generator.py"),
    path.join(process.cwd(), "..", "data", "rank_generator.py"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function runPython(args: {
  userId: string;
  category: CategoryOpt;
  time: TimeOpt;
  state?: string | null;
}): Promise<PyPayload> {
  return new Promise((resolve, reject) => {
    const pyPath = resolvePyPath();

    const pyArgs: string[] = [
      pyPath,
      "--user_id",
      args.userId,
      "--category",
      args.category,
      "--time",
      args.time,
    ];

    if (args.state) pyArgs.push("--state", args.state);

    const child = spawn("python", pyArgs, { cwd: process.cwd() });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || `python exited with code ${code}`));
        return;
      }
      if (!out.trim()) {
        reject(new Error("Python produced empty output"));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`Invalid JSON from python:\n${out.slice(0, 300)}`));
      }
    });
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const userId = url.searchParams.get("userId");
    const category = url.searchParams.get("category") as CategoryOpt;
    const time = url.searchParams.get("time") as TimeOpt;
    const group = url.searchParams.get("group") as GroupOpt;
    const groupValue = url.searchParams.get("groupValue");

    if (!userId || !category || !time) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const state =
      group === "State" && groupValue ? groupValue.toUpperCase() : null;

    const py = await runPython({ userId, category, time, state });

    const meName = py.userName; 
    
    const entries: DisplayEntry[] = Array.isArray(py.displayEntries)
      ? py.displayEntries
      : [];

    const fallbackEntries: DisplayEntry[] =
      entries.length > 0
        ? entries
        : py.topUsers.map((name, i) => ({
            name,
            rank: i + 1,
            spent_ratio: py.topSpentRatios[i] ?? 0,
          }));

    const top3 = fallbackEntries
      .filter((e) => e.rank <= 3)
      .sort((a, b) => a.rank - b.rank);

    const userRank = py.userRank;
    const userBlock =
      userRank !== null && userRank > 3
        ? fallbackEntries.filter((e) => e.rank > 3).sort((a, b) => a.rank - b.rank)
        : [];

    const needsEllipsis = userRank !== null && userRank > 5;

    const rows: Row[] = [];

    for (const e of top3) {
      rows.push({
        kind: "data",
        rank: e.rank,
        name: e.name,
        metricLabel: "Spent Ratio",
        metricValue: e.spent_ratio,
        trend: "•",
        isUser: meName ? e.name === meName : false,
      });
    }

    if (userBlock.length > 0) {
      if (needsEllipsis) rows.push({ kind: "ellipsis", id: "gap-top-to-user" });

      for (const e of userBlock) {
        rows.push({
          kind: "data",
          rank: e.rank,
          name: e.name,
          metricLabel: "Spent Ratio",
          metricValue: e.spent_ratio,
          trend: "•",
          isUser: meName ? e.name === meName : false,
        });
      }
    }

    return NextResponse.json({
      rows,
      metricLabel: "Spent Ratio",
      userSpentRatio: py.userSpentRatio,
      userRank: py.userRank,
      numUsers: py.numUsers,
      topPercent: py.topPercent,
      userName: py.userName,
      refTime: py.refTime ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
