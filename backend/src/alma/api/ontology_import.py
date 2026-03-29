import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.importer import ImportProcessor, ImportScanner
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.repository import ImportSourceRepository
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator
from alma.models.models import OntologyObject, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ontology/import", tags=["ontology-import"])

# Project root: parent of backend/
PROJECT_ROOT = str(Path(__file__).resolve().parents[3])


# --- Schemas ---


class ScanRequest(BaseModel):
    directory: str
    pattern: str = "**/*.md"


class ScanFileResponse(BaseModel):
    path: str
    status: str
    size: int
    hash: str


class ScanResponse(BaseModel):
    files: list[ScanFileResponse]
    summary: dict


class ProcessRequest(BaseModel):
    directory: str
    paths: list[str]


class DbImportRequest(BaseModel):
    source_types: list[str]


class ProcessResponse(BaseModel):
    processed: int
    draft_count: int
    skipped: int
    errors: list[str]


class SourceResponse(BaseModel):
    id: str
    source_type: str
    source_path: str
    file_hash: str | None
    node_count: int
    status: str
    last_imported_at: str
    created_at: str


# --- Helpers ---


async def _get_extractor(session, service):
    try:
        from alma.config import settings
        from alma.infrastructure.llm.router import LLMRouter

        providers: dict = {}
        if settings.anthropic_api_key:
            from alma.infrastructure.llm.claude import ClaudeProvider

            providers["claude"] = ClaudeProvider()
        if settings.openai_api_key:
            from alma.infrastructure.llm.openai_provider import OpenAIProvider

            providers["openai"] = OpenAIProvider()
        if providers:
            from alma.domain.ontology.extractor import SemanticExtractor

            return SemanticExtractor(LLMRouter(providers), service)
    except Exception:
        pass
    return None


def _source_response(source) -> SourceResponse:
    return SourceResponse(
        id=str(source.id),
        source_type=source.source_type,
        source_path=source.source_path,
        file_hash=source.file_hash,
        node_count=source.node_count,
        status=source.status,
        last_imported_at=source.last_imported_at.isoformat(),
        created_at=source.created_at.isoformat(),
    )


# --- Routes ---


@router.post("/scan", response_model=ScanResponse)
async def scan_directory(
    req: ScanRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    import_repo = ImportSourceRepository(session)
    scanner = ImportScanner(import_repo)

    directory = os.path.join(PROJECT_ROOT, req.directory)
    result = await scanner.scan_directory(user.id, directory, req.pattern)

    return ScanResponse(
        files=[
            ScanFileResponse(path=f.path, status=f.status, size=f.size, hash=f.hash)
            for f in result.files
        ],
        summary=result.summary,
    )


@router.post("/process", response_model=ProcessResponse)
async def process_files(
    req: ProcessRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    await service.ensure_seeded(user.id)
    pipeline = PurificationPipeline(DeduplicationService(session), SchemaValidator(), service)
    import_repo = ImportSourceRepository(session)
    extractor = await _get_extractor(session, service)

    processor = ImportProcessor(service, pipeline, import_repo, extractor)

    directory = os.path.join(PROJECT_ROOT, req.directory)
    total_processed = 0
    total_drafts = 0
    total_skipped = 0
    all_errors: list[str] = []

    for path in req.paths:
        result = await processor.process_markdown(user.id, directory, path)
        total_processed += result.processed
        total_drafts += result.draft_count
        total_skipped += result.skipped
        all_errors.extend(result.errors)

    await session.commit()
    return ProcessResponse(
        processed=total_processed,
        draft_count=total_drafts,
        skipped=total_skipped,
        errors=all_errors,
    )


@router.post("/db", response_model=ProcessResponse)
async def import_db_sources(
    req: DbImportRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    await service.ensure_seeded(user.id)
    pipeline = PurificationPipeline(DeduplicationService(session), SchemaValidator(), service)
    import_repo = ImportSourceRepository(session)

    processor = ImportProcessor(service, pipeline, import_repo)

    total_processed = 0
    total_drafts = 0
    total_skipped = 0
    all_errors: list[str] = []

    for source_type in req.source_types:
        if source_type == "db_goals":
            result = await processor.process_db_goals(user.id, session)
        elif source_type == "db_habits":
            result = await processor.process_db_habits(user.id, session)
        else:
            all_errors.append(f"Unknown source type: {source_type}")
            continue

        total_processed += result.processed
        total_drafts += result.draft_count
        total_skipped += result.skipped
        all_errors.extend(result.errors)

    await session.commit()
    return ProcessResponse(
        processed=total_processed,
        draft_count=total_drafts,
        skipped=total_skipped,
        errors=all_errors,
    )


@router.get("/sources", response_model=list[SourceResponse])
async def list_sources(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    import_repo = ImportSourceRepository(session)
    sources = await import_repo.list_by_user(user.id)
    return [_source_response(s) for s in sources]


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    import_repo = ImportSourceRepository(session)
    source = await import_repo.get(uuid.UUID(source_id))
    if not source or source.user_id != user.id:
        raise HTTPException(status_code=404, detail="Import source not found")

    # Archive related ontology objects created after this source
    result = await session.execute(
        select(OntologyObject).where(
            OntologyObject.user_id == user.id,
            OntologyObject.created_at >= source.created_at,
            OntologyObject.status != "archived",
        )
    )
    related_objects = list(result.scalars().all())
    for obj in related_objects:
        obj.status = "archived"

    await import_repo.delete(uuid.UUID(source_id))
    await session.commit()

    return {"deleted": True, "archived_objects": len(related_objects)}
