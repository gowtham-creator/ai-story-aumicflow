# retrieval/inspire_retrieve.py
import os
import json
from typing import List, Dict, Optional
from flask import current_app
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI

from config import (
    INDEX_DIR, SUMMARY_STORE, PROMPTS_DIR,
    TOPK_DOCS, TOPK_FOR_PROFILE,
    AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT
)

from retrieval.embed_cache import (
    get_cached_embedding,
    store_cached_embedding,
    get_cached_hyde,
    store_cached_hyde
)

# ---------------- Embeddings ----------------
def _embeddings():
    return AzureOpenAIEmbeddings(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        azure_deployment=AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        openai_api_version=AZURE_OPENAI_API_VERSION
    )
try:
    embedder = _embeddings()
except Exception as e:
    import logging
    logging.warning(f"Embeddings unavailable: {e}")
    embedder = None

def embed(text: str):
    if embedder is None:
        return None
    cached = get_cached_embedding(text)
    if cached:
        return cached
    emb = embedder.embed_query(text)
    store_cached_embedding(text, emb)
    return emb


# ---------------- Light LLM (for HYDE & fuse) ----------------
def _llm(temp=0.2):
    return AzureChatOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        azure_deployment=AZURE_OPENAI_DEPLOYMENT,
        openai_api_version=AZURE_OPENAI_API_VERSION,
        temperature=temp
    )

def _load_prompt(name: str) -> str:
    with open(os.path.join(PROMPTS_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


# ---------------- Preload utilities ----------------
def load_faiss_index() -> Optional[FAISS]:
    """
    Load FAISS index from disk using the same embeddings implementation.
    Returns the FAISS instance, or None if load fails.
    Call this once at server startup and attach to current_app.
    """
    try:
        vs = FAISS.load_local(INDEX_DIR, embedder, allow_dangerous_deserialization=True)
        return vs
    except Exception as e:
        # Do not crash server — log and return None
        # import logging
        # logging.getLogger(__name__).warning(f"Could not preload FAISS index from {INDEX_DIR}: {e}")
        return None


def load_summaries() -> Dict[str, dict]:
    try:
        with open(SUMMARY_STORE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


# ---------------- HYDE With Caching ----------------
def generate_hyde_subqueries(user_request: str) -> List[str]:
    cached = get_cached_hyde(user_request)
    if cached:
        return cached

    llm = _llm(temp=0.3)
    prompt = _load_prompt("subquery_hyde_prompt.txt").format(user_request=user_request)
    res = llm.invoke(prompt)
    raw_lines = [l.strip("- ").strip() for l in res.content.split("\n") if l.strip()]

    subqs = list(dict.fromkeys(raw_lines))[:6]
    store_cached_hyde(user_request, subqs)
    return subqs


# ---------------- Main Retrieval ----------------
def retrieve_inspiration_profile(user_request: str) -> dict:
    """
    Returns a fused inspiration profile dictionary.
    Uses preloaded FAISS index and summaries if available on current_app.
    Falls back to loading from disk if not preloaded (safe but slower).
    Returns empty profile if embeddings are unavailable.
    """
    # If embeddings are not available, skip retrieval entirely
    if embedder is None:
        return {"voice": "", "tone": "", "archetypes": [], "motifs": [], "pacing": "", "style_notes": ""}

    # prefer preloaded index
    vs = getattr(current_app, "faiss_index", None)
    if vs is None:
        # fallback (slower)
        try:
            vs = FAISS.load_local(INDEX_DIR, embedder, allow_dangerous_deserialization=True)
        except Exception as e:
            # No index — return empty minimal profile
            # current_app.logger.warning(f"FAISS index missing and failed to load: {e}")
            return {"voice": "", "tone": "", "archetypes": [], "motifs": [], "pacing": "", "style_notes": ""}

    summaries = getattr(current_app, "inspiration_summaries", None)
    if summaries is None:
        summaries = load_summaries()

    subqs = generate_hyde_subqueries(user_request)

    hits = {}
    for q in subqs:
        q_vec = embed(q)
        # use similarity_search_by_vector for speed
        try:
            docs = vs.similarity_search_by_vector(q_vec, k=TOPK_DOCS)
        except Exception:
            # fallback to text-based search (if vector API missing)
            docs = vs.similarity_search(q, k=TOPK_DOCS)

        for d in docs:
            key = f"{d.metadata.get('filename','')}:::{d.metadata.get('chunk_id','')}"
            hits[key] = hits.get(key, 0) + 1

    ranked = sorted(hits.keys(), key=lambda k: hits[k], reverse=True)[:TOPK_FOR_PROFILE]
    picked = [summaries[k] for k in ranked if k in summaries]

    # Fuse into a single profile using the LLM
    llm = _llm(temp=0.0)
    fuse_prompt = _load_prompt("inspiration_profile_fuser.txt").format(items=json.dumps(picked, ensure_ascii=False))
    fused = llm.invoke(fuse_prompt)

    try:
        return json.loads(fused.content)
    except Exception:
        return {
            "voice": "",
            "tone": "",
            "archetypes": [],
            "motifs": [],
            "pacing": "",
            "style_notes": fused.content[:800]
        }
