from flask import Flask, request
from flask_cors import CORS
from flask_pymongo import PyMongo
from flask_sock import Sock
from config import Config
from routes.auth_routes import auth_bp
from routes.chat_routes import chat_bp
from retrieval.inspire_retrieve import load_faiss_index, load_summaries

from vosk import Model, KaldiRecognizer
import json
from datetime import datetime
import os

import logging
logging.getLogger().setLevel(logging.WARNING)
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo = PyMongo()

# Configure Vosk model path relative to this file (backend/)
BASE_DIR = os.path.dirname(__file__)
VOSK_MODEL_PATH = os.path.join(BASE_DIR, "models", "vosk-model-small-en-us-0.15")

# Try to load Vosk model, but don't crash the whole app if it's missing
try:
    vosk_model = Model(VOSK_MODEL_PATH)
except Exception as e:
    logger.warning("Vosk model not loaded from %s: %s", VOSK_MODEL_PATH, e)
    vosk_model = None

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    sock = Sock(app)
    
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "DELETE", "OPTIONS"]
    )
    
    try:
        # app.logger.info("Preloading FAISS index and inspiration summaries...")
        faiss_index = load_faiss_index()
        app.faiss_index = faiss_index
        app.inspiration_summaries = load_summaries()
        if faiss_index:
            app.logger.info("✅ FAISS index preloaded successfully.")
        else:
            app.logger.warning("⚠️ FAISS index not preloaded (not found or failed to load). Retrieval will fallback to on-demand load.")
    except Exception as e:
        # app.logger.exception(f"Error while preloading FAISS: {e}")
        app.faiss_index = None
        app.inspiration_summaries = {}
    @sock.route('/ws/stt')
    def stt(ws):
        """Speech-to-Text WebSocket endpoint"""
        # If the Vosk model failed to load, report an error gracefully
        if vosk_model is None:
            ws.send(json.dumps({
                "type": "error",
                "message": "Speech-to-text model is not available on the server."
            }))
            return

        # logger.info("=" * 50)
        # logger.info("✅ WebSocket connected")
        # logger.info(f"Client: {request.remote_addr}")
        # logger.info("=" * 50)
        
        rec = KaldiRecognizer(vosk_model, 16000)
        rec.SetWords(True)
        
        connection_active = True
        chunks_received = 0
        
        try:
            while connection_active:
                # logger.debug("Waiting for message...")
                msg = ws.receive()
                
                if msg is None:
                    # logger.warning("⚠️ ws.receive() returned None - client disconnected")
                    break
                
                # Handle binary audio data
                if isinstance(msg, (bytes, bytearray)):
                    chunks_received += 1
                    # logger.info(f"📡 [Chunk {chunks_received}] Audio received: {len(msg)} bytes")
                    
                    try:
                        if rec.AcceptWaveform(msg):
                            result = json.loads(rec.Result())
                            text = result.get("text", "")
                            
                            if text.strip():
                                # logger.info(f"✅ FINAL TEXT: '{text}'")
                                
                                # Send back to client
                                response = {
                                    "type": "final",
                                    "text": text,
                                    "timestamp": datetime.now().isoformat()
                                }
                                ws.send(json.dumps(response))
                                # logger.info(f"📤 Sent to client: {response}")
                                
                                # TODO: Save to MongoDB here
                                # db.chats.insert_one({"text": text, "type": "stt", ...})
                                
                        else:
                            partial = json.loads(rec.PartialResult())
                            text = partial.get("partial", "")
                            
                            if text.strip():
                                # logger.debug(f"🔄 Partial: '{text}'")
                                response = {
                                    "type": "partial",
                                    "text": text,
                                    "timestamp": datetime.now().isoformat()
                                }
                                ws.send(json.dumps(response))
                    
                    except Exception as e:
                        logger.error(f"❌ Error processing audio: {e}", exc_info=True)
                
                # Handle control messages (JSON strings)
                elif isinstance(msg, str):
                    # logger.debug(f"📝 Received control message: {msg}")
                    try:
                        ctrl = json.loads(msg)
                        
                        if ctrl.get("event") == "ping":
                            ws.send(json.dumps({"type": "pong", "timestamp": datetime.now().isoformat()}))
                            # logger.debug("🔄 Sent pong")
                        
                        elif ctrl.get("event") == "stop":
                            # logger.info("🛑 Stop event received")
                            final = json.loads(rec.FinalResult())
                            text = final.get("text", "")
                            
                            # if text.strip():
                            #     logger.info(f"✅ FINAL TEXT (on stop): '{text}'")
                            
                            response = {
                                "type": "final",
                                "text": text,
                                "timestamp": datetime.now().isoformat()
                            }
                            ws.send(json.dumps(response))
                            # logger.info(f"📤 Sent final to client: {response}")
                            connection_active = False
                        
                        elif ctrl.get("event") == "start":
                            # logger.info("▶️ Start event received")
                            ws.send(json.dumps({"type": "ready", "message": "Recording started"}))
                    
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ Invalid JSON: {msg} - {e}")
        
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        
        # finally:
        #     logger.info(f"🔌 Session ended. Total chunks: {chunks_received}")
            # logger.info("=" * 50)
    
    mongo.init_app(app)
    app.mongo = mongo
    
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5001, debug=False)
