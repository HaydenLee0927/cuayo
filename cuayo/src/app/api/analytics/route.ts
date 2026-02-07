import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

type TimeOpt = "d" | "w" | "m";
type PyUserTotals = Record<string, number>;

function normalizeTime(x: string | null): TimeOpt {
  if (x === "d" || x === "w" || x === "m") return x;
  return "m";
}

function normalizeRefIso(x: string | null): string {
  const fallback = new Date("2019-02-15T00:00:00.000Z").toISOString();
  if (!x) return fallback;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

function normalizeMode(x: string | null): "short" | "detailed" {
  const v = (x ?? "short").toLowerCase();
  return v === "detailed" ? "detailed" : "short";
}

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python";

function runPython(args: {
  pyPath: string;
  userId: string;
  time: TimeOpt;
  refIso: string;
}): Promise<{ raw: PyUserTotals; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const pyCode = `
import json, datetime
from importlib.machinery import SourceFileLoader

mod = SourceFileLoader("rank_generator", r"""${args.pyPath}""").load_module()
ref = datetime.datetime.fromisoformat("${args.refIso}".replace("Z","+00:00")).replace(tzinfo=None)
out = mod.search_user("${args.userId}", "${args.time}", ref)
print(json.dumps(out))
`.trim();

    const child = spawn(PYTHON_BIN, ["-c", pyCode], {
      cwd: process.cwd(),
      env: process.env,
    });

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
        reject(new Error(`Python produced empty output. STDERR:\n${err}`));
        return;
      }
      try {
        const parsed = JSON.parse(out) as PyUserTotals;
        resolve({ raw: parsed, stdout: out, stderr: err });
      } catch {
        reject(new Error(`Invalid JSON from python:\n${out}\nSTDERR:\n${err}`));
      }
    });
  });
}

function runAdvicePython(args: {
  advicePyPath: string;
  payload: any;
}): Promise<{ advice: string; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const adviceCwd = path.dirname(args.advicePyPath);

    const child = spawn(PYTHON_BIN, [args.advicePyPath], {
      cwd: adviceCwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || `ai_advice.py exited with code ${code}`));
        return;
      }
      if (!out.trim()) {
        reject(new Error(`ai_advice.py produced empty output. STDERR:\n${err}`));
        return;
      }
      try {
        const parsed = JSON.parse(out) as { advice?: string };
        resolve({
          advice: String(parsed.advice ?? "").trim(),
          stdout: out,
          stderr: err,
        });
      } catch {
        reject(new Error(`Invalid JSON from ai_advice.py:\n${out}\nSTDERR:\n${err}`));
      }
    });

    child.stdin.write(JSON.stringify(args.payload));
    child.stdin.end();
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const userId = url.searchParams.get("userId") ?? "";
  const timeParam = url.searchParams.get("time") ?? url.searchParams.get("timeframe");
  const time = normalizeTime(timeParam);
  const refTime = normalizeRefIso(url.searchParams.get("refTime"));

  const mode = normalizeMode(url.searchParams.get("mode"));

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Missing parameters: userId" },
      { status: 400 }
    );
  }

  const pyPath = path.join(process.cwd(), "..", "data", "rank_generator.py");
  const csvPath = path.join(path.dirname(pyPath), "credit_card_transaction.csv");

  const advicePyPath = path.join(process.cwd(), "..", "data", "ai_advice.py");

  try {
    if (!fs.existsSync(pyPath)) {
      return NextResponse.json(
        { ok: false, error: `rank_generator.py not found at ${pyPath}` },
        { status: 500 }
      );
    }

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json(
        { ok: false, error: `credit_card_transaction.csv not found at ${csvPath}` },
        { status: 500 }
      );
    }

    if (!fs.existsSync(advicePyPath)) {
      return NextResponse.json(
        { ok: false, error: `ai_advice.py not found at ${advicePyPath}` },
        { status: 500 }
      );
    }

    const py = await runPython({ pyPath, userId, time, refIso: refTime });

    const total = Number((py.raw as any).total ?? 0);
    const budget = Number((py.raw as any).budget ?? 0);

    const pie = Object.entries(py.raw)
      .filter(([k]) => k !== "total" && k !== "budget")
      .map(([category, amount]) => {
        const amt = Number(amount ?? 0);
        return {
          category,
          amount: amt,
          proportion: total > 0 ? amt / total : 0,
        };
      })
      .filter((r) => Number.isFinite(r.amount) && r.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const budgetDelta = budget - total;

    // advice payload
    const advicePayload = {
      mode, // "short" | "detailed"
      userId,
      time,
      total,
      budget,
      budgetDelta,
      topCategories: pie.slice(0, 5),
    };

    let advice = "";
    try {
      const a = await runAdvicePython({ advicePyPath, payload: advicePayload });
      advice = a.advice;
    } catch {
      advice = "";
    }

    return NextResponse.json({
      ok: true,
      pie,
      total,
      budget,
      budgetDelta,
      advice,
      raw: py.raw,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
