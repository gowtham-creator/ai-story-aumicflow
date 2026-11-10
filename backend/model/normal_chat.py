from model.llm_provider import get_llm
import re
from typing import Iterable


def chat_response(messages: list, temp=0.7) -> str:
    """Non-streaming chat completion used by the existing /chat endpoint."""
    llm = get_llm("chat", temp=temp)
    res = llm.invoke(
        [
            {
                "role": "system",
                "content": "You are a friendly conversational assistant. Do not write stories unless explicitly asked. Respond clearly and naturally.",
            }
        ]
        + messages
    )
    text = res.content if hasattr(res, "content") else str(res)
    res_text = re.sub(r'#\s*', '', text)  # remove leading #
    res_text = re.sub(r'\*\*(.*?)\*\*', r'\1', res_text)  # remove **bold**
    res_text = re.sub(r'---+', '', res_text)  # remove ---
    res_text = re.sub(r'\n\s*\n\s*\n+', '\n\n', res_text)
    return res_text.strip()


def chat_response_stream(messages: list, temp=0.7) -> Iterable[str]:
    """Streaming chat completion.

    Yields small text chunks as they arrive from the underlying LLM.
    This works for both Azure/OpenAI Chat and any other Chat model that
    implements the LangChain `.stream()` interface.
    """
    llm = get_llm("chat", temp=temp)
    for chunk in llm.stream(
        [
            {
                "role": "system",
                "content": "You are a friendly conversational assistant. Do not write stories unless explicitly asked. Respond clearly and naturally.",
            }
        ]
        + messages
    ):
        text = chunk.content if hasattr(chunk, "content") else str(chunk)
        if not text:
            continue
        # For streaming we avoid heavy regex post-processing to keep
        # latency low and avoid issues with chunk boundaries.
        yield text
