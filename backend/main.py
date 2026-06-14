import os
import time
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

# ==========================================
# CONFIGURATION
# ==========================================
load_dotenv()  # Loads GOOGLE_API_KEY from .env file

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError(
        "GOOGLE_API_KEY is not set. "
        "Create a .env file with: GOOGLE_API_KEY=your_key_here"
    )

# Inject into environment so LangChain picks it up globally
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

UPLOAD_DIR = Path("uploads")
INDEX_DIR = Path("faiss_indexes")
UPLOAD_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE_MB = 50

# ==========================================
# APP INIT
# ==========================================
app = FastAPI(
    title="RAG System API",
    description="Production-grade Retrieval-Augmented Generation API",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# IN-MEMORY SESSION STORE
# ==========================================
sessions: dict = {}
# Structure: { session_id: { "filename": str, "chunks": int, "vector_db": FAISS, "status": str, "error": str } }


# ==========================================
# SCHEMAS  (api_key removed from all request models)
# ==========================================
class QueryRequest(BaseModel):
    session_id: str
    question: str
    top_k: int = 3  # api_key REMOVED — key lives on server only


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    session_id: str
    processing_time_ms: int


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    chunks: int
    message: str


class SessionStatus(BaseModel):
    session_id: str
    filename: Optional[str]
    chunks: Optional[int]
    status: str
    error: Optional[str]


# ==========================================
# HELPERS
# ==========================================
def get_loader(file_path: Path):
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        return PyPDFLoader(str(file_path))
    elif ext == ".docx":
        return Docx2txtLoader(str(file_path))
    elif ext == ".txt":
        from langchain_community.document_loaders import TextLoader
        return TextLoader(str(file_path), encoding="utf-8")
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def build_vector_db(file_path: Path) -> tuple[FAISS, int]:
    """Build FAISS index — uses GOOGLE_API_KEY from environment (set at startup)."""
    loader = get_loader(file_path)
    raw_documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = splitter.split_documents(raw_documents)

    if not chunks:
        raise ValueError("Document appears to be empty or unreadable.")

    embedding_model = GoogleGenerativeAIEmbeddings(model="gemini-embedding-001")
    vector_db = FAISS.from_documents(chunks, embedding_model)

    return vector_db, len(chunks)


def cleanup_session_files(session_id: str, file_path: Path):
    """Remove uploaded file after indexing to save disk space."""
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass


# ==========================================
# ROUTES
# ==========================================
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "3.0.0",
        "active_sessions": len(sessions),
        # Never expose the actual key — just confirm it's configured
        "api_key_configured": bool(GOOGLE_API_KEY),
    }


@app.post("/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    # api_key parameter REMOVED — no longer accepted from client
):
    """Upload a PDF/DOCX/TXT and build a FAISS vector index for it."""

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed: {MAX_FILE_SIZE_MB} MB."
        )

    session_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{session_id}{suffix}"

    with open(file_path, "wb") as f:
        f.write(content)

    sessions[session_id] = {
        "filename": file.filename,
        "chunks": 0,
        "vector_db": None,
        "status": "processing",
        "error": None,
    }

    try:
        vector_db, chunk_count = build_vector_db(file_path)  # no api_key arg
        sessions[session_id]["vector_db"] = vector_db
        sessions[session_id]["chunks"] = chunk_count
        sessions[session_id]["status"] = "ready"
        background_tasks.add_task(cleanup_session_files, session_id, file_path)

        return UploadResponse(
            session_id=session_id,
            filename=file.filename,
            chunks=chunk_count,
            message=f"Document indexed successfully into {chunk_count} searchable chunks."
        )

    except Exception as e:
        sessions[session_id]["status"] = "error"
        sessions[session_id]["error"] = str(e)
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@app.get("/session/{session_id}", response_model=SessionStatus)
async def get_session_status(session_id: str):
    """Check status of a session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    s = sessions[session_id]
    return SessionStatus(
        session_id=session_id,
        filename=s.get("filename"),
        chunks=s.get("chunks"),
        status=s.get("status"),
        error=s.get("error"),
    )


@app.post("/query", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    """Run a RAG query against an indexed document."""

    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a document first.")

    session = sessions[request.session_id]

    if session["status"] != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Session not ready. Current status: {session['status']}. Error: {session.get('error', 'N/A')}"
        )

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    start = time.time()

    try:
        vector_db: FAISS = session["vector_db"]
        retriever = vector_db.as_retriever(search_kwargs={"k": request.top_k})
        matching_chunks = retriever.invoke(request.question)

        context_text = "\n\n---\n\n".join([chunk.page_content for chunk in matching_chunks])

        prompt = f"""You are a precise, expert AI assistant. Answer the USER QUESTION using ONLY the verified context below.
- Be concise but thorough.
- Use bullet points or numbered lists where appropriate.
- If the context does not contain the answer, clearly state: "The document does not contain information about this topic."
- Never hallucinate or make up facts.

DOCUMENT CONTEXT:
{context_text}

USER QUESTION:
{request.question}

ANSWER:"""

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.1,
            # google_api_key intentionally omitted — uses os.environ["GOOGLE_API_KEY"]
        )
        response = llm.invoke(prompt)
        elapsed_ms = int((time.time() - start) * 1000)

        sources = []
        for i, chunk in enumerate(matching_chunks):
            meta = chunk.metadata or {}
            sources.append({
                "index": i + 1,
                "page": meta.get("page", "N/A"),
                "source": meta.get("source", session["filename"]),
                "excerpt": chunk.page_content[:200].strip() + "..."
            })

        return QueryResponse(
            answer=response.content,
            sources=sources,
            session_id=request.session_id,
            processing_time_ms=elapsed_ms
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session and free memory."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    del sessions[session_id]
    return {"message": "Session deleted successfully.", "session_id": session_id}


@app.get("/sessions")
async def list_sessions():
    """List all active sessions (without vector_db objects)."""
    result = []
    for sid, s in sessions.items():
        result.append({
            "session_id": sid,
            "filename": s.get("filename"),
            "chunks": s.get("chunks"),
            "status": s.get("status"),
        })
    return {"sessions": result, "total": len(result)}