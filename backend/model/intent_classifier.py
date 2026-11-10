import os
from model.llm_provider import get_llm
from config import ( PROMPTS_DIR)

# 1. Keywords that strongly imply a story-related *intent*.
# (This list remains unchanged)
STORY_KEYWORDS = [
    "story", "novel", "plot", "chapter", "scene", "narrative",
    "write", "generate", "continue", "compose", "tell me a",
    "character", "protagonist", "antagonist", "worldbuild",
    "fiction", "outline", "backstory", "CNW"
]

# 2. High-confidence "NO" filter for short, common replies.
# (This list remains unchanged)
SHORT_REPLIES_FILTER = [
    "fantasy", "science fiction", "sci-fi", "romance", "mystery",
    "thriller", "horror", "adventure", "historical", "drama",
    "dystopian", "crime", "yes", "no", "ok", "sure", "okay",
    "sounds good", "let's start", "i'm ready"
]

# 3. High-confidence "NO" filter for setup, rules, or role-playing.
# (This list remains unchanged)
SETUP_PHRASES_FILTER = [
    "you are", "you're", "your role is", "act as", "behave as",
    "keep these guidelines", "follow these steps",
    "as the customizable novel writer", "you're aiding me",
    "remember to", "await my reply",
    "propose genres", "offer 10 authors", "what about",
    "what do you think of", "is it a good idea"
]


def _llm():
    return get_llm("intent", temp=0.0)

def _load_prompt():
    with open(os.path.join(PROMPTS_DIR, "intent_check.txt"), "r", encoding="utf-8") as f:
        return f.read()

def _format_history_for_intent(history: list[dict]) -> str:
    """Formats the last 8 messages for the intent classifier."""
    if not history:
        return "No previous conversation history."
    
    # Get the last 8 messages (4 turns) to keep the prompt concise
    recent_history = history[-8:]
    lines = []
    for msg in recent_history:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)

# ✅ UPDATED FUNCTION SIGNATURE
def is_story_intent(message: str, history: list[dict]) -> bool:
    llm = _llm()
    lowered = message.lower().strip()
    history_has_story = False
    if history:
        last_assistant_msg = next((m for m in reversed(history) if m["role"] == "assistant"), None)
        if last_assistant_msg and "Story (so far) / Assistant:" in last_assistant_msg.get("content", ""):
            history_has_story = True

    # ✅ If previous message was a story → treat user message as continuation,
    # even if there are no keywords.
    if history_has_story:
        return True
    # === HEURISTIC FILTERS (Fast & Cheap) ===
    # These filters apply only to the *current* message
    if lowered in SHORT_REPLIES_FILTER:
        return False
    if any(phrase in lowered for phrase in SETUP_PHRASES_FILTER):
        return False
    if not any(keyword in lowered for keyword in STORY_KEYWORDS):
        return False

    # === LLM CLASSIFICATION (Slower & More Expensive) ===
    # Now we use the history to help the LLM decide
    
    prompt_template = _load_prompt()
    
    # ✅ NEW: Format history and inject both history and message
    history_str = _format_history_for_intent(history)
    
    prompt = prompt_template.replace("{chat_history}", history_str)
    prompt = prompt.replace("{user_message}", message)

    res = llm.invoke([
    {"role": "user", "content": prompt}
    ])
    answer = (res.content or "").strip().lower().replace(".", "").strip()

    return answer == "yes"