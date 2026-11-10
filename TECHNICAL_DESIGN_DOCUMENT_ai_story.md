# AI Story Application – Technical Design Document (TDD)

## 1. Overview

### 1.1 Purpose
The **AI Story** application is a full‑stack system that helps users craft and iterate on creative writing (stories/novels) using LLMs and retrieval over a curated corpus of reference texts. It provides:
- A chat‑like UI with conversations, history, and creative controls.
- AI assistance that can either behave as a normal chat agent or as a story generator, depending on the user’s intent.
- Retrieval‑augmented generation (RAG) over an inspiration corpus (PDFs) to infer writing style, tone, motifs, etc.
- Speech‑to‑text (STT) over WebSockets for voice‑driven input.

### 1.2 High‑Level Architecture
- **Frontend**: React + Vite SPA (`frontend/`) with:
  - Chat screen and conversation management.
  - Creative parameters panel (genre, tone, characters, etc.).
  - Story canvas for editing and exporting stories (TXT/PDF via `jsPDF`).
  - Authentication (email/password + Google OAuth) integrated via JWT.
- **Backend**: Flask application (`backend/`) with:
  - REST endpoints for chat, history, and auth.
  - WebSocket endpoint for STT (`/ws/stt`) using Vosk.
  - CAG retrieval using FAISS + Azure OpenAI embeddings.
  - Story generation and normal chat via pluggable LLM provider.
- **Data Storage**:
  - MongoDB (via `flask_pymongo`) for users and chat history.
  - FAISS index and JSON summaries on disk for inspiration corpus.
  - External LLM APIs: Azure OpenAI, OpenAI, and Anthropic (configurable).


## 2. Requirements

### 2.1 Functional Requirements
1. **User Authentication**
   - Users can register with email/password.
   - Users can log in with email/password.
   - Users can log in with Google Sign‑In (OAuth) and receive a JWT.
   - All authenticated requests to history APIs must be authorized via JWT.

2. **Conversations & Chat**
   - Each user can have multiple named conversations.
   - A conversation is a sequence of user/assistant messages stored in MongoDB.
   - Users can:
     - Send a message to `/api/chat` (non‑streaming) or `/api/chat_stream` (streaming).
     - Clear a single conversation (`/api/clear_conversation`).
     - Clear all their conversations (`/api/clear_all_conversations`).
     - Fetch grouped history (`/api/history`) and per‑conversation history (`/api/history/<id>`).

3. **Story vs Normal Chat Routing**
   - System infers whether a user message is a story‑writing request.
   - If **story intent**:
     - Retrieve an inspiration profile via FAISS + LLM.
     - Call story generator LLM with fused profile + creative parameters + history.
   - Otherwise, use normal chat LLM.

4. **Creative Controls**
   - From frontend, user can specify creative parameters (managed centrally in `chat-store`):
     - `genre`, `tone`, `character`, `setting`, `theme`, `narrativeStyle`, `inspiration`.
   - These parameters are passed to backend as `params` and integrated into prompts.

5. **Speech‑to‑Text (STT)**
   - WebSocket endpoint `/ws/stt` accepts 16kHz PCM audio.
   - Uses a local Vosk model to stream partial and final transcripts back to client.
   - Gracefully degrades if Vosk model is unavailable.

6. **Story Canvas & Export**
   - User can add assistant messages into a sidebar “Story Canvas”.
   - Canvas allows editing the combined story text.
   - Story can be downloaded as `.txt` or `.pdf` (client‑side `jsPDF`).

### 2.2 Non‑Functional Requirements
- **Scalability**: 
  - FAISS index is loaded once at app startup (if available) and reused via `current_app`.
  - Streaming endpoints avoid large one‑shot responses.
- **Performance**:
  - Embeddings and HYDE subqueries are cached to reduce LLM/embedding costs.
  - Chat history used in prompts is length‑bounded by character count.
- **Security**:
  - JWTs signed with `SECRET_KEY` and expiring in 7 days.
  - Google ID tokens verified server‑side.
  - Passwords hashed with bcrypt.
  - CORS configured to allow controlled frontend access.
- **Extensibility**:
  - Pluggable LLM provider abstraction (`model.llm_provider.get_llm`).
  - Prompt templates externalized to files in `backend/model/prompts`.


## 3. Backend Design

### 3.1 Application Entry Point (`backend/app.py`)

- Initializes Flask, CORS, Mongo, WebSockets, and routes.
- Loads configuration from `Config` (see `config.py`).
- Pre‑loads FAISS index and summaries:
  - `app.faiss_index = load_faiss_index()`.
  - `app.inspiration_summaries = load_summaries()`.
