import time
import urllib.parse
from playwright.sync_api import Page
import pyperclip

def search_and_extract_jobs(page: Page, keyword: str, location: str = "Remote"):
    print(f"\nSearching LinkedIn for: '{keyword}' in '{location}'...")
    search_url = f"https://www.linkedin.com/jobs/search/?keywords={urllib.parse.quote(keyword)}&location={urllib.parse.quote(location)}&f_AL=true&f_WT=2&f_JT=P"
    page.goto(search_url, timeout=60000, wait_until="domcontentloaded")
    
    try:
        page.wait_for_selector(".job-card-container", timeout=15000)
    except:
        print("No jobs found or page didn't load properly.")
        return []
    
    job_cards = page.locator(".job-card-container").all()
    print(f"Found {len(job_cards)} 'Easy Apply' jobs for '{keyword}'.")
    
    jobs_data = []
    
    # Process up to 3 jobs per search term (can be increased later)
    for i, card in enumerate(job_cards[:3]):
        try:
            card.scroll_into_view_if_needed()
            card.click()
            page.wait_for_timeout(2000)
            
            panel = page.locator(".jobs-search__job-details--container")
            
            show_more_btn = panel.locator("button[aria-label='Click to see more description']")
            if show_more_btn.is_visible():
                show_more_btn.click()
                page.wait_for_timeout(500)
                
            description = panel.locator("#job-details").text_content().strip()
            title = panel.locator("h2").first.text_content().strip()
            
            try:
                company = panel.locator(".job-details-jobs-unified-top-card__company-name").first.text_content().strip()
            except:
                company = "Unknown Company"
            
            jobs_data.append({
                "title": title,
                "company": company,
                "description": description,
                "card_index": i 
            })
            print(f"Successfully extracted: {title}")
        except Exception as e:
            print(f"Failed to extract job {i+1}: {e}")
            
    return jobs_data

def apply_to_job(page: Page, profile: dict, cover_letter: str):
    print("--- Starting Auto-Apply Process ---")
    try:
        apply_btn = page.locator(".jobs-apply-button--top-card button").first
        if not apply_btn.is_visible():
            print("No Easy Apply button found. Moving on...")
            return
            
        apply_btn.click()
        page.wait_for_selector(".jobs-easy-apply-modal", timeout=5000)
        print("Application form opened. Automating progression...")
        
        pyperclip.copy(cover_letter)
        print("Cover letter copied to clipboard (Ctrl+V to paste if needed).")

        max_loops = 15
        loop = 0
        while loop < max_loops:
            if not page.locator(".jobs-easy-apply-modal").is_visible():
                print("Application successfully submitted or closed!")
                break
                
            # Try filling known fields dynamically
            phone_input = page.locator("input[id*='phoneNumber']")
            if phone_input.is_visible() and phone_input.is_enabled():
                try:
                    phone_input.fill(profile.get("phone", ""))
                except:
                    pass
            
            # Locate buttons
            next_btn = page.locator("button[aria-label='Continue to next step']")
            review_btn = page.locator("button[aria-label='Review your application']")
            submit_btn = page.locator("button[aria-label='Submit application']")
            
            # Click the highest priority button available
            btn_clicked = False
            if submit_btn.is_visible() and submit_btn.is_enabled():
                submit_btn.click()
                btn_clicked = True
            elif review_btn.is_visible() and review_btn.is_enabled():
                review_btn.click()
                btn_clicked = True
            elif next_btn.is_visible() and next_btn.is_enabled():
                next_btn.click()
                btn_clicked = True
                
            page.wait_for_timeout(1500)
            
            # Check if there are errors preventing advancement
            error_msg = page.locator(".artdeco-inline-feedback--error")
            if error_msg.is_visible() or not btn_clicked:
                print("\n*** HUMAN INTERVENTION REQUIRED ***")
                print("The bot is stuck on a custom question or missing required field.")
                print("Please fill in the missing data on the screen and click Next/Submit.")
                print("The bot will wait patiently and resume automatically when you advance the page...")
                print("***********************************\n")
                
                # Wait until the user clicks next and the error disappears, or modal closes
                time.sleep(4)
                
            loop += 1
            
        if loop == max_loops:
            print("Timed out trying to apply. Closing modal and moving on.")
            close_btn = page.locator("button[aria-label='Dismiss']").first
            if close_btn.is_visible():
                close_btn.click()
                page.wait_for_timeout(500)
                discard_btn = page.locator("button[data-control-name='discard_application_confirm_btn']").first
                if discard_btn.is_visible():
                    discard_btn.click()

    except Exception as e:
        print(f"Failed to interact with application form: {e}")
