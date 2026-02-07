import streamlit as st

# ---------- Page config ----------
st.set_page_config(
    page_title="Hackathon App",
    layout="wide",
)

# ---------- Session state ----------
if "page" not in st.session_state:
    st.session_state.page = "rankings"

def go(page):
    st.session_state.page = page

# ---------- CSS ----------
st.markdown(
    """
    <style>
    .nav-btn button {
        background: none;
        border: none;
        font-size: 18px;
        font-weight: 600;
        padding: 0.5rem 1rem;
        cursor: pointer;
    }
    .nav-btn button:hover {
        color: #4F8BF9;
    }
    .profile img {
        border-radius: 50%;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------- Top Navigation Bar ----------
cols = st.columns([2, 1.5, 1.5, 1.5, 6, 1])

# Logo (left)
with cols[0]:
    try:
        st.image("assets/logo.png", height=40)
    except:
        st.markdown("### 🚀 LOGO")

# Rankings
with cols[1]:
    st.markdown('<div class="nav-btn">', unsafe_allow_html=True)
    if st.button("Rankings"):
        st.switch_page("pages/ranking.py")
    st.markdown('</div>', unsafe_allow_html=True)

# Advices
with cols[2]:
    st.markdown('<div class="nav-btn">', unsafe_allow_html=True)
    if st.button("Advices"):
        go("advices")
    st.markdown('</div>', unsafe_allow_html=True)

# History
with cols[3]:
    st.markdown('<div class="nav-btn">', unsafe_allow_html=True)
    if st.button("History"):
        go("history")
    st.markdown('</div>', unsafe_allow_html=True)

# Profile (right)
with cols[5]:
    # default pfp (no file needed)
    st.markdown(
        """
        <div style="
            width:40px;height:40px;border-radius:50%;
            border:2px solid rgba(49,51,63,0.25);
            display:flex;align-items:center;justify-content:center;
            font-size:20px;">
            👤
        </div>
        """,
        unsafe_allow_html=True
    )

    if st.button(" ", key="go_profile"):
        st.switch_page("pages/profile.py")

st.divider()

# ---------- Page Content ----------
if st.session_state.page == "rankings":
    st.header("🏆 Rankings")
    st.write("랭킹 페이지 콘텐츠")

elif st.session_state.page == "advices":
    st.header("💡 Advices")
    st.write("조언 / 추천 페이지 콘텐츠")

elif st.session_state.page == "history":
    st.header("📜 History")
    st.write("히스토리 / 로그 페이지 콘텐츠")
