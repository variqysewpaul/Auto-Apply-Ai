import json
import time
from playwright.sync_api import sync_playwright
from ai_helper import generate_cover_letter
from linkedin_bot import get_authenticated_context
from job_searcher import search_and_extract_jobs, apply_to_job
import db

def load_profile():
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: config.json not found. Please fill out your profile.")
        return None

def main():
    print("Starting Job Search Automation...")
    profile = load_profile()
    if not profile:
        return

    print("Profile loaded successfully.")
    
    with sync_playwright() as p:
        context = get_authenticated_context(p, headless=False)
        page = context.new_page()
        
        # Loop through ALL titles in the config
        for target_job in profile["search_criteria"]["titles"]:
            jobs = search_and_extract_jobs(page, keyword=target_job, location="Remote")
            
            if not jobs:
                continue
                
            # Get all job cards so we can re-click them before applying
            job_cards = page.locator(".job-card-container").all()
            
            for job in jobs:
                print(f"\n==========================================")
                print(f"Generating cover letter for: {job['title']}")
                print(f"==========================================")
                
                # Re-click the job card
                try:
                    card_index = job['card_index']
                    job_cards[card_index].click()
                    page.wait_for_timeout(1500)
                except:
                    print("Could not click job card. Skipping.")
                    continue
                
                # Generate cover letter
                letter = generate_cover_letter(job['description'], profile)
                
                # Phase 5: The A to Z Apply Flow
                apply_to_job(page, profile, letter)
                
                # Log application to Database
                db.add_application(
                    job_title=job['title'],
                    company=job.get('company', 'Unknown'),
                    location='Remote',
                    cover_letter=letter,
                    job_description=job['description']
                )
                
                time.sleep(2)
        
        print("\nAll searches complete! The browser will close in 10 seconds.")
        page.wait_for_timeout(10000)
        context.close()

if __name__ == "__main__":
    main()
