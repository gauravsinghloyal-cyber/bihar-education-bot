import os
import schedule
import time
import telebot
from telebot.types import InlineKeyboardButton, InlineKeyboardMarkup

class BiharEducationNotifier:
    def __init__(self):
        # सबसे सुरक्षित तरीका: टोकन को .env फ़ाइल से लोड करें
        self.TOKEN = os.getenv('TELEGRAM_TOKEN')
        if not self.TOKEN:
            raise ValueError("TELEGRAM_TOKEN नहीं मिला! कृपया अपनी .env फ़ाइल जांचें।")
        
        self.bot = telebot.TeleBot(self.TOKEN)
        self.setup_handlers()

    # --- कीबोर्ड बनाने वाले हेल्पर फंक्शन्स ---
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
            [InlineKeyboardButton("✅ BPSC Jobs", callback_data='jobs_bpsc')],
            [InlineKeyboardButton("👮 Bihar Police", callback_data='jobs_police')],
            [InlineKeyboardButton("🧑‍🏫 Teaching Jobs", callback_data='jobs_teaching')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)

    def _university_info_keyboard(self):
        """यूनिवर्सिटी जानकारी के सब-मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("🏛️ Patna University", callback_data='uni_patna')],
            [InlineKeyboardButton("🛠️ IIT Patna", callback_data='uni_iitp')],
            [InlineKeyboardButton("⚙️ NIT Patna", callback_data='uni_nitp')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)

    def _study_material_keyboard(self):
        """स्टडी मटेरियल के सब-मेनू का कीबोर्ड बनाता है।"""
        keyboard = [
            [InlineKeyboardButton("📑 सिलेबस", callback_data='study_syllabus')],
            [InlineKeyboardButton("📝 पिछले वर्ष के पेपर", callback_data='study_papers')],
            [InlineKeyboardButton("📕 मुफ्त PDFs", callback_data='study_pdfs')],
            [InlineKeyboardButton("⬅️ वापस मुख्य मेनू पर", callback_data='back_to_main')]
        ]
        return InlineKeyboardMarkup(keyboard)

    # --- बॉट के हैंडलर्स ---
    def setup_handlers(self):
        """टेलीग्राम कमांड्स और बटन्स के लिए हैंडलर्स सेट करता है।"""
        @self.bot.message_handler(commands=['start', 'help'])
        def send_welcome(message):
            welcome_text = "नमस्ते! 🙏\nबिहार एजुकेशन बॉट में आपका स्वागत है।\n\nकृपया नीचे दिए गए विकल्पों में से एक चुनें:"
            self.bot.send_message(message.chat.id, welcome_text, reply_markup=self._main_menu_keyboard())

        @self.bot.callback_query_handler(func=lambda call: True)
        def handle_callback_query(call):
            """सभी बटन क्लिक्स को हैंडल करता है।"""
            self.bot.answer_callback_query(call.id) # क्लिक का जवाब देना
            
            # मुख्य मेनू के विकल्प
            if call.data == 'menu_govt_jobs':
                self.bot.edit_message_text("सरकारी नौकरी श्रेणी चुनें:", chat_id=call.message.chat.id, message_id=call.message.message_id, reply_markup=self._govt_jobs_keyboard())
            
            elif call.data == 'menu_university_info':
                self.bot.edit_message_text("यूनिवर्सिटी चुनें:", chat_id=call.message.chat.id, message_id=call.message.message_id, reply_markup=self._university_info_keyboard())

            elif call.data == 'menu_study_material':
                self.bot.edit_message_text("स्टडी मटेरियल का प्रकार चुनें:", chat_id=call.message.chat.id, message_id=call.message.message_id, reply_markup=self._study_material_keyboard())

            elif call.data == 'menu_daily_quiz':
                self.bot.edit_message_text("डेली क्विज़ की सुविधा जल्द ही शुरू होगी!", chat_id=call.message.chat.id, message_id=call.message.message_id)

            # सब-मेनू के विकल्प
            elif call.data.startswith('jobs_'):
                job_type = call.data.split('_')[1].upper()
                self.bot.edit_message_text(f"आपने {job_type} नौकरियां चुनी हैं। अपडेट्स जल्द ही यहाँ मिलेंगे।", chat_id=call.message.chat.id, message_id=call.message.message_id)

            elif call.data.startswith('uni_'):
                uni_name = call.data.split('_')[1].upper()
                self.bot.edit_message_text(f"{uni_name} की जानकारी जल्द ही यहाँ उपलब्ध होगी।", chat_id=call.message.chat.id, message_id=call.message.message_id)

            elif call.data.startswith('study_'):
                material_type = call.data.split('_')[1].capitalize()
                self.bot.edit_message_text(f"{material_type} जल्द ही यहाँ अपलोड किए जाएंगे।", chat_id=call.message.chat.id, message_id=call.message.message_id)

            # वापस जाने का बटन
            elif call.data == 'back_to_main':
                welcome_text = "मुख्य मेनू पर वापस आ गए।\n\nकृपया नीचे दिए गए विकल्पों में से एक चुनें:"
                self.bot.edit_message_text(welcome_text, chat_id=call.message.chat.id, message_id=call.message.message_id, reply_markup=self._main_menu_keyboard())

    # --- शेड्यूलर के फंक्शन्स ---
    def send_daily_update(self):
        """दैनिक अपडेट भेजने का लॉजिक यहाँ आएगा।"""
        print("📰 दैनिक अपडेट भेजा जा रहा है...")

    def run_scheduler(self):
        """शेड्यूलर को चलाता है।"""
        schedule.every().day.at("08:00").do(self.send_daily_update)
        while True:
            schedule.run_pending()
            time.sleep(1)