- Exposes WebSocket endpoint `/ws/stt` via `flask_sock.Sock`.

#### 3.1.1 STT WebSocket Flow
1. On connection:
   - Validate that `vosk_model` is loaded; otherwise send error JSON and close.
   - Create `KaldiRecognizer(vosk_model, 16000)`.
2. Receive loop:
   - If message is **binary** audio:
     - Call `rec.AcceptWaveform(msg)`.
     - On final result, send `{ type: "final", text, timestamp }`.
     - On partial result, send `{ type: "partial", text, timestamp }`.
   - If message is **string** control JSON:
     - `event: "ping"` → reply with `{ type: "pong" }`.
     - `event: "start"` → reply with `{ type: "ready" }`.
     - `event: "stop"` → send a final result and terminate loop.

### 3.2 Configuration (`backend/config.py`)

- Uses `.env` variables via `python-dotenv`.
- Provides:
  - `Config.SECRET_KEY`, `Config.MONGO_URI`.
  - `Config.GOOGLE_CLIENT_ID`, `Config.GOOGLE_CLIENT_SECRET`.
  - Azure/OpenAI/Anthropic keys and deployment names.
- RAG‑specific constants:
  - `KNOWLEDGE_DIR`, `INDEX_DIR`, `SUMMARY_STORE`, `PROMPTS_DIR`.
  - Chunk sizes and retrieval parameters: `CHUNK_SIZE`, `TOPK_DOCS`, `TOPK_FOR_PROFILE`.
  - `DEFAULT_STORY_PARAS` (paragraph count range for generation).
- Exports Azure/OpenAI constants for other modules (`AZURE_OPENAI_API_VERSION`, etc.).

### 3.3 Retrieval Layer (`backend/retrieval/inspire_retrieve.py`)

#### 3.3.1 Embeddings
- `_embeddings()` returns `AzureOpenAIEmbeddings` configured with endpoint, key, deployment, and API version.
- Global `embedder = _embeddings()` is reused.
- `embed(text)` checks cache via `get_cached_embedding` / `store_cached_embedding`.

#### 3.3.2 HYDE Subqueries
- `generate_hyde_subqueries(user_request: str)`:
  - Returns cached HYDE results if present (`get_cached_hyde`).
  - Uses a light `AzureChatOpenAI` model (`_llm`) and `subquery_hyde_prompt.txt` to generate multiple hypothetical queries.
  - Parses output into distinct subqueries and caches them.

#### 3.3.3 FAISS Index & Summaries
- `load_faiss_index()`:
  - Loads FAISS index from `INDEX_DIR` with `FAISS.load_local(..., embedder)`.
  - Returns `None` if loading fails.
- `load_summaries()`:
  - Loads `inspiration_summaries.json` as a dict mapping chunk ids → summary metadata.

#### 3.3.4 Inspiration Profile Retrieval
- `retrieve_inspiration_profile(user_request: str) -> dict`:
  - Prefer `current_app.faiss_index`; otherwise attempt to reload.
  - If no index is available, return minimal default profile.
  - Ensure summaries are present (`current_app.inspiration_summaries` or `load_summaries()`).
  - Generate HYDE subqueries and for each:
    - Embed subquery.
    - Call `vs.similarity_search_by_vector(q_vec, k=TOPK_DOCS)` (fallback to `similarity_search` on error).
    - Aggregate hit counts per chunk key `"filename:::chunk_id"`.
  - Select top‑`TOPK_FOR_PROFILE` chunks, look up their summaries.
  - Fuse via LLM:
    - Load `inspiration_profile_fuser.txt`.
    - Call `_llm(temp=0.0)` and `llm.invoke(...)`.
    - Expect JSON; on parse failure, fallback to a partially filled profile with `style_notes` text.

### 3.4 Story Generation (`backend/model/story_generator.py`)

#### 3.4.1 LLM Provider and Prompts
- `_llm(temp)` calls `get_llm("story", temp=temp)` to obtain a model suited for longer creative outputs.
- Uses prompt templates under `PROMPTS_DIR`, especially `story_prompt.txt`.

#### 3.4.2 Prompt Construction
- `_format_history_for_story(history)`:
  - Takes chat history as list of `{ role, content }` and formats lines like:
    - `User: ...` or `Story (so far) / Assistant: ...`.
