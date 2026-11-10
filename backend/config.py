import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/elite_ai_db")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


BASE_DIR = os.path.dirname(__file__)
KNOWLEDGE_DIR = os.path.join(BASE_DIR, "knowledge")
INDEX_DIR = os.path.join(BASE_DIR, "data_index", "faiss_index")
SUMMARY_STORE = os.path.join(BASE_DIR, "data_index", "inspiration_summaries.json")
PROMPTS_DIR = os.path.join(BASE_DIR, "model", "prompts")

os.makedirs(os.path.dirname(INDEX_DIR), exist_ok=True)

CHUNK_SIZE = 1200     # chars
CHUNK_OVERLAP = 150   # chars

# ── Retrieval knobs
TOPK_DOCS = 10        # number of chunks fetched pre-summarization
TOPK_FOR_PROFILE = 6  # number of best summaries to fuse

# ── Generation
DEFAULT_STORY_PARAS = (6, 14) 

# ── Export Azure config for retrieval + story generator modules
AZURE_OPENAI_ENDPOINT = Config.AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY = Config.AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT = Config.AZURE_OPENAI_DEPLOYMENT_NAME
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = Config.AZURE_OPENAI_EMBEDDING_DEPLOYMENT

# Use the correct API version for Azure OpenAI
AZURE_OPENAI_API_VERSION = "2025-01-01-preview"
OPENAI_API_KEY = Config.OPENAI_API_KEY
ANTHROPIC_API_KEY = Config.ANTHROPIC_API_KEY

