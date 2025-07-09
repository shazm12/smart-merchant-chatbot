from flask import Flask, request, jsonify, send_file, session
from flask_cors import CORS
import os
import json
import tempfile
import requests
from dotenv import load_dotenv
from deep_translator import GoogleTranslator
from groq import Groq
import base64
from io import BytesIO
import uuid
from datetime import datetime, timedelta
import re

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here')  # Add to .env file
CORS(app, supports_credentials=True)

# In-memory conversation storage (use Redis/Database for production)
conversation_store = {}

# Load business data
try:
    with open("merchant_sales_3months.json") as f:
        business_data = json.load(f)
        print("✅ JSON loaded. Entries:", len(business_data))
except Exception as e:
    print("❌ Failed to load JSON:", e)
    business_data = []

# GROQ setup
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

class ConversationManager:
    def __init__(self):
        self.conversations = {}
    
    def get_or_create_conversation(self, session_id):
        if session_id not in self.conversations:
            self.conversations[session_id] = {
                'messages': [],
                'context': {},
                'created_at': datetime.now(),
                'last_activity': datetime.now()
            }
        return self.conversations[session_id]
    
    def add_message(self, session_id, user_message, bot_response, language):
        conversation = self.get_or_create_conversation(session_id)
        conversation['messages'].append({
            'user': user_message,
            'bot': bot_response,
            'language': language,
            'timestamp': datetime.now().isoformat()
        })
        conversation['last_activity'] = datetime.now()
        
        # Keep only last 10 messages for context
        if len(conversation['messages']) > 10:
            conversation['messages'] = conversation['messages'][-10:]
    
    def get_context(self, session_id):
        conversation = self.get_or_create_conversation(session_id)
        return conversation['messages']
    
    def cleanup_old_conversations(self, hours=24):
        cutoff = datetime.now() - timedelta(hours=hours)
        to_remove = []
        for session_id, conv in self.conversations.items():
            if conv['last_activity'] < cutoff:
                to_remove.append(session_id)
        
        for session_id in to_remove:
            del self.conversations[session_id]

# Initialize conversation manager
conv_manager = ConversationManager()

# Your existing helper functions remain the same...
def translate_text(text, from_lang="en", to_lang="en"):
    try:
        if from_lang == to_lang:
            return text
        return GoogleTranslator(source=from_lang, target=to_lang).translate(text)
    except Exception as e:
        print("Translation failed:", e)
        return text

def detect_language(text):
    try:
        from langdetect import detect
        detected = detect(text)
        print(f"🔍 langdetect result: {detected}")
        return detected
    except Exception as e:
        print(f"langdetect failed: {e}")
        return detect_lang_fallback(text)

def detect_lang_fallback(query):
    kannada_keywords = ["ನಮ್ಮ", "ಮಾರಾಟ", "ಎಷ್ಟು", "ಹೇಗೆ", "ಯಾವುದು", "ಕನ್ನಡ", "ಬಿಲ್", "ಹಣ"]
    hindi_keywords = ["बिक्री", "कितनी", "कैसे", "क्या", "हमारी", "पैसे", "कमाई", "व्यापार"]
    oriya_keywords = ["ବିକ୍ରି", "କେତେ", "କିପରି", "କଣ", "ଆମର", "ଟଙ୍କା", "ବ୍ୟବସାୟ"]
    
    def has_kannada_chars(text):
        return any('\u0C80' <= char <= '\u0CFF' for char in text)
    
    def has_hindi_chars(text):
        return any('\u0900' <= char <= '\u097F' for char in text)
    
    def has_oriya_chars(text):
        return any('\u0B00' <= char <= '\u0B7F' for char in text)
    
    if has_kannada_chars(query):
        return "kn"
    elif has_hindi_chars(query):
        return "hi"
    elif has_oriya_chars(query):
        return "or"
    
    query_lower = query.lower()
    if any(word in query for word in kannada_keywords):
        return "kn"
    elif any(word in query for word in hindi_keywords):
        return "hi"
    elif any(word in query for word in oriya_keywords):
        return "or"
    
    return "en"

