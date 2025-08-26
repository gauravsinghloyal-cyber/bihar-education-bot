from notifier import BiharEducationNotifier
import threading
import time
from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def home():
    return "Bihar Education Bot is running!"

@app.route('/health')
def health_check():
    return "OK"

def run_web_server():
    """Run Flask web server on port 5000"""
    print("Starting web server on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

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
    # Web server alag thread mein start karein
    web_thread = threading.Thread(target=run_web_server, daemon=True)
    web_thread.start()

     # Bot start karein (sirf production mein)
    if os.environ.get('RENDER'):  # Only run on Render
        run_bot()
    else:
        print("Bot not started locally - running on Render only")
        # Keep web server running for health checks
        while True:
            time.sleep(3600)
    
    # Bot start karein
    run_bot()