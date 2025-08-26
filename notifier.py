import telebot
from telebot import types
from config import Config
from database import Database
from improved_scraper import BiharEducationScraper
import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class BiharEducationNotifier:
    def __init__(self):
        self.bot = telebot.TeleBot(Config.BOT_TOKEN)
        self.db = Database(Config.DB_PATH)
        self.scraper = BiharEducationScraper()
        self.setup_handlers()
        logger.info("BiharEducationNotifier initialized")
        
        # Initialize websites in database
        self.initialize_websites()
    
    def initialize_websites(self):
        """Add all websites to database if not exists"""
        websites = self.scraper.load_websites()
        for website in websites:
            self.db.add_website(
                website['name'],
                website['url'],
                website['category'],
                website['selector']
            )
    
    def setup_handlers(self):
        @self.bot.message_handler(commands=['start', 'help'])
        def start(message):
            if str(message.chat.id) in Config.ADMIN_IDS or message.from_user.username in Config.ADMIN_IDS:
                self.send_admin_menu(message.chat.id)
            else:
                self.bot.send_message(
                    message.chat.id,
                    "🤖 *Bihar Education Updates Bot*\n\n"
                    "This bot automatically posts updates from all Bihar education websites:\n"
                    "• All University Admissions\n• Board Exam Updates\n"
                    "• Recruitment Notifications\n• Results & Forms\n• Scholarship Info\n\n"
                    "Join our channel for automatic updates: @BiharEducationIN",
                    parse_mode='Markdown'
                )
        
        @self.bot.message_handler(commands=['stats'])
        def stats(message):
            if str(message.chat.id) in Config.ADMIN_IDS or message.from_user.username in Config.ADMIN_IDS:
                stats_text = self.get_stats()
                self.bot.send_message(message.chat.id, stats_text, parse_mode='Markdown')
        
        @self.bot.message_handler(commands=['check'])
        def manual_check(message):
            if str(message.chat.id) in Config.ADMIN_IDS or message.from_user.username in Config.ADMIN_IDS:
                self.bot.send_message(message.chat.id, "🔄 Manual check started...")
                new_posts = self.check_and_post_updates()
                self.bot.send_message(message.chat.id, f"✅ Check completed! Posted {new_posts} new updates.")
    
    def get_stats(self):
        conn = self.db.get_connection()
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM websites")
        website_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM updates")
        update_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM updates WHERE posted = 1")
        posted_count = c.fetchone()[0]
        conn.close()
        
        return f"""
📊 *Bot Statistics*

🌐 Websites Monitored: {website_count}
📝 Total Updates Found: {update_count}
✅ Updates Posted: {posted_count}
🔄 Check Interval: Every 30 minutes

Bot is running smoothly! 🚀
        """
    
    def send_admin_menu(self, chat_id):
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
        markup.add('🔄 Check Now', '📊 Statistics', '🌐 Websites List')
        self.bot.send_message(
            chat_id,
            "👨‍💻 *Admin Panel*\n\nManage Bihar Education Updates Bot",
            parse_mode='Markdown',
            reply_markup=markup
        )
    
    def format_update_message(self, update):
        category_emoji = {
            'Board': '🎓', 'University': '🏫', 'Results': '📊',
            'Recruitment': '💼', 'Scholarship': '💰', 'Govt Portal': '🏛️'
        }
        
        emoji = category_emoji.get(update['category'], '📢')
        
        message = f"""
{emoji} *{update['website']}* - {update['category']}

📢 *{update['title']}*
📅 *Date:* {update['date']}

🔗 *Link:* {update['link']}

#BiharEducation #{update['category']} #{update['website'].replace(' ', '').replace('(', '').replace(')', '')}
        """
        return message.strip()
    
    def check_and_post_updates(self):
        logger.info("Starting update check...")
        try:
            updates = self.scraper.check_for_new_updates()
            new_posts = 0
            
            for update in updates:
                # Check if this update was already posted
                conn = self.db.get_connection()
                c = conn.cursor()
                c.execute("SELECT id FROM updates WHERE title = ? AND website = ?", 
                         (update['title'], update['website']))
                existing = c.fetchone()
                
                if not existing:
                    # New update found
                    message = self.format_update_message(update)
                    
                    try:
                        self.bot.send_message(
                            Config.CHANNEL_ID,
                            message,
                            parse_mode='Markdown',
                            disable_web_page_preview=False
                        )
                        
                        # Save to database
                        c.execute('''INSERT INTO updates 
                                   (website_id, title, link, date, posted, post_time)
                                   VALUES (?, ?, ?, ?, 1, ?)''',
                                   (1, update['title'], update['link'], update['date'], datetime.now()))
                        conn.commit()
                        
                        logger.info(f"Posted new update: {update['title'][:50]}...")
                        new_posts += 1
                        time.sleep(2)
                        
                    except Exception as e:
                        logger.error(f"Error posting update: {e}")
                        # Save as not posted
                        c.execute('''INSERT INTO updates 
                                   (website_id, title, link, date, posted)
                                   VALUES (?, ?, ?, ?, 0)''',
                                   (1, update['title'], update['link'], update['date']))
                        conn.commit()
                
                conn.close()
            
            logger.info(f"Update check completed. Posted {new_posts} new updates.")
            return new_posts
                    
        except Exception as e:
            logger.error(f"Update check failed: {e}")
            return 0
    
    def run_scheduler(self):
        logger.info("Scheduler started (30 minute intervals)")
        while True:
            try:
                self.check_and_post_updates()
                logger.info(f"Next check in 30 minutes...")
                time.sleep(Config.CHECK_INTERVAL)
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(300)