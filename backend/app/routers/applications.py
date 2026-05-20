from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.application import Application

router = APIRouter(prefix="/applications", tags=["applications"])

class ApplicationOut(BaseModel):
    id: int
    job_title: str
    company: str
    location: str
    status: str
    applied_date: datetime.datetime

    class Config:
        from_attributes = True

class ApplicationDetail(ApplicationOut):
    cover_letter: str
    job_description: str

class ApplicationCreate(BaseModel):
    job_title: str
    company: str
    location: str
    cover_letter: str
    job_description: str

@router.get("/", response_model=List[ApplicationOut])
def get_applications(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Application).filter(Application.user_id == current_user.id)
    if q:
        query = query.filter(
            (Application.job_title.ilike(f"%{q}%")) | 
            (Application.company.ilike(f"%{q}%"))
        )
    return query.order_by(Application.id.desc()).offset(skip).limit(limit).all()

@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    apps = db.query(Application).filter(Application.user_id == current_user.id).all()
    total = len(apps)
    companies = len(set(a.company for a in apps))
    
    # Applied today count
    today = datetime.date.today()
    today_count = sum(1 for a in apps if a.applied_date.date() == today)
    
    # Calculate top role
    titles = {}
    for a in apps:
        titles[a.job_title] = titles.get(a.job_title, 0) + 1
    top_role = max(titles, key=titles.get) if titles else "—"
    
    return {
        "total_applied": total,
        "companies_applied": companies,
        "applied_today": today_count,
        "top_role": top_role
    }

@router.get("/{app_id}", response_model=ApplicationDetail)
def get_application(
    app_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == app_id, 
        Application.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application record not found")
    return app

@router.post("/", response_model=ApplicationOut)
def create_application(
    app_in: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_app = Application(
        user_id=current_user.id,
        job_title=app_in.job_title,
        company=app_in.company,
        location=app_in.location,
        cover_letter=app_in.cover_letter,
        job_description=app_in.job_description
    )
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    return db_app
