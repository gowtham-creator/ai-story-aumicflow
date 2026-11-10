# utils/history.py
from typing import List, Dict
from datetime import datetime

# If you can, use tiktoken to be precise. For brevity, we'll do a simple char budget.
MAX_CHARS = 12000  # ~4k tokens rough

def fetch_history_messages(mongo, conversation_id: str) -> List[Dict]:
    docs = list(
        mongo.chats.find({"conversation_id": conversation_id})
        .sort("created_at", 1)
    )

    msgs: List[Dict] = []
    for d in docs:
        msgs.append({"role": "user", "content": d["message"]})
        msgs.append({"role": "assistant", "content": d["reply"]})

    # Trim from the front if too long
    total = 0
    trimmed = []
    for m in reversed(msgs):
        total += len(m["content"])
        trimmed.append(m)
        if total >= MAX_CHARS:
            break
    trimmed.reverse()
    return trimmed
