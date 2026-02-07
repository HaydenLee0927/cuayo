# pages/profile.py
import streamlit as st
from datetime import date
import base64

st.set_page_config(page_title="Profile", layout="wide")

# -----------------------
# Session defaults
# -----------------------
st.session_state.setdefault("profile_img", None)            # bytes
st.session_state.setdefault("name_tag", "User#0000")
st.session_state.setdefault("birthday", date(2000, 1, 1))
st.session_state.setdefault("nickname", "닉네임")

# Demo "cards" (NOT service-specific)
# You can rename these labels later without changing logic.
st.session_state.setdefault(
    "connected_cards",
    [
        {"label": "Card 1", "connected": False, "account": "", "note": ""},
        {"label": "Card 2", "connected": False, "account": "", "note": ""},
        {"label": "Card 3", "connected": False, "account": "", "note": ""},
    ],
)
# track which card is in edit mode
st.session_state.setdefault("edit_card_idx", None)

# -----------------------
# CSS
# -----------------------
st.markdown(
    """
    <style>
      .block-container { padding-top: 0.8rem; }

      .profile-wrap { display:flex; justify-content:center; margin-top: 10px; }
      .profile-img {
        width: 140px; height: 140px;
        border-radius: 999px;
        object-fit: cover;
        border: 2px solid rgba(49,51,63,0.25);
      }

      .card-grid { margin-top: 6px; }
      .card-title { font-weight: 800; font-size: 15px; }
      .card-sub { font-size: 12px; opacity: 0.8; margin-top: 4px; }
      .pill {
        display:inline-block; padding: 2px 10px; border-radius: 999px;
        font-size: 12px; font-weight: 700; margin-left: 8px;
        border: 1px solid rgba(49,51,63,0.2);
      }
      .pill-on { background: rgba(0,200,0,0.08); }
      .pill-off { background: rgba(255,180,0,0.10); }

      /* make secondary buttons a bit tighter */
      .stButton button { border-radius: 10px; }
    </style>
    """,
    unsafe_allow_html=True,
)

# -----------------------
# Header + Back
# -----------------------
top = st.columns([1, 6], vertical_alignment="center")
with top[0]:
    if st.button("← Back", key="back_to_main"):
        st.switch_page("main.py")
with top[1]:
    st.title("👤 Profile")

# -----------------------
# Center layout
# -----------------------
_, center, _ = st.columns([1, 2, 1], vertical_alignment="top")

with center:
    # ---- Profile Image (center) ----
    if st.session_state.profile_img:
        b64 = base64.b64encode(st.session_state.profile_img).decode()
        st.markdown(
            f"""
            <div class="profile-wrap">
              <img class="profile-img" src="data:image/png;base64,{b64}">
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        # default placeholder (no file needed)
        st.markdown(
            """
            <div class="profile-wrap">
              <div class="profile-img"
                   style="display:flex;align-items:center;justify-content:center;font-size:48px;opacity:0.8;">
                👤
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    uploaded = st.file_uploader(
        "Upload profile photo",
        type=["png", "jpg", "jpeg", "webp"],
        accept_multiple_files=False,
        key="profile_uploader",
    )
    if uploaded:
        st.session_state.profile_img = uploaded.getvalue()

    st.write("")

    # ---- Name#tag ----
    st.session_state.name_tag = st.text_input(
        "Name#tag",
        value=st.session_state.name_tag,
        placeholder="예: Eugene#1234",
    )

    # ---- Birthday ----
    st.session_state.birthday = st.date_input(
        "Birthday",
        value=st.session_state.birthday,
    )

    st.write("")
    st.subheader("Connected cards (Demo)")

    # -----------------------
    # Connected cards UI (3 cards, generic)
    # -----------------------
    cards = st.session_state.connected_cards
    cols = st.columns(3, vertical_alignment="top")

    def status_pill(is_on: bool) -> str:
        if is_on:
            return '<span class="pill pill-on">Connected</span>'
        return '<span class="pill pill-off">Not connected</span>'

    for idx in range(3):
        with cols[idx]:
            card = cards[idx]
            st.markdown(
                f"""
                <div class="card-title">{card['label']}
                  {status_pill(card['connected'])}
                </div>
                <div class="card-sub">Account: {card['account'] if card['account'] else "—"}</div>
                <div class="card-sub">Note: {card['note'] if card['note'] else "—"}</div>
                """,
                unsafe_allow_html=True,
            )

            btn_row = st.columns([1, 1], vertical_alignment="center")
            with btn_row[0]:
                if card["connected"]:
                    if st.button("Disconnect", key=f"disc_{idx}"):
                        cards[idx] = {**card, "connected": False, "account": "", "note": ""}
                        st.session_state.connected_cards = cards
                        st.session_state.edit_card_idx = None
                        st.rerun()
                else:
                    if st.button("Connect", key=f"conn_{idx}"):
                        st.session_state.edit_card_idx = idx
                        st.rerun()

            with btn_row[1]:
                if st.button("Edit", key=f"edit_{idx}"):
                    st.session_state.edit_card_idx = idx
                    st.rerun()

    st.write("")

    # -----------------------
    # Edit / Connect form (appears under cards)
    # -----------------------
    if st.session_state.edit_card_idx is not None:
        idx = st.session_state.edit_card_idx
        card = cards[idx]

        st.markdown(f"### {card['label']} 설정")

        with st.form(key=f"card_form_{idx}", clear_on_submit=False):
            new_label = st.text_input("Card label", value=card["label"])
            account = st.text_input("Account (demo)", value=card["account"], placeholder="예: user123 / email / id 등")
            note = st.text_input("Note (optional)", value=card["note"], placeholder="예: linked via demo")
            submitted = st.form_submit_button("Save & Connect")
            cancel = st.form_submit_button("Cancel")

            if submitted:
                cards[idx] = {
                    "label": new_label.strip() or f"Card {idx+1}",
                    "connected": True,
                    "account": account.strip(),
                    "note": note.strip(),
                }
                st.session_state.connected_cards = cards
                st.session_state.edit_card_idx = None
                st.rerun()

            if cancel:
                st.session_state.edit_card_idx = None
                st.rerun()

    # ---- Nickname ----
    st.write("")
    st.session_state.nickname = st.text_input(
        "Nickname",
        value=st.session_state.nickname,
        placeholder="표시할 닉네임",
    )

    st.caption("Demo 연결: 실제 OAuth 없이 연결 상태/계정 문자열만 저장합니다 (session_state).")
