import sys
import os
import threading
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS
import db
from main import run_bot

# Redirect stdout and stderr to a file so we can view them via the /logs route
class Logger(object):
    def __init__(self):
        self.terminal = sys.stdout
        self.log = open("bot_server.log", "a", encoding="utf-8", buffering=1)

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()

sys.stdout = Logger()
sys.stderr = Logger()

app = Flask(__name__)
CORS(app)

bot_is_running = False
_pending_verification_code = None

def _get_and_clear_pending_code():
    global _pending_verification_code
    code = _pending_verification_code
    _pending_verification_code = None  # Clear/consume the code once retrieved
    return code

# Expose the pending code for the bot thread to read
import db as _db_module
_db_module._pending_code_store = _get_and_clear_pending_code

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

    # Extract the user's Supabase JWT, user_id, and optional config from the request body
    data = request.get_json(silent=True) or {}
    jwt_token = data.get("jwt_token", "")
    user_id   = data.get("user_id", "")
    supabase_url = data.get("supabase_url", "")
    supabase_anon_key = data.get("supabase_anon_key", "")

    if not jwt_token or not user_id:
        return jsonify({"error": "Missing jwt_token or user_id. Cannot identify user."}), 400

    # If the frontend sent its own Supabase URL/Key, configure db dynamically
    # to guarantee 100% plug-and-play synchronization between Vercel and Render databases.
    if supabase_url and supabase_anon_key:
        db.set_supabase_config(supabase_url, supabase_anon_key)

    # Inject the user's identity into the db module so all Supabase calls
    # operate on behalf of this specific user — no hardcoded credentials needed.
    db.set_user_token(jwt_token, user_id)
        
    bot_is_running = True
    
    # Start the Playwright script in a background thread so the HTTP request completes instantly
    thread = threading.Thread(target=background_task)
    thread.start()
    
    return jsonify({"message": "Bot launched successfully"}), 200


@app.route('/submit-code', methods=['POST'])
def submit_code():
    global _pending_verification_code
    data = request.get_json()
    code = data.get("code", "").strip()
    if not code:
        return jsonify({"error": "No code provided"}), 400
    _pending_verification_code = code
    return jsonify({"message": "Code received"}), 200

@app.route('/logs', methods=['GET'])
def get_server_logs():
    if os.path.exists("bot_server.log"):
        with open("bot_server.log", "r", encoding="utf-8") as f:
            return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "No logs found on server.", 404

if __name__ == '__main__':
    # Start the server on port 8080 (standard for Render and other PaaS)
    app.run(host='0.0.0.0', port=8080)

