# llm_provider.py
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_anthropic import ChatAnthropic
from config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY
)

def get_llm(mode="chat", temp=0.7):
    """
    mode: "chat", "intent", "story"
    """

    MODEL_MAP = {
        "chat": {
            "azure": AZURE_OPENAI_DEPLOYMENT
        },
        "intent": {
            "azure": AZURE_OPENAI_DEPLOYMENT
        },
        "story": {
            "anthropic": "claude-sonnet-4-5-20250929"
        }
    }
    PROVIDER_MAP = {
        "chat": "azure",
        "intent": "azure",
        "story": "anthropic"
    }

    provider = PROVIDER_MAP[mode]

    # pick correct model for this mode + provider
    model_name = MODEL_MAP[mode][provider]

    # OpenAI
    if provider == "openai":
        return ChatOpenAI(
            model=model_name,
            api_key=OPENAI_API_KEY,
            temperature=temp
        )

    # Anthropic
    if provider == "anthropic":
        return ChatAnthropic(
            model=model_name,
            api_key=ANTHROPIC_API_KEY,
            temperature=temp,
            max_tokens=8192
        )

    # Azure OpenAI (if used)
    if provider == "azure":
        return AzureChatOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
            azure_deployment=model_name,
            openai_api_version=AZURE_OPENAI_API_VERSION,
            temperature=temp
        )

    raise Exception(f"Unknown provider: {provider}")
