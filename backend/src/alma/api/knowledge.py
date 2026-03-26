import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.config import settings
from alma.database import get_session
from alma.domain.knowledge.service import KnowledgeService
from alma.domain.memory.embedding import create_embedding_provider
from alma.models.models import User

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)


class DocumentFromUrl(BaseModel):
    title: str = Field(min_length=1)
    url: str = Field(min_length=1)


class SearchQuery(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=5, ge=1, le=20)


class DocumentResponse(BaseModel):
    id: str
    title: str
    source_type: str
    source_url: str | None
    chunk_count: int
    status: str
    created_at: str


def _doc_response(doc) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc.id),
        title=doc.title,
        source_type=doc.source_type,
        source_url=doc.source_url,
        chunk_count=doc.chunk_count,
        status=doc.status,
        created_at=doc.created_at.isoformat(),
    )


def _get_service(session: AsyncSession) -> KnowledgeService:
    embedding = create_embedding_provider(settings)
    return KnowledgeService(session, embedding)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    docs = await service.list_documents(user.id)
    return [_doc_response(d) for d in docs]


@router.post("", response_model=DocumentResponse, status_code=201)
async def add_document(
    req: DocumentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    doc = await service.add_document(user.id, req.title, req.content)
    return _doc_response(doc)


@router.post("/url", response_model=DocumentResponse, status_code=201)
async def add_from_url(
    req: DocumentFromUrl,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    doc = await service.add_from_url(user.id, req.title, req.url)
    return _doc_response(doc)


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """파일 업로드 (PDF, DOCX, TXT)"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed = (".pdf", ".docx", ".txt")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail=f"Supported formats: {', '.join(allowed)}")

    # 10MB 제한
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    from alma.domain.knowledge.parser import extract_text

    try:
        text = extract_text(file.filename, contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No text content found in file")

    doc_title = title.strip() or file.filename.rsplit(".", 1)[0]
    service = _get_service(session)
    doc = await service.add_document(
        user.id,
        doc_title,
        text,
        source_type="file",
        source_url=file.filename,
    )
    return _doc_response(doc)


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    doc = await service.get_document(uuid.UUID(doc_id), user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_response(doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    doc = await service.get_document(uuid.UUID(doc_id), user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await service.delete_document(doc.id)


@router.post("/search")
async def search_knowledge(
    req: SearchQuery,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = _get_service(session)
    results = await service.search(user.id, req.query, req.limit)
    return {"results": results}
