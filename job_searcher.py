import time
import urllib.parse
import random
from playwright.sync_api import Page
import pyperclip
from plyer import notification
import db

def random_wait(page, min_sec: float, max_sec: float):
    """Wait for a randomized duration between min_sec and max_sec seconds using Playwright's wait_for_timeout."""
    ms = int(random.uniform(min_sec, max_sec) * 1000)
    page.wait_for_timeout(ms)


def human_type(page, locator, text: str):
    """Types text character-by-character with a realistic, randomized delay between keystrokes."""
    locator.fill("")
    page.wait_for_timeout(random.randint(150, 300))  # Minor pause before starting to type
    for char in text:
        locator.type(char)
        # Random typing speed: 30ms to 120ms
        delay = random.randint(30, 120)
        if char in [',', '.', '!', '?', ';']:
            delay += random.randint(150, 300)  # pause slightly at punctuation
        page.wait_for_timeout(delay)
    page.wait_for_timeout(random.randint(150, 300))  # Minor pause after typing



def notify_user(title: str, message: str):
    try:
        notification.notify(
            title=title,
            message=message,
            app_name="AutoApply",
            timeout=5
        )
    except Exception as e:
        print(f"[Notify Error] {e}")

# ── LinkedIn URL filter codes ──────────────────────────────────────────────
# f_WT : Work type  — 1=On-site  2=Remote  3=Hybrid
# f_JT : Job type   — F=Full-time  P=Part-time  C=Contract  I=Internship
# f_E  : Experience — 1=Internship  2=Entry  3=Associate  4=Mid-Senior
# f_AL : Easy Apply only (always true)

def _build_search_url(keyword: str, criteria: dict) -> str:
    """Dynamically build a LinkedIn jobs search URL from the config criteria."""
    params = {
        "keywords": keyword,
        "f_AL": "true",   # Easy Apply only — always on
    }

    # ── Location ──────────────────────────────────────────────────────────
    # When remote_only is True we intentionally skip the location parameter
    # so LinkedIn searches the entire world for remote listings.
    # The applicant's personal city is only used inside the Easy Apply form.
    if not criteria.get("remote_only"):
        locations = criteria.get("locations", [])
        if locations:
            params["location"] = locations[0]

    # ── Work Type ─────────────────────────────────────────────────────────
    wt = []
    if criteria.get("remote_only") or criteria.get("remote"):
        wt.append("2")
    if criteria.get("onsite"):
        wt.append("1")
    if criteria.get("hybrid"):
        wt.append("3")
    if wt:
        params["f_WT"] = ",".join(wt)

    # ── Job Type ──────────────────────────────────────────────────────────
    jt = []
    if criteria.get("full_time"):
        jt.append("F")
    if criteria.get("part_time"):
        jt.append("P")
    if criteria.get("contract"):
        jt.append("C")
    if criteria.get("internships"):
        jt.append("I")
    if jt:
        params["f_JT"] = ",".join(jt)

    # ── Experience Level ──────────────────────────────────────────────────
    exp = []
    if criteria.get("internships"):          # internship experience level
        exp.append("1")
    if criteria.get("entry_level"):
        exp.append("2")
    if criteria.get("associate"):
        exp.append("3")
    if criteria.get("mid_senior"):
        exp.append("4")
    if exp:
        params["f_E"] = ",".join(exp)

    return "https://www.linkedin.com/jobs/search/?" + urllib.parse.urlencode(params)


def _linkedin_shows_applied(panel) -> bool:
    """Return True if LinkedIn is showing an 'Applied' badge on this listing."""
    try:
        # LinkedIn renders an 'Applied' chip with a green success class in the top card.
        # Restrict to this specific class so we don't accidentally match the word "Applied" in the job description!
        applied = panel.locator(".artdeco-inline-feedback--success:has-text('Applied')")
        return applied.first.is_visible()
    except Exception:
        return False


