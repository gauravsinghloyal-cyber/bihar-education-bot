from notifier import BiharEducationNotifier
import threading
import time

def run_bot():
    print("Starting Bihar Education Updates Bot...")
    notifier = BiharEducationNotifier()
    
    # Run scheduler in background
    scheduler_thread = threading.Thread(target=notifier.run_scheduler, daemon=True)
    scheduler_thread.start()
    
    # Start bot polling
    print("Bot is now running...")
    notifier.bot.infinity_polling()

if __name__ == '__main__':
    run_bot()