- `_build_story_prompt(inspiration_profile, user_request, history, params)`:
  - Builds a rich context string from creative parameters (if present):
    - e.g., `**Genre:** Fantasy`.
  - Inserts:
    - `inspiration_profile` as pretty‑printed JSON.
    - `context` (creative parameters).
    - `chat_history` (formatted history).
    - `user_request`.
  - Uses `template.format(...)` for substitution; raises a clear error if template has an unexpected placeholder.

#### 3.4.3 Generation APIs
- `generate_story(...) -> str`:
  - Calls `_build_story_prompt` then `llm.invoke`.
  - Normalizes result to string and passes through `clean_markdown`:
    - Removes markdown headings, emphasis syntax, highlight markup, stray bullets, extra blank lines.
  - Returns a trimmed plain‑text story.

- `generate_story_stream(...) -> Iterable[str]`:
  - Similar prompt build, but uses `llm.stream(...)`.
  - Yields raw text chunks; no markdown cleaning is applied to keep streaming lightweight.

### 3.5 Intent Classification (`backend/model/intent_classifier.py`)

- Heuristic + LLM hybrid model to decide if a message is a story‑writing request.

#### 3.5.1 Heuristics
- `STORY_KEYWORDS`: words like `story`, `novel`, `plot`, `chapter`, `worldbuild`.
- `SHORT_REPLIES_FILTER`: short common replies treated as non‑story.
- `SETUP_PHRASES_FILTER`: meta instructions like “you are…”, “act as…”, etc.

#### 3.5.2 LLM‑Assisted Classification
- `_llm()` gets an “intent” model via `get_llm("intent", temp=0.0)`.
- `_load_prompt()` loads `intent_check.txt`.
- `_format_history_for_intent(history)` takes the last 8 messages and formats them as `User:` / `Assistant:` lines.
- `is_story_intent(message, history) -> bool` flow:
  1. If last assistant message looks like story output (contains `"Story (so far) / Assistant:"`), always treat as continuation (return `True`).
  2. Apply heuristic filters on the **current** message:
     - If message is in `SHORT_REPLIES_FILTER` → `False`.
     - If it contains setup phrases → `False`.
     - If it lacks any story keywords → `False`.
  3. Otherwise, build an LLM prompt from `intent_check.txt` plus formatted history and message.
  4. Invoke LLM; if normalized answer equals `"yes"`, return `True`.

### 3.6 Chat Routes (`backend/routes/chat_routes.py`)

#### 3.6.1 Authorization Helper
- `_require_auth()` reads JWT from `Authorization: Bearer <token>` header and decodes it.
- Returns `(user_data, None)` on success or `(None, (json_error, status))` on failure.

#### 3.6.2 Conversation Clearing
- `/api/clear_conversation` (POST):
  - Body: `{ conversation_id }`.
  - Optional `user_id` from request context; if absent, clears guest conversation (`user_id: None`).
- `/api/clear_all_conversations` (POST):
  - If logged‑in: deletes all chats for the user.
  - Else: deletes all chats where `user_id` is `null` (guest chats).

#### 3.6.3 Non‑Streaming Chat (`/api/chat`)
1. Parse JSON body; support `payload` wrapper.
2. Validate required fields: `message`, `conversation_id`.
3. Decode JWT (optional): attach `user_id` if present.
4. Load prior history via `fetch_history_messages(mongo, conversation_id)`.
5. Append current user message to `full_messages`.
6. Route based on intent:
   - If `is_story_intent(message, prior)`:
     - `profile = retrieve_inspiration_profile(message)`.
     - `reply = generate_story(profile, message, prior, params)`.
   - Else:
     - `reply = chat_response(full_messages)`.
7. Persist turn in `mongo.chats` with `user_id`, `conversation_id`, `message`, `reply`, `parameters`, and `created_at`.
8. Respond `{ reply, conversation_id }`.

#### 3.6.4 Streaming Chat (`/api/chat_stream`)
- Similar request validation and history loading.
- Uses `stream_with_context(generate)` to stream plain text chunks.
- Inside `generate()`:
  - Decide story vs normal chat as in non‑streaming path.
  - For each chunk from generator, append to `reply_holder["text"]` and `yield` to client.
  - On error, stream an error marker and append to reply.
  - In `finally`, persist full reply in Mongo just like non‑streaming path.

#### 3.6.5 History APIs
- `/api/history` (GET):
  - Requires auth.
  - Aggregates chats by `conversation_id`, sorts by creation time, and returns for each:
    - `conversation_id`, `title` (first user message excerpt), timestamps, and full message list.
- `/api/history/<conversation_id>` (GET):
  - Requires auth.
  - Returns chronological messages for that conversation, with ISO timestamps.

