from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
import datetime
from backend.app.core.database import Base

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    job_title = Column(String, nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    location = Column(String, default="Remote")
    cover_letter = Column(Text, default="")
    job_description = Column(Text, default="")
    status = Column(String, default="applied")
    applied_date = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="applications")
