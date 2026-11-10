import json
import os
from typing import Dict, List, Iterable, Optional
import re
from model.llm_provider import get_llm
from config import (
 PROMPTS_DIR
)


def clean_markdown(text: str) -> str:
    # Remove markdown headings (#, ##, ### etc.)
    text = re.sub(r'^\s*#+\s*', '', text, flags=re.MULTILINE)

    # Remove bold/italic markers
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'_(.*?)_', r'\1', text)

    # Remove ==highlight==
    text = re.sub(r'==([^=]+)==', r'\1', text)

    # Remove horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)

    # Remove stray bullets
    text = re.sub(r'^[\*\-\+]\s+', '', text, flags=re.MULTILINE)

    # --- Trim trailing whitespace on every line ---
    lines = text.splitlines()
    lines = [re.sub(r'\s+$', '', line) for line in lines]
    text = "\n".join(lines)

    # Remove any leftover unicode trailing spaces
    text = re.sub(r'[ \t\u00A0\u2000-\u200B]+$', '', text, flags=re.MULTILINE)

    # --- NOW collapse multiple blank lines ---
    text = re.sub(r'(?:\r?\n[\t \u00A0\u2000-\u200B]*){2,}', '\n', text)

    # Strip leading/trailing blank lines
    text = text.strip()

    return text


def _llm(temp=0.3):
    return get_llm("story", temp=temp)


def _load_prompt(name: str) -> str:
    with open(os.path.join(PROMPTS_DIR, name), "r", encoding="utf-8") as f:
        return f.read()

def _format_history_for_story(history: List[Dict]) -> str:
    if not history:
        return "No previous story context."
    lines = []
    for msg in history:
        if msg.get("role") == "user":
            lines.append(f"User: {msg.get('content','')}")
        elif msg.get("role") == "assistant":
            lines.append(f"Story (so far) / Assistant: {msg.get('content','')}")
    return "\n".join(lines)


def _build_story_prompt(inspiration_profile: dict, user_request: str, history: list, params: Optional[dict] = None) -> str:
    """Shared helper to construct the full story prompt string."""
    params = params or {}

    # Build context string from params (optional creative parameters)
    context_lines = []
    mapping = {
        "genre": "Genre",
        "setting": "Setting",
        "character": "Characters",
        "tone": "Writer Tone",
        "theme": "Theme",
        "narrativeStyle": "Narrative Style",
        "inspiration": "Inspiration",
    }
    for key, label in mapping.items():
        if params.get(key):
            context_lines.append(f"**{label}:** {params[key]}")
    context_str = "\n".join(context_lines) or "No additional creative parameters."

    history_str = _format_history_for_story(history)
    template = _load_prompt("story_prompt.txt")

    # Make the substitution safe by JSON-encoding complex objects
    inspiration_json = json.dumps(inspiration_profile or {}, ensure_ascii=False, indent=2)

    try:
        story_prompt = template.format(
            inspiration_profile=inspiration_json,
            context=context_str,
            chat_history=history_str,
            user_request=user_request,
        )
    except KeyError as e:
        missing = e.args[0] if e.args else "unknown"
        raise ValueError(
            f"Prompt template expects placeholder {{{missing}}} but it was not supplied. Check story_prompt.txt."
        ) from e

    return story_prompt


def generate_story(inspiration_profile: dict, user_request: str, history: list, params: dict = None) -> str:
    """Non-streaming story generation used by the existing /chat endpoint."""
    llm = _llm(temp=0.9)
    story_prompt = _build_story_prompt(inspiration_profile, user_request, history, params)

    res = llm.invoke([{"role": "user", "content": story_prompt}])
    text = res.content if hasattr(res, "content") else str(res)
    res_text = clean_markdown(text)
    return res_text.strip()


def generate_story_stream(
    inspiration_profile: dict,
    user_request: str,
    history: list,
    params: Optional[dict] = None,
) -> Iterable[str]:
    """Streaming version of story generation.

    Yields raw text chunks from the Anthropic (or configured "story") model.
    Markdown/formatting is left as-is for streaming to avoid expensive
    post-processing on every token.
    """
    llm = _llm(temp=0.9)
    story_prompt = _build_story_prompt(inspiration_profile, user_request, history, params)

    for chunk in llm.stream([{"role": "user", "content": story_prompt}]):
        text = chunk.content if hasattr(chunk, "content") else str(chunk)
        if not text:
            continue
        yield text