def get_lang_code(lang):
    lang_mapping = {
        "kn": "kn-IN",
        "hi": "hi-IN", 
        "or": "or-IN",
        "en": "en-US",
        "kannada": "kn-IN",
        "hindi": "hi-IN",
        "oriya": "or-IN",
        "english": "en-US"
    }
    return lang_mapping.get(lang.lower(), "en-US")

def normalize_lang_code(lang):
    lang_mapping = {
        "kannada": "kn",
        "hindi": "hi",
        "oriya": "or", 
        "odia": "or",
        "english": "en",
        "kn-in": "kn",
        "hi-in": "hi",
        "or-in": "or",
        "en-us": "en"
    }
    return lang_mapping.get(lang.lower(), lang.lower()[:2])

def generate_prompt(translated_query, structured_data, original_input, language):
    recent_data = structured_data[-7:] if len(structured_data) >= 7 else structured_data
    last_month_data = structured_data[-31] if len(structured_data) >= 31 else {}

    last_month_sales = sum(order.get('total_amount', 0) for order in last_month_data.get('orders', []))
    current_month_sales = sum(
        order.get('total_amount', 0)
        for day in recent_data
        for order in day.get('orders', [])
    )
    avg_order_value = sum(day.get('average_order_value', 0) for day in recent_data) / len(recent_data) if recent_data else 0

    prompt = f"""
You are a smart, friendly sales consultant for a small business owner (like a restaurant).
Your job is to answer questions, provide insights, and help the merchant improve their sales.

Language context: The user is speaking in {language}
Original Query: {original_input}
Translated Query: {translated_query}

Business Data:
- Last month\'s sales: ₹{last_month_sales:.2f}
- This month so far: ₹{current_month_sales:.2f} (last 7 days)
- Average order value: ₹{avg_order_value:.2f}

Answer in clear, friendly language. Keep your response concise and helpful.
Focus on the specific question asked and provide actionable insights.

Also, suggest 2–3 intelligent follow-up questions the merchant might want to ask next based on this data.
Output the follow-ups in a JSON array format like: ["Prompt 1", "Prompt 2", "Prompt 3"]
"""
    return prompt
"""
def call_groq(prompt):
    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful business assistant that provides concise, actionable insights."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        response = chat_completion.choices[0].message.content.strip()
        match = re.search(r'\[.*?\]', response, re.DOTALL)
        recos = json.loads(match.group(0)) if match else []
        main_response = response.replace(match.group(0), '').strip() if match else response
        return main_response, recos
    except Exception as e:
        print(f"Groq API error: {e}")
        return "Sorry, there was an error processing your request.", []
"""

def call_groq(prompt):
    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful business assistant that provides concise, actionable insights."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        response = chat_completion.choices[0].message.content.strip()
        print("🧠 Full Groq response:\n", response)

        # Extract all JSON-like arrays (even if there's more than one)
        arrays = re.findall(r'\[[^\[\]]*\]', response, re.DOTALL)
        for arr in arrays:
            try:
                parsed = json.loads(arr)
                if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                    recos = parsed
                    break
            except Exception as e:
                print(f"❌ Failed to parse follow-up array: {e}")
        print(f"recos:{recos}")
        main_response = response.replace(json.dumps(recos), '').strip() if recos else response
        return main_response, recos
    except Exception as e:
        print(f"Groq API error: {e}")
        return "Sorry, there was an error processing your request.", []

# Text-to-speech functions (keeping your existing implementation)
def text_to_speech(text, language="en", voice_name=None):
    try:
        from gtts import gTTS
        
        gtts_lang_map = {
            "en": "en",
            "hi": "hi", 
            "kn": "kn",
            "or": "or",
            "en-us": "en",
            "hi-in": "hi",
            "kn-in": "kn", 
            "or-in": "or"
        }
        
        gtts_lang = gtts_lang_map.get(language.lower(), "en")
        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tts.save(tmp_file.name)
            return tmp_file.name
            
    except Exception as e:
        print(f"gTTS failed: {e}")
        return None