def search_and_extract_jobs(page: Page, keyword: str, criteria: dict):
    """
    Navigate to a dynamically built LinkedIn search URL, extract job data,
    and skip any listing already marked as Applied on LinkedIn.
    """
    url = _build_search_url(keyword, criteria)
    print(f"\nSearching LinkedIn for: '{keyword}'")
    print(f"  URL: {url}")
    db.log_bot_event("navigating", {"url": url, "keyword": keyword})
    page.goto(url, timeout=60000, wait_until="domcontentloaded")

    try:
        page.wait_for_selector(".job-card-container", timeout=15000)
    except Exception:
        print("No jobs found or page didn't load properly.")
        return []

    job_cards = page.locator(".job-card-container").all()
    print(f"Found {len(job_cards)} Easy Apply jobs for '{keyword}'.")

    jobs_data = []

    for i, card in enumerate(job_cards[:5]):   # up to 5 per search term
        try:
            card.scroll_into_view_if_needed()
            card.click()
            random_wait(page, 1.5, 2.5)

            # Emuate human reading: Scroll down slightly and back up
            try:
                page.evaluate("document.querySelector('.jobs-search__job-details--container').scrollTop = 250;")
                random_wait(page, 0.4, 0.9)
                page.evaluate("document.querySelector('.jobs-search__job-details--container').scrollTop = 550;")
                random_wait(page, 0.6, 1.2)
                page.evaluate("document.querySelector('.jobs-search__job-details--container').scrollTop = 0;")
                random_wait(page, 0.3, 0.8)
            except Exception:
                pass

            panel = page.locator(".jobs-search__job-details--container")

            # ── Skip if LinkedIn says already applied ─────────────────────
            if _linkedin_shows_applied(panel):
                print(f"  [SKIP] LinkedIn shows 'Applied' on listing #{i+1}. Skipping.")
                continue

            # Expand full description
            show_more_btn = panel.locator("button[aria-label='Click to see more description']")
            if show_more_btn.is_visible():
                show_more_btn.click()
                page.wait_for_timeout(500)

            description = panel.locator("#job-details").text_content().strip()
            title       = panel.locator("h2").first.text_content().strip()

            try:
                company = panel.locator(
                    ".job-details-jobs-unified-top-card__company-name"
                ).first.text_content().strip()
            except Exception:
                company = "Unknown Company"

            jobs_data.append({
                "title":      title,
                "company":    company,
                "description": description,
                "card_index": i,
            })
            db.log_bot_event("log", {"message": f"Analyzing fit for {title} at {company}"})
            print(f"  [OK] Extracted: {title} @ {company}")

        except Exception as e:
            print(f"  [ERR] Failed to extract job #{i+1}: {e}")

    return jobs_data


