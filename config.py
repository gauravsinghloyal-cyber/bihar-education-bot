import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BOT_TOKEN = os.getenv('BOT_TOKEN', '8035465689:AAGRXvKWVwCzPNS_ozhR9vVyaH5U5VulVqs')
    CHANNEL_ID = os.getenv('CHANNEL_ID', '@BiharEducationIN')
    ADMIN_IDS = [os.getenv('ADMIN_ID', 'sumankumarsoren')]
    CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL', '1800'))
    DB_PATH = os.getenv('DB_PATH', 'bihar_education.db')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')