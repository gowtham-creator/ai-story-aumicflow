# Indian Folklore Inspired Modern Story Generation

## Objective
This project aims to develop a modern story generation system inspired by Indian folklore, with examples such as *Mirai*, *Lokah*, and *Aditya 369*. The motivation behind this initiative is to address a gap in the market, as no one has yet tackled this specific fusion of folklore and storytelling in the context of modern AI-generated narratives.

## Target Audience
The primary target market for this project consists of story writers and content creators looking for innovative, folklore-inspired narratives.

## Project Development Approach

### 1. **First Approach:**
   Initially, I implemented a simple Retrieval-Augmented Generation (RAG) model to retrieve relevant data based on the user's query and feed it into the model to generate a story. However, this approach failed as it focused on semantic search and used keywords from the vector database rather than capturing the broader context of the query.

### 2. **Second Approach:**
   In an attempt to refine the process, I integrated *HYDE* to convert user queries into more relevant search queries for the vector database. While this approach partially worked, it still faced significant issues. The time required for RAG combined with *HYDE* was too long, and the output consisted of chunks of retrieved data rather than a coherent story.

### 3. **Third Approach:**
   The next step was the introduction of a *Context Engine* using *CAG* (Context-Aware Generation). Instead of feeding RAG and *HYDE* data directly into the model, I adopted a method where relevant data retrieved by RAG would be injected directly into the model via CAG. However, this presented challenges with the volume of data—feeding in large chunks of information, such as 100,000 words, was impractical.

   To address this, I combined *HYDE* and *CAG*, following the process below:
   - Initially, all stories were appended into a large chunk using the *RecursiveCharacterTextSplitter*.
   - Each chunk was then summarized based on the following metrics:
     - **Voice**: A brief description of the narrative voice (e.g., "lyrical, close-third, image-driven").
     - **Tone**: The emotional/atmospheric tone (e.g., "melancholic, slow-burn unease").
     - **Archetypes**: An array of character/archetype patterns (short phrases).
     - **Motifs**: Recurring symbolic or sensory motifs.
     - **Pacing**: A short phrase describing the rhythm/structure (e.g., "fragmented vignettes", "steady escalation").
     - **Notes**: Optional brief guidance (e.g., no names, no quotes, no events).

   - Finally, I used *HYDE* to generate database queries based on the user input, concatenated these queries with the message history, and fed them to the model for story generation.

## Optimization Challenges
The project faced significant optimization issues. Each user input took 1-2 minutes to generate a story and display it in the chat window, even without streaming capabilities. To improve performance, I implemented several optimizations:
- Cached the *HYDE* subqueries.
- Added streaming to provide real-time feedback.
- Integrated an intent classifier, as not all user prompts were intended to generate stories.

These enhancements allowed for a more efficient system, although there are still areas for improvement in terms of response time and output coherence.