def solve_custom_questions(page, profile: dict):
    """
    Scans the current page of the Easy Apply modal, extracts custom questions,
    queries the AI for answers, and fills the fields.
    """
    from ai_helper import answer_custom_questions
    import json
    
    # 1. Extract elements
    form_elements = []
    questions_to_send = []
    
    # Radios
    try:
        fieldsets = page.locator(".jobs-easy-apply-modal fieldset").all()
        for i, fs in enumerate(fieldsets):
            legend = fs.locator("legend")
            if not legend.is_visible():
                continue
            question_text = legend.text_content().strip()
            
            # Remove any trailing "Required" or error texts
            question_text = question_text.replace("Required", "").strip()
            
            labels = fs.locator("label").all()
            options = [lbl.text_content().strip() for lbl in labels if lbl.is_visible()]
            if not options:
                continue
                
            elem_id = f"radio_{i}"
            form_elements.append({
                "id": elem_id,
                "question": question_text,
                "type": "radio",
                "options": options,
                "locator": fs,
                "labels_locators": labels
            })
            questions_to_send.append({
                "id": elem_id,
                "text": question_text,
                "type": "radio",
                "options": options
            })
    except Exception as e:
        print(f"  [Scan Error] Radios: {e}")
        
    # Selects
    try:
        selects = page.locator(".jobs-easy-apply-modal select").all()
        for i, sel in enumerate(selects):
            sel_id = sel.get_attribute("id")
            label_text = ""
            if sel_id:
                label_elem = page.locator(f"label[for='{sel_id}']")
                if label_elem.first.is_visible():
                    label_text = label_elem.first.text_content().strip()
            
            if not label_text:
                parent_group = sel.locator("xpath=ancestor::*[contains(@class, 'jobs-easy-apply-form-section__grouping') or contains(@class, 'fb-dash-form-element')]")
                if parent_group.first.is_visible():
                    lbl = parent_group.locator("label")
                    if lbl.first.is_visible():
                        label_text = lbl.first.text_content().strip()
                        
            label_text = label_text.replace("Required", "").strip() if label_text else "Dropdown option"
            
            option_elems = sel.locator("option").all()
            options = []
            for opt in option_elems:
                val = opt.get_attribute("value")
                text = opt.text_content().strip()
                if val and val != "" and "Select" not in text and "Choose" not in text:
                    options.append(text)
                    
            elem_id = f"select_{i}"
            form_elements.append({
                "id": elem_id,
                "question": label_text,
                "type": "select",
                "options": options,
                "locator": sel
            })
            questions_to_send.append({
                "id": elem_id,
                "text": label_text,
                "type": "select",
                "options": options
            })
    except Exception as e:
        print(f"  [Scan Error] Selects: {e}")
        
    # Text Inputs
    try:
        text_inputs = page.locator(".jobs-easy-apply-modal input[type='text'], .jobs-easy-apply-modal textarea").all()
        for i, txt in enumerate(text_inputs):
            txt_id = txt.get_attribute("id") or ""
            txt_class = txt.get_attribute("class") or ""
            txt_aria = txt.get_attribute("aria-label") or ""
            
            id_lower = txt_id.lower()
            aria_lower = txt_aria.lower()
            
            if "phone" in id_lower or "location" in id_lower or "city" in id_lower or "phone" in aria_lower or "location" in aria_lower or "city" in aria_lower:
                continue
                
            label_text = ""
            if txt_id:
                label_elem = page.locator(f"label[for='{txt_id}']")
                if label_elem.first.is_visible():
                    label_text = label_elem.first.text_content().strip()
                    
            if not label_text:
                parent_group = txt.locator("xpath=ancestor::*[contains(@class, 'jobs-easy-apply-form-section__grouping') or contains(@class, 'fb-dash-form-element')]")
                if parent_group.first.is_visible():
                    lbl = parent_group.locator("label")
                    if lbl.first.is_visible():
                        label_text = lbl.first.text_content().strip()
                        
            if not label_text and txt_aria:
                label_text = txt_aria.strip()
                
            if not label_text:
                continue
                
            label_text = label_text.replace("Required", "").strip()
            
            elem_id = f"text_{i}"
            form_elements.append({
                "id": elem_id,
                "question": label_text,
                "type": "text",
                "locator": txt
            })
            questions_to_send.append({
                "id": elem_id,
                "text": label_text,
                "type": "text"
            })
    except Exception as e:
        print(f"  [Scan Error] Text Inputs: {e}")
        
    # Checkboxes
    try:
        checkboxes = page.locator(".jobs-easy-apply-modal input[type='checkbox']").all()
        for i, cb in enumerate(checkboxes):
            cb_id = cb.get_attribute("id")
            label_text = ""
            if cb_id:
                label_elem = page.locator(f"label[for='{cb_id}']")
                if label_elem.first.is_visible():
                    label_text = label_elem.first.text_content().strip()
                    
            if not label_text:
                parent_div = cb.locator("xpath=ancestor::div[1]")
                if parent_div.first.is_visible():
                    lbl = parent_div.locator("label")
                    if lbl.first.is_visible():
                        label_text = lbl.first.text_content().strip()
                        
            label_text = label_text.replace("Required", "").strip() if label_text else "Checkbox Agreement"
            
            elem_id = f"checkbox_{i}"
            form_elements.append({
                "id": elem_id,
                "question": label_text,
                "type": "checkbox",
                "locator": cb
            })
            questions_to_send.append({
                "id": elem_id,
                "text": label_text,
                "type": "checkbox"
            })
    except Exception as e:
        print(f"  [Scan Error] Checkboxes: {e}")

    if not questions_to_send:
        return
        
    # 2. Get answers from AI
    answers = answer_custom_questions(questions_to_send, profile)
    if not answers:
        return
        
    # 3. Fill elements
    for elem in form_elements:
        answer = answers.get(elem["id"])
        if answer is None:
            continue
            
        print(f"  -> AI Answer for '{elem['question']}': {answer}")
        db.log_bot_event("typing", {"field": elem["question"], "value": str(answer)})
        try:
            if elem["type"] == "text":
                human_type(page, elem["locator"], str(answer))
                
                
            elif elem["type"] == "select":
                if elem["locator"].is_visible() and elem["locator"].is_enabled():
                    try:
                        elem["locator"].select_option(label=str(answer))
                    except Exception:
                        matched_val = None
                        options = elem["locator"].locator("option").all()
                        for opt in options:
                            if str(answer).lower() in opt.text_content().lower():
                                matched_val = opt.get_attribute("value")
                                break
                        if matched_val:
                            elem["locator"].select_option(value=matched_val)
                        elif len(options) > 1:
                            elem["locator"].select_option(index=1)
                            
            elif elem["type"] == "radio":
                clicked = False
                for lbl in elem["labels_locators"]:
                    if str(answer).lower() in lbl.text_content().lower():
                        lbl.click()
                        clicked = True
                        break
                if not clicked and elem["labels_locators"]:
                    elem["labels_locators"][0].click()
                    
            elif elem["type"] == "checkbox":
                should_check = False
                if isinstance(answer, bool):
                    should_check = answer
                elif isinstance(answer, str):
                    should_check = answer.lower() in ["yes", "true", "1", "agree", "accept", "check"]
                elif isinstance(answer, int):
                    should_check = answer == 1
                    
                if should_check:
                    elem["locator"].check()
                else:
                    elem["locator"].uncheck()
                    
        except Exception as e:
            print(f"  [Fill Error] Failed to answer '{elem['question']}': {e}")