### 3.7 Auth Routes (`backend/routes/auth_routes.py`)

- `/api/register` (POST):
  - `name`, `email`, `password` → create user.
  - Store `password_hash` with bcrypt.
- `/api/login` (POST):
  - Validate credentials, issue JWT via `create_jwt(user_id, email)`.
- `/api/google` (POST):
  - Body: `{ token }` (Google ID token).
  - Verify token with Google APIs using `GOOGLE_CLIENT_ID`.
  - Create or find user in Mongo.
  - Issue JWT and return user profile.

### 3.8 Utility Modules

#### 3.8.1 History Utility (`utils/history.py`)
- `fetch_history_messages(mongo, conversation_id)`:
  - Reads all chat documents by `conversation_id` sorted ascending.
  - Flattens into alternating user/assistant messages.
  - Trims from the front to a max char budget (`MAX_CHARS`) to limit context size.

#### 3.8.2 JWT Utility (`utils/jwt_utils.py`)
- `create_jwt(user_id, email)` signs JWT with `SECRET_KEY`, 7‑day expiry.
- `decode_jwt(token)` verifies and returns payload or `None` on error/expiry.


## 4. Frontend Design

### 4.1 Application Shell (`frontend/src/main.tsx`, `App.tsx`)

- `main.tsx` bootstraps React + `GoogleOAuthProvider` using `VITE_GOOGLE_CLIENT_ID`.
- `App.tsx` sets up routing:
  - `/` → redirects to `/auth` or `/chat` based on hydration + auth state.
  - `/auth` → `AuthPage` (login/register + Google Sign‑In).
  - `/chat` → `ProtectedRoute` wrapping `ChatPage`.
  - `*` → `NotFoundPage`.
- Uses global toaster and tooltip providers.

### 4.2 State Management (`chat-store`, `auth-store` – inferred)

- `auth-store`:
  - Exposes `isAuthenticated` and persisted auth state (including JWT token in storage key `DEVV_CODE_SID`).
- `chat-store`:
  - Manages conversations: creation, active selection, messages list, titles.
  - Exposes methods: `addMessageToConversation`, `clearConversation`, `editMessage`, `createConversation`, `getActiveConversation`.
  - Stores `creativeSettings` and exposes `updateCreativeSettings`, `clearCreativeSettings`.

### 4.3 Chat Page UI (`frontend/src/pages/ChatPage.tsx`)

Key responsibilities:
- Manage current input, voice transcription overlay (`liveDraft`), and streaming state.
- Call backend `/api/chat_stream` with:
  - `message`, `conversation_id`, and `params` = `creativeSettings`.
  - JWT from `localStorage["DEVV_CODE_SID"]` (if present).
- Render messages with roles (`user` vs `assistant`) and streaming preview.
- Integrate with:
  - `Sidebar` for conversation list and profile.
  - `CreativeWritingPanel` for creative parameters.
  - `AudioRecorder` for live STT.
  - `StoryCanvas` in a side panel for curated story content.

#### 4.3.1 Sending Messages
- Form submit (`handleSendMessage`):
  1. Ensure non‑empty input and not currently streaming.
  2. Ensure there is an active conversation; create one if necessary.
  3. Append user message to conversation.
  4. Clear input.
  5. Call `fetch(`${API_URL}/chat_stream`, ...)` with payload.
  6. Read streamed response using `ReadableStreamDefaultReader`:
     - Accumulate text into `fullReply` and `currentStreamingMessage` for live display.
  7. On completion, append assistant message to conversation.

#### 4.3.2 STT Integration
- `AudioRecorder` props:
  - `onStream` provides audio stream to optional visualizer.
  - `onPartial` updates `liveDraft`.
  - `onFinal` appends final transcript into text input and switches to typing mode.
- There is an additional helper `handleVoiceTranscription` which can directly set `input` and trigger form submission programmatically.

#### 4.3.3 Story Canvas
- `StoryCanvas` component receives `story` and optional `title`.
- Messages can be added via context action:
  - “➕ Add to Canvas” on assistant messages appends content to `storyContent` state.
- Canvas is displayed in a right‑side slide‑in panel (`isCanvasOpen`).

### 4.4 Creative Writing Panel (`frontend/src/components/CreativeWritingPanel.tsx`)

- Allows the user to configure `CreativeSettings` fields:
  - `genre`, `tone`, `character`, `setting`, `theme`, `narrativeStyle`, `inspiration`.
- Uses shadcn UI components (Select, Input, Badge, etc.).
- All changes call `updateCreativeSettings` so the latest settings are used on the next send.
- Provides a **Reset** button that calls `clearCreativeSettings`.

