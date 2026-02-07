import json
import os
import sys
import datetime
from typing import Any, Dict, List

from openai import OpenAI

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def read_payload() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def load_store(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def atomic_write(path: str, data: List[Dict[str, Any]]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def find_match(entries, payload) -> str:
    for e in entries:
        if not isinstance(e, dict):
            continue
        if e.get("payload") == payload and isinstance(e.get("advice"), str):
            adv = e["advice"].strip()
            if adv:
                return adv
    return ""


def build_prompt(payload: Dict[str, Any]) -> Dict[str, Any]:
    mode = str(payload.get("mode", "short")).lower()
    if mode not in ("short", "detailed"):
        mode = "short"

    user_id = payload.get("userId", "")
    time = payload.get("time", "")
    total = payload.get("total", 0)
    budget = payload.get("budget", 0)
    budget_delta = payload.get("budgetDelta", 0)
    top_categories = payload.get("topCategories", [])

    if mode == "short":
        instruction = (
            "Write a short, practical advice in 2-4 sentences. "
            "No greetings. No bullet points. No emojis. "
            "Give 1-2 concrete actions. Output ONLY the advice text."
        )
        max_tokens = 150
    else:
        instruction = (
            "Write a detailed spending analysis and guidance (not chatbotty).\n"
            "Structure:\n"
            "1) One-sentence diagnosis\n"
            "2) Key observations (3-6 bullets max)\n"
            "3) Specific adjustments by category (3-6 bullets max)\n"
            "4) A simple plan for next week (3 steps)\n"
            "No greetings. No emojis.\n"
            "Output ONLY the text."
        )
        max_tokens = 900

    prompt = f"""
You are a precise personal finance coach.

Context:
- userId: {user_id}
- timeframe: {time}
- total spend: {total}
- budget: {budget}
- budgetDelta (budget - total): {budget_delta}
- topCategories: {json.dumps(top_categories, ensure_ascii=False)}

{instruction}
""".strip()

    return {"mode": mode, "prompt": prompt, "max_tokens": max_tokens}

def load_api_key(path="api.txt"):
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read().strip()

def generate_advice(prompt: str, max_tokens: int) -> str:
    api_key = load_api_key()
    model = os.getenv("OPENAI_MODEL", "gpt-5.2")
    
    client = OpenAI(api_key=api_key)
    resp = client.responses.create(
        model=model,
        input=prompt,
        max_output_tokens=max_tokens,
    )
    text = resp.output_text.strip() if hasattr(resp, "output_text") else ""
    return text


def main():
    payload = read_payload()

    store_path = os.getenv("AI_ADVICE_STORE_PATH")
    if not store_path:
        store_path = os.path.join(os.path.dirname(__file__), "response.json")

    entries = load_store(store_path)

    # 1) cache from response.json
    hit = find_match(entries, payload)
    if hit:
        print(json.dumps({"ok": True, "advice": hit, "cached": True}, ensure_ascii=False))
        return

    # 2) generate if not
    p = build_prompt(payload)
    advice = generate_advice(p["prompt"], p["max_tokens"])

    # 3) store every time
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    entries.append(
        {
            "createdAt": now,
            "payload": payload,
            "advice": advice,
        }
    )

    try:
        atomic_write(store_path, entries)
    except Exception:
        pass

    print(json.dumps({"ok": True, "advice": advice, "cached": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
