import os
from playwright.sync_api import sync_playwright, BrowserContext

STATE_FILE = "linkedin_state.json"

def get_authenticated_context(p, headless=False) -> BrowserContext:
    """
    Initializes a Playwright browser context. If a saved session exists, it uses it.
    Otherwise, it forces the user to log in manually and saves the session.
    """
    browser = p.chromium.launch(headless=headless)
    
    # Check if we have a saved session
    if os.path.exists(STATE_FILE):
        print("Loading saved LinkedIn session...")
        context = browser.new_context(storage_state=STATE_FILE)
    else:
        print("No saved session found. Starting fresh...")
        context = browser.new_context()

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
