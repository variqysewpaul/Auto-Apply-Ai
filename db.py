import sqlite3
import datetime
import os

DB_NAME = "applications.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title TEXT,
            company TEXT,
            location TEXT,
            applied_date TEXT,
            cover_letter TEXT,
            job_description TEXT
        )
    ''')
    conn.commit()
    conn.close()

def add_application(job_title, company, location, cover_letter, job_description):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO applications (job_title, company, location, applied_date, cover_letter, job_description)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (job_title, company, location, now, cover_letter, job_description))
    conn.commit()
    conn.close()

def get_all_applications():
    if not os.path.exists(DB_NAME):
        init_db()
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT * FROM applications ORDER BY id DESC')
    rows = c.fetchall()
    conn.close()
    return rows