def convert_audio_to_base64(audio_file_path):
    try:
        with open(audio_file_path, 'rb') as audio_file:
            audio_data = audio_file.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            return audio_base64
    except Exception as e:
        print(f"Audio conversion failed: {e}")
        return None

def transcribe_audio_with_groq(audio_path):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }
    
    try:
        with open(audio_path, "rb") as audio_file:
            files = {
                "file": audio_file
            }
            data = {
                "model": "whisper-large-v3"
            }
            response = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions", 
                headers=headers, 
                files=files, 
                data=data,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Groq Whisper API error: {e}")
        raise e

# --- ENDPOINTS ---

@app.route("/start-session", methods=["POST"])
def start_session():
    session_id = str(uuid.uuid4())
    conv_manager.get_or_create_conversation(session_id)
    return jsonify({"session_id": session_id})

@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    user_input = data.get("text", "")

    if not user_input.strip():
        return jsonify({"error": "Empty input provided"}), 400

    detected_lang = detect_language(user_input)
    detected_lang = normalize_lang_code(detected_lang)
    lang_code = get_lang_code(detected_lang)
    translated_input = translate_text(user_input, from_lang=detected_lang, to_lang="en")
    prompt = generate_prompt(translated_input, business_data, user_input, detected_lang)

    try:
        answer, recos = call_groq(prompt)
    except Exception as e:
        return jsonify({"reply": f"Error getting response: {e}", "lang_code": lang_code}), 500


    return jsonify({
        "reply": answer,
        "original_language": detected_lang,
        "lang_code": lang_code,
        "recommendations": recos
    })

def transcribe_audio_with_groq(audio_path):
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    with open(audio_path, "rb") as audio_file:
        files = {"file": audio_file}
        data = {"model": "whisper-large-v3"}
        response = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", headers=headers, files=files, data=data, timeout=30)
        response.raise_for_status()
        return response.json()

@app.route("/audio-query", methods=["POST"])
def audio_query():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        result = transcribe_audio_with_groq(tmp_path)
        transcript = result["text"]
        whisper_lang = result.get("language", "en")
                # ✅ Add these print statements
        print("\n📝 Transcribed Text:", transcript)
        print("🌐 Whisper Language:", whisper_lang)

        detected_lang = normalize_lang_code(detect_language(transcript))
        print("🈶 Final Detected Lang:", detected_lang)
        #detected_lang = normalize_lang_code(detect_language(transcript))

        lang_code = get_lang_code(detected_lang)
    except Exception as e:
        return jsonify({"error": f"Audio transcription failed: {e}"}), 500
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)

    translated_input = translate_text(transcript, from_lang=detected_lang, to_lang="en")
    prompt = generate_prompt(translated_input, business_data, transcript, detected_lang)

    try:
        answer, recos = call_groq(prompt)
    except Exception as e:
        return jsonify({"reply": f"Error getting response: {e}", "lang_code": lang_code}), 500

    audio_file_path = text_to_speech(answer, detected_lang)
    audio_base64 = convert_audio_to_base64(audio_file_path) if audio_file_path else None
    if audio_file_path: os.remove(audio_file_path)

    return jsonify({
        "reply": answer,
        "original_language": detected_lang,
        "lang_code": lang_code,
        "transcript": transcript,
        "spoken": True,
        "audio": audio_base64,
        "audio_format": "mp3" if audio_base64 else None,
        "recommendations": recos
    })

@app.route("/conversation-history/<session_id>", methods=["GET"])
def get_conversation_history(session_id):
    history = conv_manager.get_context(session_id)
    return jsonify({"history": history})

@app.route("/clear-conversation/<session_id>", methods=["DELETE"])
def clear_conversation(session_id):
    if session_id in conv_manager.conversations:
        del conv_manager.conversations[session_id]
        return jsonify({"message": "Conversation cleared"})
    return jsonify({"error": "Session not found"}), 404

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "data_loaded": len(business_data) > 0})

# Periodic cleanup
@app.before_request
def cleanup_conversations():
    conv_manager.cleanup_old_conversations()

if __name__ == "__main__":
    app.run(debug=True, port=5000)