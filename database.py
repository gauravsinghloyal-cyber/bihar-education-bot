import sqlite3
import datetime

class Database:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.init_tables()
    
    def init_tables(self):
        c = self.conn.cursor()
        
        # Tracked websites
        c.execute('''CREATE TABLE IF NOT EXISTS websites
                    (id INTEGER PRIMARY KEY,
                    name TEXT UNIQUE,
                    url TEXT,
                    category TEXT,
                    selector TEXT,
                    last_checked TIMESTAMP)''')
        
        # Updates history
        c.execute('''CREATE TABLE IF NOT EXISTS updates
                    (id INTEGER PRIMARY KEY,
                    website_id INTEGER,
                    title TEXT,
                    link TEXT,
                    date TEXT,
                    posted BOOLEAN DEFAULT 0,
                    post_time TIMESTAMP,
                    UNIQUE(title, website_id))''')
        
        self.conn.commit()
    
    def add_website(self, name, url, category, selector):
        c = self.conn.cursor()
        c.execute('''INSERT OR IGNORE INTO websites (name, url, category, selector) 
                    VALUES (?, ?, ?, ?)''', (name, url, category, selector))
        self.conn.commit()
        return c.lastrowid
    
    def get_websites(self):
        c = self.conn.cursor()
        c.execute("SELECT * FROM websites")
        return c.fetchall()
    
    def get_connection(self):
        return sqlite3.connect(self.db_path)