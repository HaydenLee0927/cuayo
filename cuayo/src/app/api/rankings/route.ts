import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

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

type PyPayload = {
  userSpentRatio: number;
  userRank: number | null;
  numUsers: number;
  topUsers: string[];
  topSpentRatios: number[];
  topPercent: number | null;
};

function runPython(args: {
  userId: string;
  category: CategoryOpt;
  time: TimeOpt;
  state?: string | null;
}): Promise<PyPayload> {
  return new Promise((resolve, reject) => {
    const pyPath = path.join(process.cwd(), "..", "data", "rank_generator.py");

    const pyArgs: string[] = [
      pyPath,
      "--user_id",
      args.userId,
      "--category",
      args.category,
      "--time",
      args.time,
    ];

    if (args.state) {
      pyArgs.push("--state", args.state);
    }

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
        reject(new Error(`Invalid JSON from python:\n${out}`));
      }
    });
  });
}

export async function GET(req: Request) {
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

  try {
    const py = await runPython({
      userId,
      category,
      time,
      state,
    });

    const rows = py.topUsers.map((u, i) => ({
      rank: i + 1,
      name: u,
      metricLabel: "Spent Ratio",
      metricValue: py.topSpentRatios[i] ?? 0,
      trend: "•",
      isUser: u === userId,
    }));

    return NextResponse.json({
      rows,
      metricLabel: "Spent Ratio",
      userSpentRatio: py.userSpentRatio,
      userRank: py.userRank,
      numUsers: py.numUsers,
      topPercent: py.topPercent,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