def apply_to_job(page: Page, profile: dict, cover_letter: str) -> bool:

    print("--- Starting Auto-Apply ---")
    db.log_bot_event("log", {"message": "Starting Easy Apply Wizard..."})
    try:
        apply_btn = page.locator(".jobs-apply-button--top-card").locator("button, a").first
        if not apply_btn.is_visible():
            print("No Apply button found. Moving on.")
            return False

        page.wait_for_timeout(1000) # Stagger before clicking
        
        # We want to catch if it opens a new tab (popup) so we can close it
        try:
            with page.expect_popup(timeout=2000) as popup_info:
                apply_btn.click()
            popup = popup_info.value
            print("Opened an external tab. Closing it and skipping.")
            popup.close()
            return False
        except Exception:
            # If no popup opened, that's exactly what we want (it either opened the modal, or clicked normally)
            pass
        
        try:
            page.wait_for_selector(".jobs-easy-apply-modal", timeout=5000)
        except Exception:
            print("Easy Apply modal did not open. Skipping.")
            return False
            
        print("Application form opened.")

        pyperclip.copy(cover_letter)
        print("Cover letter copied to clipboard.")

        max_loops = 20
        for loop in range(max_loops):
            page.wait_for_timeout(1000) # General stagger so user can watch

            if not page.locator(".jobs-easy-apply-modal").is_visible():
                print("Application submitted or modal closed!")
                return True

            # Check if we reached the final "Application sent" screen
            success_header = page.locator("h2:has-text('Application sent'), h2:has-text('Application submitted')").first
            done_btn = page.locator("button span:text-is('Done')").first
            
            if success_header.is_visible() or done_btn.is_visible():
                print("Application successful!")
                close_btn = page.locator("button[aria-label='Dismiss']").first
                if close_btn.is_visible():
                    page.wait_for_timeout(1000)
                    close_btn.click()
                return True

            # Solve any custom questions on the current page
            solve_custom_questions(page, profile)

            # Fill phone number if present
            phone_input = page.locator("input[id*='phoneNumber']")
            if phone_input.is_visible() and phone_input.is_enabled():
                try:
                    current_val = phone_input.input_value()
                    if current_val != profile.get("phone", ""):
                        db.log_bot_event("typing", {"field": "Phone Number", "value": profile.get("phone", "")})
                        human_type(page, phone_input, profile.get("phone", ""))
                except Exception:
                    pass

            # Fill location / city field — type the city and pick first suggestion
            city = profile.get("city", "")   # e.g. "Durban, South Africa"
            if city:
                loc_input = page.locator("input[id*='location'], input[aria-label*='ity'], input[aria-label*='ocation']")
                if loc_input.first.is_visible() and loc_input.first.is_enabled():
                    try:
                        current_val = loc_input.first.input_value()
                        if not current_val or current_val.lower() not in city.lower():
                            db.log_bot_event("typing", {"field": "Location", "value": city})
                            loc_input.first.triple_click()   # clear existing text
                            human_type(page, loc_input.first, city)
                            page.wait_for_timeout(1500)      # wait for autocomplete
                            # Click the first suggestion in the dropdown
                            suggestion = page.locator(
                                "[role='listbox'] [role='option'], "
                                ".basic-typeahead__selectable, "
                                ".search-typeahead-v2__hit"
                            ).first
                            if suggestion.is_visible():
                                page.wait_for_timeout(500)
                                suggestion.click()
                                page.wait_for_timeout(1000)
                    except Exception as e:
                        print(f"  Location autofill skipped: {e}")

            next_btn   = page.locator("button[aria-label='Continue to next step']")
            review_btn = page.locator("button[aria-label='Review your application']")
            submit_btn = page.locator("button[aria-label='Submit application']")

            btn_clicked = False
            if submit_btn.is_visible() and submit_btn.is_enabled():
                db.log_bot_event("clicking", {"button": "Submit Application"})
                page.wait_for_timeout(1000)
                submit_btn.click(); btn_clicked = True
            elif review_btn.is_visible() and review_btn.is_enabled():
                db.log_bot_event("clicking", {"button": "Review Application"})
                page.wait_for_timeout(1000)
                review_btn.click(); btn_clicked = True
            elif next_btn.is_visible() and next_btn.is_enabled():
                db.log_bot_event("clicking", {"button": "Continue"})
                page.wait_for_timeout(1000)
                next_btn.click();   btn_clicked = True

            page.wait_for_timeout(1500)

            page.wait_for_timeout(1500)

            error_msg = page.locator(".artdeco-inline-feedback--error, [aria-invalid='true']")
            if error_msg.first.is_visible() or not btn_clicked:
                print("\n*** HUMAN INTERVENTION REQUIRED ***")
                notify_user("Action Required", "The bot is stuck. Please fill in the missing field on LinkedIn.")
                
                # Trigger an actual pop-up in the browser for the user to see immediately
                try:
                    page.evaluate("""
                        if (!window.alertShown) {
                            alert('HUMAN INTERVENTION REQUIRED\\n\\nThe bot is stuck! Please fill in the missing field (like a WhatsApp number or custom question) and click Next/Submit.\\n\\nThe bot will wait patiently for you to finish this page.');
                            window.alertShown = true;
                        }
                    """)
                except Exception:
                    pass
                    
                print("Waiting for you to resolve the error and advance the page...")
                
                # Infinite wait loop: wait until the error goes away and a button becomes clickable, OR the modal closes
                while page.locator(".jobs-easy-apply-modal").is_visible():
                    if error_msg.first.is_visible():
                        page.wait_for_timeout(2000)
                    elif not page.locator("button[aria-label='Continue to next step'], button[aria-label='Review your application'], button[aria-label='Submit application']").first.is_visible():
                        # Modal is open but no next/submit buttons are found, meaning it's still stuck
                        page.wait_for_timeout(2000)
                    else:
                        # Error is resolved and buttons are visible again, we can resume!
                        print("Error resolved. Resuming automation...")
                        break
                
                # Clear the alert flag so it can pop up again if stuck on the next page
                try:
                    page.evaluate("window.alertShown = false;")
                except Exception:
                    pass
                continue # Skip the timeout check and loop again
        else:
            print("Timed out — closing modal and moving on.")
            close_btn = page.locator("button[aria-label='Dismiss']").first
            if close_btn.is_visible():
                page.wait_for_timeout(500)
                close_btn.click()
                page.wait_for_timeout(1000)
                discard = page.locator(
                    "button[data-control-name='discard_application_confirm_btn']"
                ).first
                if discard.is_visible():
                    page.wait_for_timeout(500)
                    discard.click()
            return False # Did not apply successfully

    except Exception as e:
        print(f"Failed to interact with application form: {e}")
        return False
        
    return True
