from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    
    full_name = Column(String, default="")
    phone = Column(String, default="")
    address = Column(String, default="")
    city = Column(String, default="")
    github_url = Column(String, default="")
    linkedin_url = Column(String, default="")
    
    # Dynamic JSON grids for credentials and target coordinates
    search_criteria = Column(JSON, default=lambda: {
        "titles": ["Python Developer", "Software Engineer"],
        "locations": ["Remote"],
        "remote_only": True,
        "onsite": False,
        "hybrid": False,
        "full_time": True,
        "part_time": False,
        "contract": False,
        "internships": False,
        "entry_level": True,
        "associate": False,
        "mid_senior": False
    })
    
    skills = Column(JSON, default=list)
    
    user = relationship("User", back_populates="profile")
