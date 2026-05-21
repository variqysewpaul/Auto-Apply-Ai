import os
from playwright.sync_api import sync_playwright, BrowserContext

STATE_FILE = "linkedin_state.json"

def get_authenticated_context(p, headless=False, session_cookies=None) -> BrowserContext:
    """
    Initializes a Playwright browser context. If a saved session exists, it uses it.
    Otherwise, it forces the user to log in manually and saves the session.
    """
    # Standardize args to masquerade as an organic Windows Desktop browser
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
    
    # Check if we have a saved session passed in (e.g. from Supabase)
    if session_cookies:
        print("Loading saved LinkedIn session from Cloud Database...")
        context = browser.new_context(storage_state=session_cookies, **context_args)
    # Fallback to local file if it exists
    elif os.path.exists(STATE_FILE):
        print("Loading saved LinkedIn session from local disk...")
        context = browser.new_context(storage_state=STATE_FILE, **context_args)
    else:
        print("No saved session found. Starting fresh with stealth context...")
        context = browser.new_context(**context_args)

    # Inject initialization scripts to clear webdriver properties and spoof standard plugins/languages
    context.add_init_script("""
        // Hide webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Spoof chrome object
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // Spoof standard plugins
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
    
    # Check if we are actually logged in by looking for the global nav bar that only appears when logged in
    try:
        # Wait up to 5 seconds to see if the nav bar appears (meaning we are logged in)
        page.wait_for_selector("#global-nav", timeout=5000)
        print("Successfully authenticated with LinkedIn!")
    except Exception:
        print("\n" + "="*40)
        print("ACTION REQUIRED: MANUAL LOGIN")
        print("="*40)
        print("Please look at the opened browser window.")
        print("Log in to your LinkedIn account.")
        print("You have 90 seconds to enter your credentials, complete any captchas, and log in.")
        print("="*40 + "\n")
        
        # Wait up to 90 seconds for the user to log in manually
        try:
            page.wait_for_selector("#global-nav", timeout=90000)
            print("Login successful! Saving your session securely...")
            # Save the cookies and local storage so we never have to login manually again
            context.storage_state(path=STATE_FILE)
            print(f"Session saved to {STATE_FILE}. You won't need to log in next time.")
        except Exception:
            print("Timeout waiting for login. The script will now exit. Please run it again.")
            browser.close()
            exit(1)
    
    # Close the temporary verification page
    page.close()
    return context
