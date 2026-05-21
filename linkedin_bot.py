import os
import json
from playwright.sync_api import sync_playwright, BrowserContext
import db

STATE_FILE = "linkedin_state.json"

def login_with_credentials(page, email, password):
    """
    Logs into LinkedIn using email and password via Playwright.
    Handles the verification code page by emitting a human intervention event.
    Returns True if login succeeded, False otherwise.
    """
    print(f"Attempting credential-based login for {email}...")
    db.log_bot_event("log", {"message": "Attempting LinkedIn credential login..."})

    try:
        page.goto("https://www.linkedin.com/login", timeout=30000, wait_until="domcontentloaded")
        page.fill("#username", email)
        page.fill("#password", password)
        page.click("button[type='submit']")

        # Wait to see what happens next (max 15 seconds)
        page.wait_for_timeout(3000)

        # Case 1: Successfully logged in — global nav is present
        if page.query_selector("#global-nav"):
            print("✅ Credential login successful!")
            db.log_bot_event("log", {"message": "✅ LinkedIn login successful via credentials."})
            return True

        # Case 2: LinkedIn is asking for a verification code (2FA / checkpoint)
        pin_selectors = [
            "input[name='pin']",
            "input[id*='pin']",
            "input[id*='verification']",
            "input[autocomplete*='one-time-code']"
        ]
        
        def find_pin_input():
            for selector in pin_selectors:
                el = page.query_selector(selector)
                if el:
                    return selector
            return None

        has_pin = find_pin_input()
        if has_pin or "checkpoint" in page.url or "challenge" in page.url:
            print("⚠️ LinkedIn is requesting a verification code.")
            db.log_bot_event("verification_required", {
                "message": "LinkedIn requires a verification code. Please check your email or phone and enter the code in the dashboard."
            })

            # Poll for the code to be submitted by the user via the dashboard
            import time
            max_wait = 180  # 3 minutes
            elapsed = 0
            while elapsed < max_wait:
                time.sleep(5)
                elapsed += 5
                code = db.get_pending_verification_code()
                if code:
                    print(f"✅ Received verification code: {code}")
                    active_pin = find_pin_input()
                    if active_pin:
                        page.fill(active_pin, code)
                        page.wait_for_timeout(1000)
                        
                        # Find and click submit button
                        submit_btn = page.query_selector("button[type='submit'], #email-pin-submit-button, button[id*='submit']")
                        if submit_btn:
                            submit_btn.click()
                        else:
                            page.keyboard.press("Enter")
                            
                        page.wait_for_timeout(5000)
                        
                        if page.query_selector("#global-nav"):
                            db.log_bot_event("log", {"message": "✅ Verification code accepted. Login complete."})
                            return True
                        
                        # If still on PIN verification, code was rejected
                        still_has_pin = find_pin_input()
                        if still_has_pin:
                            print("⚠️ Verification code rejected by LinkedIn.")
                            db.log_bot_event("log", {"message": "⚠️ Verification code was rejected or expired. Please check and enter the new code."})
                            db.log_bot_event("verification_required", {
                                "message": "Previous code was invalid. Please check and enter the correct 6-digit code."
                            })
                            continue
                        else:
                            print("⚠️ Left PIN page but global navigation is missing.")
                            db.log_bot_event("log", {"message": "⚠️ Left PIN page but global-nav not found. Attempting to continue..."})
                            return False
                    else:
                        print("⚠️ Pin input field not found on page anymore.")
                        db.log_bot_event("log", {"message": "⚠️ Verification pin field disappeared. Check browser logs."})
                        return False

            db.log_bot_event("log", {"message": "⏱️ Timed out waiting for verification code."})
            return False

        # Case 3: Something else went wrong
        print("❌ Login failed. Unknown state after login attempt.")
        db.log_bot_event("log", {"message": "❌ LinkedIn login failed. Please check your credentials."})
        return False

    except Exception as e:
        print(f"Error during credential login: {e}")
        db.log_bot_event("log", {"message": f"❌ Login error: {str(e)}"})
        return False


def get_authenticated_context(p, headless=True, session_cookies=None) -> BrowserContext:
    """
    Initializes a Playwright browser context.
    Priority:
      1. Use session_cookies from Supabase (fastest, no re-login)
      2. Use local linkedin_state.json fallback
      3. Fall back to credential-based login using stored credentials
    """
    context_args = {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "viewport": {"width": 1920, "height": 1080},
        "locale": "en-US",
        "device_scale_factor": 1,
        "is_mobile": False,
        "has_touch": False,
        "accept_downloads": True,
    }

    browser = p.chromium.launch(headless=headless)

    # Priority 1: Supabase session cookies
    if session_cookies:
        print("Loading saved LinkedIn session from Cloud Database...")
        context = browser.new_context(storage_state=session_cookies, **context_args)
    # Priority 2: Local file fallback
    elif os.path.exists(STATE_FILE):
        print("Loading saved LinkedIn session from local disk...")
        context = browser.new_context(storage_state=STATE_FILE, **context_args)
    else:
        print("No saved session found. Creating fresh context...")
        context = browser.new_context(**context_args)

    # Inject stealth scripts
    context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
            ]
        });
    """)

    page = context.new_page()
    print("Connecting to LinkedIn...")
    page.goto("https://www.linkedin.com/", timeout=60000, wait_until="domcontentloaded")

    # Check if already logged in
    try:
        page.wait_for_selector("#global-nav", timeout=5000)
        print("Successfully authenticated with LinkedIn!")
    except Exception:
        # Not logged in — try credential-based login
        print("Session expired or not found. Attempting credential-based login...")
        email, password = db.get_linkedin_credentials()

        if email and password:
            success = login_with_credentials(page, email, password)
            if success:
                # Save fresh cookies back to Supabase so next run is instant
                storage = context.storage_state()
                db.save_session_cookies(storage)
                # Also save locally
                context.storage_state(path=STATE_FILE)
            else:
                print("Login failed. Exiting.")
                browser.close()
                exit(1)
        else:
            print("No credentials found in Supabase. Cannot log in automatically.")
            db.log_bot_event("log", {"message": "❌ No LinkedIn credentials configured. Please add them in the Settings tab."})
            browser.close()
            exit(1)

    page.close()
    return context
