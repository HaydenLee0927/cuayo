# pages/rankings.py
import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from math import erf, sqrt

st.set_page_config(page_title="Rankings", layout="wide")

# -----------------------
# Session defaults (filters)
# -----------------------
st.session_state.setdefault("rank_time", "Weekly")
st.session_state.setdefault("rank_category", "Food")
st.session_state.setdefault("rank_group", "City")

# Fixed user marker (no UI)
USER_LABEL = "You"
USER_TOP_PERCENTILE = 1  # "Top 1%"

# -----------------------
# Math helpers (no scipy)
# -----------------------
def normal_cdf(z: float) -> float:
    return 0.5 * (1.0 + erf(z / sqrt(2.0)))

def percentile_to_z_top(pct_top: float) -> float:
    target = 1.0 - pct_top / 100.0
    lo, hi = -8.0, 8.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if normal_cdf(mid) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

# -----------------------
# Demo rankings generator
# -----------------------
def make_demo_rankings(time_choice: str, category: str, group: str, n: int = 40):
    seed = abs(hash((time_choice, category, group))) % (2**32)
    rng = np.random.default_rng(seed)

    if group == "District":
        groups = [f"District {i:02d}" for i in range(1, n + 1)]
    elif group == "City":
        groups = [f"City {i:02d}" for i in range(1, n + 1)]
    elif group == "State":
        groups = [f"State {i:02d}" for i in range(1, n + 1)]
    elif group == "Gender":
        groups = ["Female", "Male", "Non-binary", "Prefer not to say"]
        n = len(groups)
    elif group == "Age":
        groups = ["<18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"]
        n = len(groups)
    else:
        groups = [f"{group} {i:02d}" for i in range(1, n + 1)]

    base = rng.normal(loc=100, scale=18, size=n).clip(10, 220)
    metric = (base + rng.normal(0, 8, size=n)).clip(0, None)

    if category == "Savings":
        score = metric
        metric_name = "Saved ($)"
    else:
        score = 220 - metric
        metric_name = "Spent ($)"

    # Trend only (no delta shown)
    if time_choice == "Daily":
        delta = rng.normal(0, 4, size=n)
    elif time_choice == "Weekly":
        delta = rng.normal(0, 8, size=n)
    else:
        delta = rng.normal(0, 12, size=n)

    df = pd.DataFrame({
        "Group": groups,
        metric_name: np.round(metric, 2),
        "Score": np.round(score, 2),
        "Trend": np.where(delta >= 0, "▲", "▼"),
    })

    meta = {"metric_name": metric_name}
    return df, meta

# -----------------------
# Insert user + rank (uses Score internally)
# -----------------------
def add_user_and_rank(df: pd.DataFrame, meta: dict, user_label: str, user_percentile_top: float):
    scores = df["Score"].to_numpy(dtype=float)
    mu = float(scores.mean())
    sigma = float(scores.std(ddof=0))
    if sigma < 1e-9:
        sigma = 1.0

    z = percentile_to_z_top(user_percentile_top)
    user_score = mu + z * sigma

    metric_name = meta["metric_name"]
    if metric_name == "Saved ($)":
        user_metric = user_score
    else:
        user_metric = 220 - user_score

    user_row = {
        "Group": user_label,
        metric_name: round(float(user_metric), 2),
        "Score": round(float(user_score), 2),
        "Trend": "•",
        "_is_user": True,
    }

    df2 = df.copy()
    df2["_is_user"] = False
    df2 = pd.concat([df2, pd.DataFrame([user_row])], ignore_index=True)

    df2 = df2.sort_values("Score", ascending=False).reset_index(drop=True)
    df2.insert(0, "Rank", np.arange(1, len(df2) + 1))

    user_idx = int(df2.index[df2["_is_user"]].tolist()[0])
    user_rank = int(df2.loc[user_idx, "Rank"])
    return df2, mu, sigma, float(user_row["Score"]), user_rank

