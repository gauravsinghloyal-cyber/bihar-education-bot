import os
import threading
import time
from flask import Flask
from notifier import BiharEducationNotifier

app = Flask(__name__)

@app.route('/')
def home():
    return "✅ Bihar Education Bot is running successfully!"

@app.route('/health')
def health_check():
    return "🟢 OK - Bot is healthy"

@app.route('/status')
def status_check():
    return {
        "status": "running",
        "service": "Bihar Education Bot",
        "version": "1.0",
        "update_interval": "30 minutes"
    }

def run_web_server():
    """Run Flask web server on port 5000"""
    print("🌐 Starting web server on port 5000...")
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    except Exception as e:
        print(f"❌ Web server error: {e}")

def run_bot():
    """Run the main bot functionality"""
    print("🤖 Starting Bihar Education Updates Bot...")
    try:
        notifier = BiharEducationNotifier()
        
        # Run scheduler in background for automatic updates
        scheduler_thread = threading.Thread(target=notifier.run_scheduler, daemon=True)
        scheduler_thread.start()
        
        print("✅ Bot scheduler started in background")
        print("🔄 Automatic updates every 30 minutes")
        
        # Start bot polling for Telegram commands
        print("📱 Starting Telegram bot polling...")
        notifier.bot.infinity_polling()
        
    except Exception as e:
        print(f"❌ Bot startup error: {e}")
        print("🔄 Restarting bot in 10 seconds...")
        time.sleep(10)
        run_bot()  # Auto-restart

if __name__ == '__main__':
    print("=" * 50)
    print("🎓 Bihar Education Bot - Starting Up")
    print("=" * 50)
    
    # Web server always run karein (Render ke liye required)
    web_thread = threading.Thread(target=run_web_server, daemon=True)
    web_thread.start()
    
    # Wait for web server to start
    time.sleep(2)
    
    # Check if running on Render production environment
    is_production = os.environ.get('RENDER') or os.environ.get('PRODUCTION')
    
    if is_production:
        print("🚀 Production environment detected - Starting bot")
        run_bot()
    else:
        print("💻 Development environment - Bot not started")
        print("📊 Web server is running for health checks")
        print("🌐 Open: http://localhost:5000")
        print("🔍 Health check: http://localhost:5000/health")
        
        # Keep the application running
        try:
            while True:
                time.sleep(3600)  # Sleep for 1 hour
        except KeyboardInterrupt:
            print("\n🛑 Bot stopped by user")