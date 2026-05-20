from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.profile import Profile

router = APIRouter(prefix="/profile", tags=["profile"])

class ProfileUpdate(BaseModel):
    full_name: str
    phone: str
    address: str
    city: str
    github_url: str
    linkedin_url: str
    search_criteria: Dict[str, Any]
    skills: List[str]

@router.get("/")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.put("/")
def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    profile.full_name = profile_in.full_name
    profile.phone = profile_in.phone
    profile.address = profile_in.address
    profile.city = profile_in.city
    profile.github_url = profile_in.github_url
    profile.linkedin_url = profile_in.linkedin_url
    profile.search_criteria = profile_in.search_criteria
    profile.skills = profile_in.skills
    
    db.commit()
    db.refresh(profile)
    return profile
