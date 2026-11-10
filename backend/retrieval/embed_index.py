import os, json, re, glob, time
from typing import List, Dict
from tqdm import tqdm
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pdfminer.high_level import extract_text as pdfminer_extract_text
import pymupdf as fitz
from openai import RateLimitError

from config import (
    KNOWLEDGE_DIR, INDEX_DIR, SUMMARY_STORE, PROMPTS_DIR,
    CHUNK_SIZE, CHUNK_OVERLAP,
    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT, AZURE_OPENAI_DEPLOYMENT
)

def _read_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def _read_pdf(path: str) -> str:
    try:
        return pdfminer_extract_text(path)
    except Exception:
        text = []
        with fitz.open(path) as doc:
            for page in doc:
                text.append(page.get_text())
        return "\n".join(text)

def _load_files() -> Dict[str, str]:
    files = {}
    for p in glob.glob(os.path.join(KNOWLEDGE_DIR, "*")):
        if os.path.isfile(p) and (p.lower().endswith(".txt") or p.lower().endswith(".pdf")):
            try:
                content = _read_txt(p) if p.lower().endswith(".txt") else _read_pdf(p)
                content = re.sub(r"\s+\n", "\n", content).strip()
                if content:
                    files[os.path.basename(p)] = content
            except Exception as e:
                print(f"Skip {p}: {e}")
    return files

def _split(filename: str, text: str) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        add_start_index=True
    )
    chunks = splitter.split_text(text)
    docs = []
    for i, chunk in enumerate(chunks):
        docs.append(Document(
            page_content=chunk.strip(),
            metadata={"filename": filename, "chunk_id": i}
        ))
    return docs

def _embeddings():
    return AzureOpenAIEmbeddings(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        azure_deployment=AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        openai_api_version=AZURE_OPENAI_API_VERSION
    )

def _llm(temp=0.2):
    return AzureChatOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        azure_deployment=AZURE_OPENAI_DEPLOYMENT,
        openai_api_version=AZURE_OPENAI_API_VERSION,
        temperature=temp,
    )

def _load_prompt(name: str) -> str:
    with open(os.path.join(PROMPTS_DIR, name), "r", encoding="utf-8") as f:
        return f.read()

# -------- batched embedding ----------
def embed_batched(texts, embed, batch_size=30):
    vectors = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        while True:
            try:
                batch_vecs = embed.embed_documents(batch)
                vectors.extend(batch_vecs)
                break
            except RateLimitError:
                print("Embedding rate limit — sleeping 20s...")
                time.sleep(20)
    return vectors

# -------- batched summaries ----------
def summarize_batched(llm, docs, batch_size=20):
    summaries = {}
    prompt_template = _load_prompt("inspiration_summary_prompt.txt")

    for i in tqdm(range(0, len(docs), batch_size)):
        batch = docs[i:i+batch_size]

        for d in batch:
            prompt = prompt_template.format(chunk=d.page_content)

            while True:
                try:
                    res = llm.invoke(prompt)
                    try:
                        parsed = json.loads(res.content)
                    except:
                        parsed = {
                            "voice": "", "tone": "", "archetypes": [],
                            "motifs": [], "pacing": "",
                            "notes": res.content.strip()[:800]
                        }

                    key = f"{d.metadata['filename']}:::{d.metadata['chunk_id']}"
                    summaries[key] = parsed
                    break

                except RateLimitError:
                    print("LLM rate limit — sleeping 20s...")
                    time.sleep(20)

    return summaries

# -------- main indexing workflow ----------
def build_index():
    print("Loading files...")
    files = _load_files()
    if not files:
        raise RuntimeError("No .pdf or .txt files found in knowledge/")

    docs = []
    for fname, text in files.items():
        docs.extend(_split(fname, text))

    print(f"Total chunks: {len(docs)}")

    # ---------------- embeddings ----------------
    embed = _embeddings()
    print("Embedding documents in safe batches...")

    texts = [d.page_content for d in docs]
    metadatas = [d.metadata for d in docs]

    vectors = embed_batched(texts, embed, batch_size=30)

    # LangChain requires list[(text, vector)]
    text_embeddings = list(zip(texts, vectors))

    vs = FAISS.from_embeddings(
        text_embeddings=text_embeddings,
        embedding=embed,
        metadatas=metadatas
    )

    os.makedirs(INDEX_DIR, exist_ok=True)
    vs.save_local(INDEX_DIR)
    print("FAISS saved.")

    # ---------------- summaries ----------------
    print("Generating inspiration summaries in batches...")
    llm = _llm(temp=0.0)
    summaries = summarize_batched(llm, docs, batch_size=20)

    with open(SUMMARY_STORE, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=2)

    print(f"Inspiration summaries saved to {SUMMARY_STORE}")

if __name__ == "__main__":
    build_index()
