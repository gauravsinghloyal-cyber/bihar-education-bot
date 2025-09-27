import os
import schedule
import time
import telebot
from telebot.types import InlineKeyboardButton, InlineKeyboardMarkup

# --- अन्य फाइलों से क्लास इम्पोर्ट करें ---
# यह मानें कि ये फाइलें आपके प्रोजेक्ट में मौजूद हैं
from improved_scraper import BiharEducationScraper
from database import Database

class BiharEducationNotifier:
    def __init__(self):
        # सबसे सुरक्षित तरीका: टोकन को .env फ़ाइल से लोड करें
        self.TOKEN = os.getenv('TELEGRAM_TOKEN')
        if not self.TOKEN:
            raise ValueError("TELEGRAM_TOKEN नहीं मिला! कृपया अपनी .env फ़ाइल जांचें।")
        
        self.bot = telebot.TeleBot(self.TOKEN, parse_mode='HTML')
        self.scraper = BiharEducationScraper()
        self.db = Database()
        self.setup_handlers()

    # --- कीबोर्ड बनाने वाले हेल्पर फंक्शन्स (कोई बदलाव नहीं) ---
    def _main_menu_keyboard(self):
        """मुख्य मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("📋 सरकारी नौकरियां", callback_data='menu_govt_jobs')],
            [InlineKeyboardButton("🎓 यूनिवर्सिटी जानकारी", callback_data='menu_university_info')],
            [InlineKeyboardButton("📚 स्टडी मटेरियल", callback_data='menu_study_material')],
            [InlineKeyboardButton("❓ डेली क्विज़", callback_data='menu_daily_quiz')]
        ]
        return InlineKeyboardMarkup(keyboard)

    def _govt_jobs_keyboard(self):
        """सरकारी नौकरियों के सब-मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("✅ BPSC Jobs", callback_data='fetch_jobs_bpsc')],
            [InlineKeyboardButton("👮 Bihar Police", callback_data='fetch_jobs_police')],
            [InlineKeyboardButton("🧑‍🏫 Teaching Jobs", callback_data='fetch_jobs_teaching')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)

    def _university_info_keyboard(self):
        """यूनिवर्सिटी जानकारी के सब-मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("🏛️ Patna University", callback_data='fetch_uni_patna')],
            [InlineKeyboardButton("🛠️ IIT Patna", callback_data='fetch_uni_iitp')],
            [InlineKeyboardButton("⚙️ NIT Patna", callback_data='fetch_uni_nitp')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)

    def _study_material_keyboard(self):
        """स्टडी मटेरियल के सब-मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("📑 सिलेबस", callback_data='fetch_study_syllabus')],
            [InlineKeyboardButton("📝 पिछले वर्ष के पेपर", callback_data='fetch_study_papers')],
            [InlineKeyboardButton("📕 मुफ्त PDFs", callback_data='fetch_study_pdfs')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)
        
    # --- **नया फीचर: मैसेज फॉर्मेटिंग** ---
    def _format_updates_message(self, updates, title):
        """अपडेट्स की लिस्ट को एक सुंदर मैसेज में फॉर्मेट करता है।"""
        if not updates:
            return f"<b>{title}</b>\n\nफिलहाल कोई नया अपडेट नहीं है। 😔"
        
        message = f"<b>{title}</b>\n\n"
        for update in updates[:5]: # केवल टॉप 5 अपडेट्स दिखाएं
            message += f"🔹 <b>{update.get('title', 'N/A')}</b>\n"
            message += f"   <a href='{update.get('link', '#')}'>🔗 अभी देखें</a> | 📅 {update.get('date', 'N/A')}\n\n"
        
        if len(updates) > 5:
            message += f"<i>...और {len(updates) - 5} अन्य अपडेट्स।</i>"
            
        return message

    # --- बॉट के हैंडलर्स ---
    def setup_handlers(self):
        """टेलीग्राम कमांड्स और बटन्स के लिए हैंडलर्स सेट करता है।"""
        @self.bot.message_handler(commands=['start', 'help'])
        def send_welcome(message):
            # नए यूजर को डेटाबेस में जोड़ें
            self.db.add_user(message.chat.id)
            welcome_text = "नमस्ते! 🙏\nबिहार एजुकेशन बॉट में आपका स्वागत है।\n\nकृपया नीचे दिए गए विकल्पों में से एक चुनें:"
            self.bot.send_message(message.chat.id, welcome_text, reply_markup=self._main_menu_keyboard())

        @self.bot.callback_query_handler(func=lambda call: True)
        def handle_callback_query(call):
            """सभी बटन क्लिक्स को हैंडल करता है।"""
            self.bot.answer_callback_query(call.id)
            chat_id = call.message.chat.id
            message_id = call.message.message_id
            
            # --- **मुख्य मेनू हैंडलिंग (अपडेटेड)** ---
            if call.data == 'menu_govt_jobs':
                self.bot.edit_message_text("सरकारी नौकरी श्रेणी चुनें:", chat_id, message_id, reply_markup=self._govt_jobs_keyboard())
            
            elif call.data == 'menu_university_info':
                self.bot.edit_message_text("यूनिवर्सिटी चुनें:", chat_id, message_id, reply_markup=self._university_info_keyboard())

            elif call.data == 'menu_study_material':
                self.bot.edit_message_text("स्टडी मटेरियल का प्रकार चुनें:", chat_id, message_id, reply_markup=self._study_material_keyboard())

            elif call.data == 'menu_daily_quiz':
                self.bot.edit_message_text("डेली क्विज़ की सुविधा जल्द ही शुरू होगी!", chat_id, message_id)

            # --- **नया फीचर: डेटा लाने की प्रक्रिया** ---
            elif call.data.startswith('fetch_'):
                self.bot.edit_message_text("⏳ कृपया प्रतीक्षा करें, जानकारी लाई जा रही है...", chat_id, message_id)
                
                parts = call.data.split('_')
                category_type = parts[1] # 'jobs', 'uni', 'study'
                category_name = parts[2].upper() # 'BPSC', 'PATNA', 'SYLLABUS'
                
                # डेटाबेस से अपडेट्स प्राप्त करें
                updates = self.db.get_updates_by_category(category_name)
                
                message_title = f"{category_name} अपडेट्स"
                formatted_message = self._format_updates_message(updates, message_title)
                
                # वापस जाने वाले बटन के साथ कीबोर्ड चुनें
                back_keyboard = self._main_menu_keyboard() # डिफ़ॉल्ट
                if category_type == 'jobs':
                    back_keyboard = self._govt_jobs_keyboard()
                elif category_type == 'uni':
                    back_keyboard = self._university_info_keyboard()
                elif category_type == 'study':
                    back_keyboard = self._study_material_keyboard()

                self.bot.edit_message_text(formatted_message, chat_id, message_id, reply_markup=back_keyboard, disable_web_page_preview=True)

            # --- वापस जाने का बटन ---
            elif call.data == 'back_to_main':
                welcome_text = "मुख्य मेनू पर वापस आ गए।\n\nकृपया नीचे दिए गए विकल्पों में से एक चुनें:"
                self.bot.edit_message_text(welcome_text, chat_id, message_id, reply_markup=self._main_menu_keyboard())

    # --- **शेड्यूलर (अपडेटेड)** ---
    def send_daily_update(self):
        """नई जानकारी स्क्रैप करता है, DB में सेव करता है और यूजर्स को भेजता है।"""
        print("📰 दैनिक अपडेट की प्रक्रिया शुरू हो रही है...")
        try:
            new_updates = self.scraper.check_for_new_updates()
            if new_updates:
                # नए अपडेट्स को डेटाबेस में सेव करें और केवल 'नए' वाले प्राप्त करें
                truly_new_items = self.db.save_updates(new_updates)
                
                if truly_new_items:
                    print(f"✅ {len(truly_new_items)} नए अपडेट्स मिले। यूजर्स को सूचित किया जा रहा है...")
                    update_message = self._format_updates_message(truly_new_items, "आज के नए अपडेट्स ✨")
                    
                    # सभी यूजर्स को अपडेट भेजें
                    all_users = self.db.get_all_user_ids()
                    for user_id in all_users:
                        try:
                            self.bot.send_message(user_id, update_message, disable_web_page_preview=True)
                            time.sleep(0.1) # स्पैमिंग से बचने के लिए थोड़ा रुकें
                        except Exception as e:
                            print(f"User {user_id} को मैसेज भेजने में विफल: {e}")
                else:
                    print("👍 कोई भी 'सचमुच नया' अपडेट नहीं मिला।")
            else:
                print("🤷‍♂️ स्क्रैपर को कोई अपडेट नहीं मिला।")
        except Exception as e:
            print(f"❌ दैनिक अपडेट में त्रुटि: {e}")

    def run_scheduler(self):
        """शेड्यूलर को चलाता है।"""
        # हर 30 मिनट में अपडेट्स चेक करें
        schedule.every(30).minutes.do(self.send_daily_update)
        while True:
            schedule.run_pending()
            time.sleep(1)

