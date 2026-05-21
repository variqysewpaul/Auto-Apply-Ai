import threading
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS
import db
from main import run_bot

app = Flask(__name__)
CORS(app)

bot_is_running = False

def background_task():
    global bot_is_running
    try:
        db.log_bot_event("log", {"message": "Cloud bot initializing in background..."})
        run_bot()
        db.log_bot_event("log", {"message": "Cloud bot session finished normally."})
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in background task: {e}\n{error_trace}")
        db.log_bot_event("log", {"message": f"Cloud bot crashed: {str(e)}"})
    finally:
        bot_is_running = False

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "bot_running": bot_is_running})

@app.route('/start-crawl', methods=['POST'])
def start_crawl():
    global bot_is_running
    
    # Simple check to prevent overlapping runs on the same tiny server
    if bot_is_running:
        return jsonify({"error": "Bot is already running"}), 409
        
    bot_is_running = True
    
    # Start the Playwright script in a background thread so the HTTP request completes instantly
    thread = threading.Thread(target=background_task)
    thread.start()
    
    return jsonify({"message": "Bot launched successfully"}), 200

if __name__ == '__main__':
    # Start the server on port 8080 (standard for Render and other PaaS)
    app.run(host='0.0.0.0', port=8080)
