import streamlit as st
import json, db, subprocess, sys, os, datetime

db.init_db()

st.set_page_config(page_title="AutoApply", page_icon="💼", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.stApp {
    background: radial-gradient(circle at top left, #1a1b26 0%, #0f111a 100%);
    color: #e2e8f0;
}

/* Hide defaults */
#MainMenu, footer, header { visibility: hidden; display: none; }

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: rgba(15, 17, 26, 0.6) !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
}
[data-testid="stSidebar"] * { color: #cbd5e1 !important; }

/* ── Typography & Gradients ── */
.gradient-text {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
}

.page-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 2.75rem;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.02em;
}
.page-sub {
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    color: #94a3b8;
    margin-top: 10px;
    font-weight: 500;
}

.sidebar-wordmark {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
}

/* ── Tabs ── */
[data-testid="stTabs"] [role="tablist"] {
    background: transparent;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    gap: 32px;
}
[data-testid="stTabs"] [role="tab"] {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.9rem !important;
    font-weight: 600 !important;
    color: #64748b !important;
    padding: 16px 0px !important;
    border-bottom: 2px solid transparent !important;
    background: transparent !important;
    transition: all 0.3s ease !important;
}
[data-testid="stTabs"] [role="tab"]:hover { color: #e2e8f0 !important; }
[data-testid="stTabs"] [role="tab"][aria-selected="true"] {
    color: #e2e8f0 !important;
    border-bottom: 2px solid #00f2fe !important;
    text-shadow: 0 0 16px rgba(0,242,254,0.4) !important;
}
[data-testid="stTabs"] [role="tabpanel"] { padding-top: 32px; }

/* ── Metrics ── */
[data-testid="metric-container"] {
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 24px !important;
    box-shadow: 0 4px 24px -4px rgba(0,0,0,0.2);
    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
[data-testid="metric-container"]:hover {
    transform: translateY(-4px);
    border-color: rgba(0,242,254,0.3);
    box-shadow: 0 12px 32px -4px rgba(0,242,254,0.15);
}
[data-testid="stMetricLabel"] > div {
    font-family: 'Inter', sans-serif !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    color: #94a3b8 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
}
[data-testid="stMetricValue"] {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 2.5rem !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    background: linear-gradient(to bottom right, #ffffff, #94a3b8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* ── Section Labels ── */
.section-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 20px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}

/* ── Cards ── */
.app-card {
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.3s ease;
}
.app-card:hover {
    background: rgba(255,255,255,0.04);
    border-color: rgba(0,242,254,0.3);
    transform: translateX(4px);
    box-shadow: -4px 0 24px rgba(0,242,254,0.1);
}
.app-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 1.1rem; color: #f8fafc; }
.app-card-sub { font-size: 0.9rem; color: #94a3b8; margin-top: 6px; }
.app-card-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: #34d399;
    background: rgba(52,211,153,0.1);
    border: 1px solid rgba(52,211,153,0.2);
    border-radius: 6px;
    padding: 6px 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    box-shadow: 0 0 12px rgba(52,211,153,0.1);
}
.app-card-date { font-size: 0.75rem; color: #64748b; margin-top: 10px; font-weight: 500; }

/* ── Inputs & Controls ── */
.stTextInput > div > div > input,
.stTextArea > div > div > textarea {
    background: rgba(0,0,0,0.2) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 8px !important;
    color: #e2e8f0 !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.9rem !important;
    transition: all 0.3s ease !important;
}
.stTextInput > div > div > input:focus,
.stTextArea > div > div > textarea:focus {
    border-color: #00f2fe !important;
    box-shadow: 0 0 0 2px rgba(0,242,254,0.2) !important;
    background: rgba(0,0,0,0.4) !important;
}
label { font-family: 'Inter', sans-serif !important; font-size: 0.85rem !important; font-weight: 500 !important; color: #cbd5e1 !important; margin-bottom: 6px !important; }

/* ── Buttons ── */
.stButton > button {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 8px !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.9rem !important;
    font-weight: 700 !important;
    padding: 12px 24px !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 14px rgba(0,242,254,0.3) !important;
}
.stButton > button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(0,242,254,0.5) !important;
    filter: brightness(1.1) !important;
}

/* ── Expanders ── */
[data-testid="stExpander"] {
    background: rgba(255,255,255,0.02) !important;
    border: 1px solid rgba(255,255,255,0.05) !important;
    border-radius: 12px !important;
    margin-bottom: 12px !important;
    transition: all 0.3s ease !important;
}
[data-testid="stExpander"]:hover { border-color: rgba(255,255,255,0.15) !important; }
[data-testid="stExpander"] summary {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 600 !important;
    color: #e2e8f0 !important;
    padding: 16px !important;
}

/* ── Boxes ── */
.letter-box, .desc-box {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 20px;
    font-size: 0.9rem;
    line-height: 1.7;
    color: #cbd5e1;
    white-space: pre-wrap;
    overflow-y: auto;
}
.letter-box { max-height: 240px; }
.desc-box { max-height: 160px; }

/* ── Status Indicators ── */
.status-running {
    display: inline-flex; align-items: center; gap: 10px;
    font-weight: 600; font-size: 0.9rem; color: #34d399;
    background: rgba(52,211,153,0.1); padding: 8px 16px; border-radius: 20px;
    border: 1px solid rgba(52,211,153,0.2);
}
.status-stopped {
    display: inline-flex; align-items: center; gap: 10px;
    font-weight: 600; font-size: 0.9rem; color: #94a3b8;
    background: rgba(148,163,184,0.1); padding: 8px 16px; border-radius: 20px;
    border: 1px solid rgba(148,163,184,0.2);
}
.dot-on {
    width: 8px; height: 8px; border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 12px #34d399;
    animation: pulse 2s infinite;
}
.dot-off { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }

@keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52,211,153, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(52,211,153, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52,211,153, 0); }
}

.sidebar-card {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
}
.sidebar-name { font-weight: 700; font-size: 1rem; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif;}
.sidebar-detail { font-size: 0.8rem; color: #94a3b8; margin-top: 6px; }

/* Divider */
hr { border-color: rgba(255,255,255,0.08) !important; margin: 32px 0 !important; }
[data-testid="stCheckbox"] label { font-size: 0.9rem !important; color: #cbd5e1 !important; }

.pill {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    background: rgba(255,255,255,0.05);
    color: #94a3b8;
    border-radius: 4px;
    padding: 4px 8px;
    margin: 4px 4px 4px 0;
}
.pill-active {
    background: rgba(0,242,254,0.1);
    color: #00f2fe;
    border: 1px solid rgba(0,242,254,0.2);
}
</style>
""", unsafe_allow_html=True)

# ── Helpers ──────────────────────────────────────────────────────────────────
def load_config():
    try:
        with open("config.json") as f: return json.load(f)
    except: return None

def save_config(cfg):
    with open("config.json", "w") as f: json.dump(cfg, f, indent=4)

def get_stats(apps):
    total = len(apps)
    companies = len(set(a[2] for a in apps)) if apps else 0
    today = datetime.date.today().strftime("%Y-%m-%d")
    today_count = sum(1 for a in apps if a[4].startswith(today))
    titles = {}
    for a in apps: titles[a[1]] = titles.get(a[1], 0) + 1
    top = max(titles, key=titles.get) if titles else "—"
    return total, companies, today_count, top

config = load_config()
if not config:
    st.error("config.json not found.")
    st.stop()

apps = db.get_all_applications()
total, companies, today_count, top_title = get_stats(apps)
BOT_LOCK = "bot.lock"
bot_running = os.path.exists(BOT_LOCK)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"""
    <div style='padding: 24px 0 24px 0; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 24px;'>
        <div class='sidebar-wordmark gradient-text'>AutoApply.</div>
        <div class='sidebar-sub'>Automated Job Submission System</div>
    </div>
    """, unsafe_allow_html=True)

    # Bot status
    st.markdown("<div class='section-label'>Bot Control</div>", unsafe_allow_html=True)
    if bot_running:
        st.markdown("<div class='status-running'><div class='dot-on'></div>System Active</div>", unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("STOP BOT", use_container_width=True):
            if os.path.exists(BOT_LOCK): os.remove(BOT_LOCK)
            st.rerun()
    else:
        st.markdown("<div class='status-stopped'><div class='dot-off'></div>System Idle</div>", unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("LAUNCH BOT", use_container_width=True):
            with open(BOT_LOCK, "w") as f: f.write("running")
            subprocess.Popen(
                [sys.executable, "main.py"],
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0
            )
            st.rerun()

    st.divider()

    # Profile
    st.markdown("<div class='section-label'>Operator Profile</div>", unsafe_allow_html=True)
    st.markdown(f"""
    <div class='sidebar-card'>
        <div class='sidebar-name'>{config.get('name','—')}</div>
        <div class='sidebar-detail'>{config.get('email','—')}</div>
        <div class='sidebar-detail'>{config.get('phone','—')}</div>
        <div class='sidebar-detail'>{config.get('address','—')}</div>
    </div>
    """, unsafe_allow_html=True)

    st.divider()
    st.markdown(f"<div class='sidebar-detail' style='text-align:center;'>{datetime.datetime.now().strftime('%Y-%m-%d  %H:%M')}</div>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("REFRESH", use_container_width=True): st.rerun()

# ── Page header ───────────────────────────────────────────────────────────────
st.markdown(f"""
<div style='padding: 24px 0 32px 0; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 32px;'>
    <div class='page-title'><span class='gradient-text'>Job Search Intelligence</span></div>
    <div class='page-sub'>Operator: {config.get('name','—')} &nbsp;|&nbsp; Engine: Llama 3.3 70B</div>
</div>
""", unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["DASHBOARD", "APPLICATIONS", "CONFIGURATION"])

# ══ TAB 1 — DASHBOARD ════════════════════════════════════════════════════════
with tab1:
    # Big stats row
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Total Applied", total)
    with c2:
        st.metric("Companies", companies)
    with c3:
        st.metric("Applied Today", today_count)
    with c4:
        st.metric("Top Role", top_title if len(top_title) < 18 else top_title[:16]+"…")

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown("<div class='section-label'>Recent Activity</div>", unsafe_allow_html=True)
    if not apps:
        st.info("No applications yet — launch the bot to begin.")
    else:
        for app in apps[:10]:
            st.markdown(f"""
            <div class='app-card'>
                <div>
                    <div class='app-card-title'>{app[1]}</div>
                    <div class='app-card-sub'>{app[2]} &nbsp;·&nbsp; {app[3]}</div>
                </div>
                <div style='text-align:right;'>
                    <div class='app-card-badge'>Applied</div>
                    <div class='app-card-date'>{app[4][:10]}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

# ══ TAB 2 — APPLICATIONS ═════════════════════════════════════════════════════
with tab2:
    col_a, col_b = st.columns([3, 1])
    with col_a:
        st.markdown("<div class='section-label'>All Application Records</div>", unsafe_allow_html=True)
    with col_b:
        q = st.text_input("Search", placeholder="Filter…", label_visibility="collapsed")

    if not apps:
        st.info("No applications on record yet.")
    else:
        filtered = [a for a in apps if q.lower() in a[1].lower() or q.lower() in a[2].lower()] if q else apps
        st.markdown(f"<div class='sidebar-detail' style='margin-bottom:16px;'>{len(filtered)} records</div>", unsafe_allow_html=True)

        for app in filtered:
            with st.expander(f"{app[1]}  ·  {app[2]}  ·  {app[4][:10]}"):
                r1, r2 = st.columns(2)
                r1.markdown(f"**Location** — {app[3]}")
                r2.markdown(f"**Date** — {app[4]}")
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown("<div class='section-label'>Cover Letter</div>", unsafe_allow_html=True)
                st.markdown(f"<div class='letter-box'>{app[5]}</div>", unsafe_allow_html=True)
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown("<div class='section-label'>Job Description</div>", unsafe_allow_html=True)
                desc = app[6][:600] + "…" if len(app[6]) > 600 else app[6]
                st.markdown(f"<div class='desc-box'>{desc}</div>", unsafe_allow_html=True)

# ══ TAB 3 — CONFIGURATION ════════════════════════════════════════════════════
with tab3:
    st.markdown("<div class='section-label'>Profile & Search Settings</div>", unsafe_allow_html=True)

    c1, c2 = st.columns(2, gap="large")

    with c1:
        st.markdown("**Personal Info**")
        name     = st.text_input("Full Name",    value=config.get("name",""))
        email    = st.text_input("Email",        value=config.get("email",""))
        phone    = st.text_input("Phone",        value=config.get("phone",""))
        address  = st.text_input("Address",      value=config.get("address",""))
        city     = st.text_input("City (used in apply forms)", value=config.get("city","Durban, South Africa"),
                                 help="Typed into LinkedIn's location field during Easy Apply. Should match a LinkedIn location suggestion.")
        github   = st.text_input("GitHub",       value=config.get("github_url",""))
        linkedin = st.text_input("LinkedIn",     value=config.get("linkedin_url",""))

    with c2:
        st.markdown("**Search Targets**")
        titles_val = ", ".join(config["search_criteria"]["titles"])
        new_titles = st.text_area("Job Titles", value=titles_val, height=110)
        locs_val   = ", ".join(config["search_criteria"].get("locations",["Remote"]))
        new_locs   = st.text_input("Locations",  value=locs_val)

        st.markdown("<br>**Filters**", unsafe_allow_html=True)
        st.markdown("<div class='section-label'>Work Type</div>", unsafe_allow_html=True)
        wt_col1, wt_col2 = st.columns(2)
        remote_only = wt_col1.checkbox("Remote",   value=config["search_criteria"].get("remote_only", True))
        onsite      = wt_col2.checkbox("On-site",  value=config["search_criteria"].get("onsite", False))
        hybrid      = wt_col1.checkbox("Hybrid",   value=config["search_criteria"].get("hybrid", False))

        st.markdown("<div class='section-label' style='margin-top:10px;'>Job Type</div>", unsafe_allow_html=True)
        jt_col1, jt_col2 = st.columns(2)
        full_time   = jt_col1.checkbox("Full-time",   value=config["search_criteria"].get("full_time", False))
        part_time   = jt_col2.checkbox("Part-time",   value=config["search_criteria"].get("part_time", True))
        contract    = jt_col1.checkbox("Contract",    value=config["search_criteria"].get("contract", False))
        internships = jt_col2.checkbox("Internship",  value=config["search_criteria"].get("internships", True))

        st.markdown("<div class='section-label' style='margin-top:10px;'>Experience Level</div>", unsafe_allow_html=True)
        el_col1, el_col2 = st.columns(2)
        entry_level = el_col1.checkbox("Entry Level",  value=config["search_criteria"].get("entry_level", True))
        associate   = el_col2.checkbox("Associate",    value=config["search_criteria"].get("associate", False))
        mid_senior  = el_col1.checkbox("Mid-Senior",   value=config["search_criteria"].get("mid_senior", False))

    st.divider()
    st.markdown("**Skills**")
    skills_val = ", ".join(config.get("skills", []))
    new_skills = st.text_area("Skills (comma-separated)", value=skills_val, height=80)

    st.markdown("<br>", unsafe_allow_html=True)
    sc, sm = st.columns([1, 3])
    with sc:
        if st.button("SAVE CHANGES", use_container_width=True):
            config.update({
                "name": name, "email": email, "phone": phone,
                "address": address, "city": city,
                "github_url": github, "linkedin_url": linkedin,
                "skills": [s.strip() for s in new_skills.split(",") if s.strip()]
            })
            config["search_criteria"].update({
                "titles":      [t.strip() for t in new_titles.split(",") if t.strip()],
                "locations":   [l.strip() for l in new_locs.split(",") if l.strip()],
                "remote_only": remote_only, "onsite": onsite, "hybrid": hybrid,
                "full_time":   full_time,   "part_time": part_time,
                "contract":    contract,    "internships": internships,
                "entry_level": entry_level, "associate": associate,
                "mid_senior":  mid_senior,
            })
            save_config(config)
            sm.success("Saved — active on next bot run.")