### 4.5 Story Canvas Component (`frontend/src/components/StoryCanvas.tsx`)

- Local state: `story`, `isEditing`.
- Syncs its `story` with incoming `initialStory` prop using `useEffect`.
- Actions:
  - **Edit / Save** toggles `isEditing`; saving triggers a toast.
  - **Download TXT**: constructs a Blob and triggers browser download.
  - **Download PDF**: uses `jsPDF` to paginate and save story as PDF.


## 5. Data Model & Persistence

### 5.1 MongoDB Collections (Logical Schema)

#### 5.1.1 `users`
```json path=null start=null
{
  "_id": ObjectId,
  "name": string,
  "email": string,
  "password_hash": string | null,
  "picture": string | null
}
```

#### 5.1.2 `chats`
```json path=null start=null
{
  "_id": ObjectId,
  "user_id": string | null,       // stringified ObjectId or null for guests
  "conversation_id": string,      // client-generated ID
  "message": string,
  "reply": string,
  "parameters": object,           // creative settings at time of turn
  "created_at": datetime
}
```

### 5.2 FAISS Index & Summaries
- Stored under `backend/data_index/faiss_index` and `inspiration_summaries.json`.
- Index stores vector representations of text chunks from PDF corpus.
- `inspiration_summaries.json` stores high‑level metadata per chunk (e.g., `voice`, `tone`, motifs) used for fusion.


## 6. External Dependencies & Integration

### 6.1 LLM / Embedding Providers
- **Azure OpenAI**:
  - Embeddings: `AzureOpenAIEmbeddings` via `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`.
  - Chat: `AzureChatOpenAI` for HYDE and fusion.
- **Anthropic / OpenAI**:
  - Wired via `model.llm_provider.get_llm` (not shown here), choosing appropriate models for `intent`, `story`, and `normal_chat`.

### 6.2 STT Provider
- **Vosk** offline model located in `backend/models/vosk-model-small-en-us-0.15`.
- Loaded once at module import; gracefully falls back if missing.

### 6.3 Google OAuth
- Frontend uses `@react-oauth/google` with `VITE_GOOGLE_CLIENT_ID`.
- Backend verifies ID tokens using `google.oauth2.id_token` and `google.auth.transport.requests`.


## 7. Error Handling & Logging

- Backend uses Python `logging` configured at WARNING level globally.
- `app.py` logs warnings when Vosk model cannot be loaded and when FAISS preload fails.
- Chat routes:
  - `try/except` blocks around LLM and retrieval calls.
  - On exception, log stack trace (`traceback.print_exc()`) and send error marker in the reply text.
- STT WebSocket:
  - Catches JSON decode errors and logs them.
  - Catches generic exceptions and logs with stack traces.
- Retrieval:
  - If FAISS index is missing, returns an empty inspiration profile instead of failing.
  - If fusion LLM output is not valid JSON, wraps raw text in a fallback profile structure.


## 8. Security Considerations

- **Secrets Management**:
  - All API keys and secrets are loaded via environment variables in `config.py`.
- **Transport Security**:
  - Assumes deployment behind HTTPS‑terminating reverse proxy (e.g., nginx, based on `frontend/nginx.conf`).
- **Authentication & Authorization**:
  - JWT required for history and user‑scoped operations.
  - Guest conversations are supported but cleaned up separately.
- **Data Privacy**:
  - Chat history (including creative prompts) is stored in MongoDB.
  - RAG corpus is local PDF knowledge base inside `backend/knowledge`.


## 9. Deployment & Runtime

### 9.1 Dockerization
- Both `backend/` and `frontend/` contain `Dockerfile` and `.dockerignore` for containerized deployment.
- Typical deployment topology:
  - Backend container exposing port 5000.
  - Frontend (Vite build) served via nginx with `nginx.conf` proxying to backend.
  - MongoDB and optional FAISS index volume as separate services.

### 9.2 Configuration via Environment
- `.env.example` (both backend and frontend) define required environment variables such as:
  - `MONGO_URI`, `SECRET_KEY`.
  - Azure/OpenAI/Anthropic keys.
  - Google client ID.
  - `VITE_API_URL` (frontend) to point to backend base URL.


## 10. Future Extensions

- Multi‑language STT and story generation.
- Fine‑grained conversation settings (model selection per conversation, temperature, max tokens).
- Richer structure in story canvas (chapters, scenes, outlines).
- Role‑based access and team collaboration on shared stories.
- Advanced analytics on user style to adapt future suggestions.
