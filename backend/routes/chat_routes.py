# routes/chat_routes.py
from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
from utils.jwt_utils import decode_jwt
from datetime import datetime
from bson import ObjectId
import traceback
import sys
# from with_embeddings import answer_question
from retrieval.inspire_retrieve import retrieve_inspiration_profile
from model.story_generator import generate_story, generate_story_stream
from model.intent_classifier import is_story_intent
from model.normal_chat import chat_response, chat_response_stream
from utils.history import fetch_history_messages

chat_bp = Blueprint("chat", __name__)

def _require_auth():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = decode_jwt(token) if token else None
    if not user_data:
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return user_data, None

@chat_bp.route("/clear_conversation", methods=["POST"])
def clear_conversation():
    data = request.json
    conversation_id = data.get("conversation_id")
    user_id = getattr(request, "user_id", None)  # however you store auth

    query = {"conversation_id": conversation_id}

    # ✅ Only include user_id filter if logged in
    if user_id is not None:
        query["user_id"] = user_id
    else:
        query["user_id"] = None

    result = current_app.mongo.db.chats.delete_many(query)

    return jsonify({"status": "success", "deleted": result.deleted_count})


@chat_bp.route("/clear_all_conversations", methods=["POST"])
def clear_all_conversations():
    user_id = getattr(request, "user_id", None)

    if user_id:
        # Logged-in user → delete only their chats
        result = current_app.mongo.db.chats.delete_many({"user_id": user_id})
    else:
        # ✅ Guest → delete all chats where user_id is null
        result = current_app.mongo.db.chats.delete_many({"user_id": None})

    return jsonify({"status": "success", "deleted": result.deleted_count})


@chat_bp.route("/chat", methods=["POST"])
def chat():
    """Non-streaming chat endpoint (kept for compatibility).

    The frontend can optionally use `/chat_stream` for token streaming.
    """
    mongo = current_app.mongo.db
    data = request.get_json(silent=True) or {}
    payload = data.get("payload", data)

    message = (payload.get("message") or "").strip()
    params = payload.get("params", {}) or {}
    conversation_id = payload.get("conversation_id")

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = decode_jwt(token) if token else None
    user_id = user_data.get("user_id") if user_data else None

    if not message:
        return jsonify({"error": "Message is required"}), 400
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    try:
        # ✅ Load history
        prior = fetch_history_messages(mongo, conversation_id)

        full_messages = prior + [{"role": "user", "content": message}]

        if is_story_intent(message, prior):
            profile = retrieve_inspiration_profile(message)
            reply = generate_story(profile, message, prior, params=params)
        else:
            reply = chat_response(full_messages)

    except Exception as e:
        traceback.print_exc()
        reply = f"⚠️ Error generating reply: {e}"

    # ✅ Save turn
    chat_doc = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "message": message,
        "reply": reply,
        "parameters": params,
        "created_at": datetime.utcnow(),
    }
    mongo.chats.insert_one(chat_doc)

    return jsonify({"reply": reply, "conversation_id": conversation_id})


@chat_bp.route("/chat_stream", methods=["POST"])
def chat_stream():
    """Streaming chat endpoint.

    Streams tokens from the underlying model (Anthropic for stories,
    Azure/OpenAI Chat for normal chat) as a plain text HTTP response.
    """
    mongo = current_app.mongo.db
    data = request.get_json(silent=True) or {}
    payload = data.get("payload", data)

    message = (payload.get("message") or "").strip()
    params = payload.get("params", {}) or {}
    conversation_id = payload.get("conversation_id")

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = decode_jwt(token) if token else None
    user_id = user_data.get("user_id") if user_data else None

    if not message:
        return jsonify({"error": "Message is required"}), 400
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    # Pre-load history once for both routing and for the final DB write
    prior = fetch_history_messages(mongo, conversation_id)
    full_messages = prior + [{"role": "user", "content": message}]

    reply_holder = {"text": ""}

    def generate():
        try:
            if is_story_intent(message, prior):
                profile = retrieve_inspiration_profile(message)
                stream_iter = generate_story_stream(profile, message, prior, params=params)
            else:
                stream_iter = chat_response_stream(full_messages)

            for chunk in stream_iter:
                reply_holder["text"] += chunk
                yield chunk
        except Exception as e:
            traceback.print_exc()
            err_msg = f"\n⚠️ Error generating reply: {e}"
            reply_holder["text"] += err_msg
            yield err_msg
        finally:
            try:
                chat_doc = {
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "message": message,
                    "reply": reply_holder["text"],
                    "parameters": params,
                    "created_at": datetime.utcnow(),
                }
                mongo.chats.insert_one(chat_doc)
            except Exception:
                traceback.print_exc()

    return Response(stream_with_context(generate()), mimetype="text/plain")


@chat_bp.route("/history", methods=["GET"])
def chat_history_grouped():
    mongo = current_app.mongo.db
    user_data, error = _require_auth()
    if error:
        return error

    user_id = user_data["user_id"]

    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"created_at": 1}},
        {
            "$group": {
                "_id": "$conversation_id",
                "docs": {"$push": {
                    "message": "$message",
                    "reply": "$reply",
                    "created_at": "$created_at"
                }},
                "first_created": {"$first": "$created_at"},
                "last_created": {"$last": "$created_at"}
            }
        },
        {"$sort": {"last_created": -1}},
    ]

    groups = list(mongo.chats.aggregate(pipeline))

    conversations = []
    for g in groups:
        conv_id = g["_id"]
        docs = g["docs"]  # oldest -> newest because of $sort above

        messages = []
        for d in docs:
            messages.append({
                "role": "user",
                "content": d["message"],
                "created_at": d["created_at"].isoformat() if d.get("created_at") else None
            })
            messages.append({
                "role": "assistant",
                "content": d["reply"],
                "created_at": d["created_at"].isoformat() if d.get("created_at") else None
            })

        # Title = first user message (first pair)
        first_user = next((m for m in messages if m["role"] == "user"), None)
        title = (first_user["content"][:40] + "…") if first_user and len(first_user["content"]) > 40 else (first_user["content"] if first_user else "Conversation")

        conversations.append({
            "conversation_id": conv_id,
            "title": title or "Conversation",
            "created_at": g["first_created"].isoformat() if g.get("first_created") else None,
            "updated_at": g["last_created"].isoformat() if g.get("last_created") else None,
            "messages": messages,
        })

    return jsonify(conversations)

@chat_bp.route("/history/<conversation_id>", methods=["GET"])
def chat_history_by_conversation(conversation_id):
    mongo = current_app.mongo.db
    """Return messages for a specific conversation (ascending time)."""
    user_data, error = _require_auth()
    if error:
        return error

    user_id = user_data["user_id"]

    docs = list(
        mongo.chats.find(
            {"user_id": user_id, "conversation_id": conversation_id}
        ).sort("created_at", 1)
    )

    messages = []
    for d in docs:
        ca = d.get("created_at")
        ca_str = ca.isoformat() if ca else None
        messages.append({"role": "user", "content": d["message"], "created_at": ca_str})
        messages.append({"role": "assistant", "content": d["reply"], "created_at": ca_str})

    title = messages[0]["content"] if messages and messages[0]["role"] == "user" else "Conversation"
    if title and len(title) > 40:
        title = title[:40] + "…"

    return jsonify({
        "conversation_id": conversation_id,
        "title": title,
        "messages": messages
    })
