# retrieval/embed_cache.py
from hashlib import sha256
from flask import current_app

def _hash(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


# ---------- EMBEDDING CACHE ----------
def get_cached_embedding(text: str):
    mongo = current_app.mongo.db.embedding_cache
    key = _hash(text)
    item = mongo.find_one({"_id": key})
    return item["embedding"] if item else None


def store_cached_embedding(text: str, embedding):
    mongo = current_app.mongo.db.embedding_cache
    key = _hash(text)
    mongo.update_one(
        {"_id": key},
        {"$set": {"embedding": embedding}},
        upsert=True
    )


# ---------- HYDE CACHE ----------
def get_cached_hyde(text: str):
    mongo = current_app.mongo.db.embedding_cache
    key = "HYDE_" + _hash(text)
    item = mongo.find_one({"_id": key})
    return item["subqueries"] if item else None


def store_cached_hyde(text: str, subqs):
    mongo = current_app.mongo.db.embedding_cache
    key = "HYDE_" + _hash(text)
    mongo.update_one(
        {"_id": key},
        {"$set": {"subqueries": subqs}},
        upsert=True
    )
