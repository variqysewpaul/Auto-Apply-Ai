import sqlite3
import datetime
import os
import requests
import json

DB_NAME = "applications.db"

# ── Supabase REST Integration Helpers ─────────────────────

# Simple dotenv parser to load keys from .env in standard Python
def load_dotenv():
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    # Strip any potential quotes
                    val = val.strip().strip("'").strip('"')
                    os.environ[key.strip()] = val

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_USER_EMAIL = os.getenv("SUPABASE_USER_EMAIL")
SUPABASE_USER_PASSWORD = os.getenv("SUPABASE_USER_PASSWORD")

_jwt_token = None
_user_id = None

def get_auth_headers():
    global _jwt_token, _user_id
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
        
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    if _jwt_token:
        headers["Authorization"] = f"Bearer {_jwt_token}"
        return headers
        
    if SUPABASE_USER_EMAIL and SUPABASE_USER_PASSWORD:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
            resp = requests.post(
                url, 
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}, 
                json={"email": SUPABASE_USER_EMAIL, "password": SUPABASE_USER_PASSWORD}, 
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                _jwt_token = data.get("access_token")
                _user_id = data.get("user", {}).get("id")
                headers["Authorization"] = f"Bearer {_jwt_token}"
                return headers
            else:
                print(f"Supabase login failed with status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"Error logging in to Supabase: {e}")
            
    return None

def log_bot_event(event_type, payload):
    """
    Log crawler execution steps to Supabase for real-time visualization.
    Event types: 'log', 'navigating', 'typing', 'clicking', 'mismatch', 'success'
    """
    # Print clean terminal output for standard console visibility
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"🤖 [{timestamp}] [{event_type.upper()}] {payload}")
    
    headers = get_auth_headers()
    if headers and _user_id:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/bot_events"
            data = {
                "user_id": _user_id,
                "event_type": event_type,
                "payload": payload
            }
            # Suppress errors to ensure local Playwright crawler never halts due to network latency
            requests.post(url, headers=headers, json=data, timeout=5)
        except Exception:
            pass

def fetch_user_profile():
    """
    Fetch the authenticated user's profile from Supabase.
    Returns a mapped profile dictionary or None.
    """
    headers = get_auth_headers()
    if not headers or not _user_id:
        print("Cannot fetch profile: Not authenticated with Supabase.")
        return None
        
    try:
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{_user_id}&select=*"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                row = data[0]
                
                # Map Supabase row to the profile dictionary expected by main.py
                profile = {
                    "fullName": row.get("full_name", ""),
                    "phone": row.get("phone", ""),
                    "address": row.get("address", ""),
                    "city": row.get("city", ""),
                    "githubUrl": row.get("github_url", ""),
                    "linkedinUrl": row.get("linkedin_url", ""),
                    "skills": ", ".join(row.get("skills", [])),
                    # The frontend stores it plainly or base64 encoded depending on implementation. 
                    # For now we pull the raw value to pass to the groq client.
                    "groqKey": row.get("encrypted_groq_key", ""),
                    "session_cookies": row.get("session_cookies"),
                    "search_criteria": row.get("search_criteria", {})
                }
                
                # We need to map `targetLocations` and `targetKeywords` from search_criteria
                # into the structure `main.py` expects (`titles`, `locations`, etc.)
                criteria = profile["search_criteria"]
                
                # If titles/locations aren't explicitly in the criteria, we build them from the new frontend fields
                if "titles" not in criteria and "targetKeywords" in criteria:
                    keywords = criteria.get("targetKeywords", "")
                    profile["search_criteria"]["titles"] = [k.strip() for k in keywords.split(",") if k.strip()]
                
                if "locations" not in criteria and "targetLocations" in criteria:
                    locations = criteria.get("targetLocations", "")
                    profile["search_criteria"]["locations"] = [l.strip() for l in locations.split(",") if l.strip()]

                return profile
            else:
                print("No profile found for this user in Supabase.")
        else:
            print(f"Error fetching profile: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Failed to fetch profile from Supabase: {e}")
    return None

def get_linkedin_credentials():
    """
    Fetch the user's stored LinkedIn email and password from Supabase profiles.
    Returns a tuple (email, password) or (None, None) if not set.
    """
    headers = get_auth_headers()
    if not headers or not _user_id:
        return None, None
    try:
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{_user_id}&select=linkedin_email,linkedin_password_enc"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                row = data[0]
                return row.get("linkedin_email"), row.get("linkedin_password_enc")
    except Exception as e:
        print(f"Failed to fetch LinkedIn credentials: {e}")
    return None, None

def save_session_cookies(cookies):
    """
    Save fresh LinkedIn session cookies back to the user's Supabase profile row.
    Called by the bot after a successful credential-based login.
    """
    headers = get_auth_headers()
    if not headers or not _user_id:
        return
    try:
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{_user_id}"
        headers["Prefer"] = "return=minimal"
        resp = requests.patch(url, headers=headers, json={"session_cookies": cookies}, timeout=10)
        if resp.status_code in [200, 204]:
            print("✅ Session cookies saved to Supabase for future logins.")
        else:
            print(f"Failed to save session cookies: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Error saving session cookies: {e}")

# Callable injected at runtime by server.py so the bot thread can poll for the verification code
_pending_code_store = None

def get_pending_verification_code():
    """
    Returns the verification code submitted via /submit-code endpoint, then clears it.
    Returns None if no code has been submitted yet.
    """
    global _pending_code_store
    if _pending_code_store and callable(_pending_code_store):
        code = _pending_code_store()
        return code
    return None

# ── Local SQLite database operations ─────────────────────

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title TEXT,
            company TEXT,
            location TEXT,
            applied_date TEXT,
            cover_letter TEXT,
            job_description TEXT
        )
    ''')
    conn.commit()
    conn.close()

def add_application(job_title, company, location, cover_letter, job_description):
    # 1. Save to Local SQLite
    init_db()
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO applications (job_title, company, location, applied_date, cover_letter, job_description)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (job_title, company, location, now, cover_letter, job_description))
    conn.commit()
    conn.close()
    
    # 2. Save to Supabase Cloud if configured
    headers = get_auth_headers()
    if headers and _user_id:
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/applications"
            data = {
                "user_id": _user_id,
                "job_title": job_title,
                "company": company,
                "location": location,
                "cover_letter": cover_letter,
                "job_description": job_description
            }
            resp = requests.post(url, headers=headers, json=data, timeout=5)
            if resp.status_code in [200, 201]:
                # Send realtime success visual event
                log_bot_event("success", {
                    "job_title": job_title, 
                    "company": company,
                    "location": location
                })
            else:
                print(f"Supabase sync failed: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"Error syncing application to Supabase: {e}")
    else:
        # Fallback simulator log if not connected
        log_bot_event("success", {
            "job_title": job_title, 
            "company": company,
            "location": location
        })

def get_all_applications():
    if not os.path.exists(DB_NAME):
        init_db()
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT * FROM applications ORDER BY id DESC')
    rows = c.fetchall()
    conn.close()
    return rows

def is_already_applied(job_title: str, company: str) -> bool:
    """Return True if this exact job title + company is already in the database."""
    if not os.path.exists(DB_NAME):
        return False
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        'SELECT id FROM applications WHERE job_title = ? AND company = ?',
        (job_title, company)
    )
    result = c.fetchone()
    conn.close()
    return result is not None
