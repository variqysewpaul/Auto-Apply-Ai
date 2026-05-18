import streamlit as st
import json
import db

# Initialize Database
db.init_db()

st.set_page_config(page_title="AI Job Search Dashboard", page_icon="🚀", layout="wide")

st.title("🚀 Auto-Apply Dashboard")

# Read config
try:
    with open("config.json", "r") as f:
        config = json.load(f)
except Exception:
    st.error("Could not load config.json. Please ensure it exists.")
    st.stop()

tab1, tab2, tab3 = st.tabs(["📊 Dashboard", "📝 Application History", "⚙️ Configuration"])

with tab1:
    st.header("Overview")
    apps = db.get_all_applications()
    st.metric("Total Jobs Applied To", len(apps))
    
    st.info("To start the automation bot, run `python main.py` in your terminal.")

with tab2:
    st.header("Application History")
    apps = db.get_all_applications()
    if not apps:
        st.info("No applications yet. Start the bot to apply to jobs!")
    else:
        for app in apps:
            # db schema: id(0), title(1), company(2), location(3), date(4), letter(5), desc(6)
            with st.expander(f"{app[1]} at {app[2]} - Applied on {app[4]}"):
                st.markdown(f"**Location:** {app[3]}")
                st.markdown("### Generated Cover Letter")
                st.text(app[5])
                st.markdown("### Job Description")
                # Show first 500 characters of description to save space
                desc_preview = app[6][:500] + "..." if len(app[6]) > 500 else app[6]
                st.text(desc_preview)

with tab3:
    st.header("Search Configuration")
    st.write("Edit the job titles you want the bot to search for:")
    
    current_titles = ", ".join(config["search_criteria"]["titles"])
    new_titles = st.text_area("Job Titles (comma separated)", value=current_titles)
    
    if st.button("Save Config"):
        config["search_criteria"]["titles"] = [t.strip() for t in new_titles.split(",") if t.strip()]
        with open("config.json", "w") as f:
            json.dump(config, f, indent=4)
        st.success("Configuration Saved! The bot will use these titles on the next run.")
