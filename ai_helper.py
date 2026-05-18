import os
import json
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Initialize Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def generate_cover_letter(job_description: str, profile_data: dict) -> str:
    """
    Uses Llama 3 on Groq to generate a highly tailored cover letter.
    """
    print("AI is reading the job description and writing the cover letter...")
    
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
