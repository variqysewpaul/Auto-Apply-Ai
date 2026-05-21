import os
import json
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def get_client(profile_data: dict) -> Groq:
    """Returns a Groq client using the key from the profile or fallback to .env"""
    api_key = profile_data.get("groqKey") or os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Warning: No Groq API Key found in profile or .env")
    return Groq(api_key=api_key)

def generate_cover_letter(job_description: str, profile_data: dict) -> str:
    """
    Uses Llama 3 on Groq to generate a highly tailored cover letter.
    """
    print("AI is reading the job description and writing the cover letter...")
    
    client = get_client(profile_data)
    
    system_prompt = (
        "You are an expert career coach and professional cover letter writer. "
        "Your task is to write a concise, compelling, and highly tailored cover letter "
        "for the user based on their profile data and the provided job description. "
        "Do not invent experience. Only use facts from the user's profile. "
        "Keep it under 300 words. Be professional but modern. "
        "Output ONLY the text of the cover letter. Do not include placeholders like '[Company Name]' if you know the company from the job description. "
        "If you don't know the hiring manager's name, use 'Hiring Manager'. Make sure it sounds natural and enthusiastic."
    )
    
    user_prompt = f"""
    USER PROFILE (JSON):
    {json.dumps(profile_data, indent=2)}
    
    JOB DESCRIPTION:
    {job_description}
    
    Write the cover letter now.
    """
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating cover letter: {e}")
        return "I am very interested in this role and my profile matches the requirements well. Please refer to my attached CV for more details."

def evaluate_job_fit(job_description: str, profile_data: dict) -> bool:
    """
    Evaluates if the user's profile is a reasonable fit for the job description.
    Returns True if it's a fit, False if there's a hard disqualifier.
    """
    print("AI is evaluating job fit against your profile...")
    
    client = get_client(profile_data)
    
    system_prompt = (
        "You are an expert technical recruiter evaluating a candidate against a job description. "
        "Your goal is to determine if the candidate is a viable fit. "
        "Look for 'hard disqualifiers' in the job description that the candidate clearly lacks "
        "based on their profile (e.g., requires a Medical degree, Law degree, active clearance, "
        "or 15+ years of experience when the candidate is junior). "
        "Do not reject based on 'nice-to-have' skills or slight mismatches in tech stack. "
        "Reject ONLY if there is a fundamental mismatch in the core profession or mandatory credentials. "
        "Output ONLY 'YES' if they should apply, or 'NO' if they should not. No other text."
    )
    
    user_prompt = f"""
    USER PROFILE (JSON):
    {json.dumps(profile_data, indent=2)}
    
    JOB DESCRIPTION:
    {job_description}
    
    Should this candidate apply? Answer with exactly YES or NO.
    """
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=10,
        )
        answer = response.choices[0].message.content.strip().upper()
        if "NO" in answer:
            return False
        return True
    except Exception as e:
        print(f"Error evaluating job fit: {e}")
        # Default to True if evaluation fails so we don't accidentally skip good jobs
        return True

def answer_custom_questions(questions: list, profile_data: dict) -> dict:
    """
    Answers a list of form questions based on the candidate's profile data.
    Returns a dictionary mapping each question's 'id' to the determined answer.
    """
    if not questions:
        return {}
        
    print(f"AI is answering {len(questions)} custom form questions...")
    
    client = get_client(profile_data)
    
    system_prompt = (
        "You are an expert recruitment assistant. Your job is to answer form questions "
        "honestly and accurately on behalf of a job applicant, using ONLY the facts "
        "provided in their candidate profile.\n\n"
        "Rules:\n"
        "1. For 'text' questions requiring a numeric value (e.g. 'Years of experience with React'), "
        "calculate the duration based on their job history and skills. If they do not have the skill "
        "listed, return '0' or a realistic estimate. Do not over-embellish.\n"
        "2. For 'text' questions requiring a brief narrative, write a concise (1-2 sentence) answer "
        "based strictly on the candidate's background.\n"
        "3. For 'radio' or 'select' questions, choose the option from the provided list that is "
        "most accurate. If no option perfectly fits, choose the most sensible option.\n"
        "4. For sponsorship questions (e.g. 'Will you now or in the future require visa sponsorship?'), "
        "answer honestly. Check if they need sponsorship or if they are local. If the profile doesn't "
        "mention requiring sponsorship, assume 'No' unless their current location is in a different country "
        "from the job and they lack local work authorization.\n"
        "5. Respond ONLY with a valid JSON object mapping each question's 'id' to the chosen answer. "
        "No additional commentary or text. The JSON keys must match the 'id' fields exactly."
    )
    
    user_prompt = f"""
    CANDIDATE PROFILE (JSON):
    {json.dumps(profile_data, indent=2)}
    
    QUESTIONS TO ANSWER:
    {json.dumps(questions, indent=2)}
    
    Return the answers in JSON format now.
    """
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,  # Low temperature for highly deterministic/factual choices
            max_tokens=1024,
            response_format={"type": "json_object"}  # Request JSON output
        )
        answers = json.loads(response.choices[0].message.content.strip())
        return answers
    except Exception as e:
        print(f"Error answering custom questions: {e}")
        return {}

