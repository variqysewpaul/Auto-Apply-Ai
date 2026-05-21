import json
import time
from playwright.sync_api import sync_playwright
from ai_helper import generate_cover_letter, evaluate_job_fit
from linkedin_bot import get_authenticated_context
from job_searcher import search_and_extract_jobs, apply_to_job, notify_user
import db

def main():
    print("Starting Job Search Automation...")
    profile = db.fetch_user_profile()
    if not profile:
        print("Falling back to local config.json...")
        try:
            with open('config.json', 'r') as f:
                profile = json.load(f)
        except FileNotFoundError:
            print("Error: config.json not found and Supabase fetch failed.")
            return

    criteria = profile.get("search_criteria", {})
    show_browser = criteria.get("showBrowser", True)
    
    print("Profile loaded successfully.")
    print(f"  Targets: {', '.join(criteria.get('titles', []))}")
    print(f"  Browser Visibility: {'ON' if show_browser else 'OFF (Headless)'}")

    with sync_playwright() as p:
        context = get_authenticated_context(p, headless=not show_browser)
        page = context.new_page()

        for target_job in criteria.get("titles", []):
            # Pass the full criteria dict so the URL is built dynamically
            jobs = search_and_extract_jobs(page, keyword=target_job, criteria=criteria)

            if not jobs:
                continue

            job_cards = page.locator(".job-card-container").all()

            for job in jobs:
                title   = job['title']
                company = job.get('company', 'Unknown')

                # ── Duplicate guard: check our own DB first ──────────────
                if db.is_already_applied(title, company):
                    print(f"  [SKIP] Already in DB: {title} @ {company}. Skipping.")
                    continue

                print(f"\n{'='*50}")
                print(f"  Applying to: {title} @ {company}")
                print(f"{'='*50}")

                # Re-click the job card to bring it back into the details panel
                try:
                    job_cards[job['card_index']].click()
                    page.wait_for_timeout(1500)
                except Exception:
                    print("  Could not re-click job card. Skipping.")
                    continue

                # AI Evaluation: Check if the job is actually a match (e.g. no law degree required for a tech guy)
                is_fit = evaluate_job_fit(job['description'], profile)
                if not is_fit:
                    db.log_bot_event("mismatch", {"job_title": title, "company": company, "reason": "AI determined a core requirements mismatch."})
                    print(f"  [SKIPPED] AI determined this job is a fundamental mismatch (missing core requirements).")
                    notify_user("Application Skipped", f"Mismatch for {title} at {company}.")
                    continue

                # Generate a tailored cover letter via AI
                db.log_bot_event("log", {"message": f"Tailoring cover letter via AI..."})
                letter = generate_cover_letter(job['description'], profile)

                # Execute the Easy Apply flow
                success = apply_to_job(page, profile, letter)

                # Log to database only if application completed successfully
                if success:
                    db.add_application(
                        job_title=title,
                        company=company,
                        location=criteria.get("locations", ["Remote"])[0],
                        cover_letter=letter,
                        job_description=job['description'],
                    )
                    print(f"  [LOGGED] {title} @ {company} saved to history.")
                    notify_user("Application Sent!", f"Successfully applied to {title} at {company}.")
                else:
                    print(f"  [SKIPPED] Application to {title} @ {company} was aborted or required external steps.")
                    notify_user("Application Skipped", f"Skipped or failed: {title} at {company}.")

                time.sleep(2)

        print("\nAll searches complete! Closing in 10 seconds.")
        page.wait_for_timeout(10000)
        context.close()

if __name__ == "__main__":
    main()