# -----------------------
# Bell curve chart (Altair) - NO AXES
# -----------------------
def bell_curve_chart(mu: float, sigma: float, user_score: float, user_pct_top: float):
    xs = np.linspace(mu - 4 * sigma, mu + 4 * sigma, 400)
    ys = (1.0 / (sigma * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((xs - mu) / sigma) ** 2)

    df_curve = pd.DataFrame({"Score": xs, "Density": ys})
    df_marker = pd.DataFrame({
        "Score": [user_score],
        "Density": [ys.max()],
        "Label": [f"Top {int(user_pct_top)}%"],
    })

    curve = alt.Chart(df_curve).mark_line().encode(
        x=alt.X("Score:Q", axis=None),
        y=alt.Y("Density:Q", axis=None),
    )

    marker = alt.Chart(df_marker).mark_rule(color="red", strokeWidth=3).encode(x="Score:Q")
    text = alt.Chart(df_marker).mark_text(align="left", dx=6, dy=-6).encode(
        x="Score:Q", y="Density:Q", text="Label:N"
    )

    return (curve + marker + text).properties(height=240).configure_view(strokeWidth=0)

# -----------------------
# CSS for "game rank" badge
# -----------------------
st.markdown(
    """
    <style>
      .rank-badge {
        margin-top: 10px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(49,51,63,0.18);
        background: rgba(255,255,255,0.02);
      }
      .rank-title { font-size: 14px; font-weight: 700; opacity: 0.85; }
      .rank-main { font-size: 28px; font-weight: 900; margin-top: 4px; }
      .rank-sub { font-size: 12px; opacity: 0.75; margin-top: 6px; }
      .chip {
        display:inline-block; padding: 2px 10px; border-radius: 999px;
        font-size: 12px; font-weight: 800; margin-left: 8px;
        border: 1px solid rgba(49,51,63,0.2);
      }
    </style>
    """,
    unsafe_allow_html=True
)

# -----------------------
# Header
# -----------------------
top = st.columns([1, 6], vertical_alignment="center")
with top[0]:
    if st.button("← Back"):
        st.switch_page("main.py")
with top[1]:
    st.title("🏆 Rankings")

st.divider()

# =======================
# Layout: LEFT filters / RIGHT content
# =======================
left, right = st.columns([1.35, 4.65], vertical_alignment="top")

with left:
    st.subheader("Filters")

    st.session_state.rank_time = st.selectbox(
        "Time",
        ["Daily", "Weekly", "Monthly"],
        index=["Daily", "Weekly", "Monthly"].index(st.session_state.rank_time),
    )

    st.session_state.rank_category = st.selectbox(
        "Category",
        ["Food", "Transportation", "Savings", "Entertainment", "Flex"],
        index=["Food", "Transportation", "Savings", "Entertainment", "Flex"]
        .index(st.session_state.rank_category),
    )

    st.session_state.rank_group = st.selectbox(
        "Group",
        ["District", "City", "State", "Gender", "Age"],
        index=["District", "City", "State", "Gender", "Age"]
        .index(st.session_state.rank_group),
    )

    st.caption("옵션을 바꾸면 자동으로 갱신됩니다.")

with right:
    raw_df, meta = make_demo_rankings(
        st.session_state.rank_time,
        st.session_state.rank_category,
        st.session_state.rank_group,
    )

    df, mu, sigma, user_score, user_rank = add_user_and_rank(
        raw_df, meta,
        user_label=USER_LABEL,
        user_percentile_top=float(USER_TOP_PERCENTILE),
    )

    # Right area: curve (left) + full leaderboard (right)
    col_curve, col_full = st.columns([2.2, 2.8], vertical_alignment="top")

    with col_curve:
        st.markdown("#### Distribution")
        st.altair_chart(
            bell_curve_chart(mu, sigma, user_score, float(USER_TOP_PERCENTILE)),
            use_container_width=True,
        )

        # "game-like" rank summary under curve
        st.markdown(
            f"""
            <div class="rank-badge">
              <div class="rank-title">Your standing</div>
              <div class="rank-main">Top {USER_TOP_PERCENTILE}% <span class="chip">#{user_rank} / {len(df)}</span></div>
              <div class="rank-sub">This is shown like a game rank badge. (Demo)</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_full:
        st.markdown("#### Leaderboard")
        show = df.copy()
        show["Group"] = np.where(show["_is_user"], "👉 " + show["Group"].astype(str), show["Group"].astype(str))

        # No Score, no Delta
        st.dataframe(
            show[["Rank", "Group", meta["metric_name"], "Trend"]],
            use_container_width=True,
            hide_index=True,
        )
