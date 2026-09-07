import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.api.llm import resolve_llm_router
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

# Project root: alma/ (parent of backend/)
PROJECT_ROOT = str(Path(__file__).resolve().parents[4])


# --- Schemas ---


class BrowseRequest(BaseModel):
    path: str = ""


class BrowseEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int = 0


class BrowseResponse(BaseModel):
    current: str
    parent: str | None
    entries: list[BrowseEntry]


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


async def _get_extractor(session, service, user_id):
    """LLM이 설정돼 있으면 추출기를, 아니면 None(정규식 폴백)을 준다."""
    llm_router = await resolve_llm_router(session, user_id)
    if not llm_router:
        return None

    from alma.domain.ontology.extractor import SemanticExtractor

    return SemanticExtractor(llm_router, service)


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


BROWSE_ALLOWED_EXTENSIONS = {
    ".md",
    ".txt",
    ".pdf",
    ".docx",
    ".json",
    ".yaml",
    ".yml",
    ".csv",
    ".tsv",
}


@router.post("/browse", response_model=BrowseResponse)
async def browse_directory(
    req: BrowseRequest,
    user: User = Depends(get_current_user),
):
    """Browse directories relative to PROJECT_ROOT for file import."""
    target = Path(os.path.normpath(os.path.join(PROJECT_ROOT, req.path)))
    root = Path(PROJECT_ROOT)

    # Security: prevent path traversal outside PROJECT_ROOT
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="접근할 수 없는 경로입니다")

    if not target.exists():
        raise HTTPException(status_code=404, detail="경로를 찾을 수 없습니다")

    if not target.is_dir():
        raise HTTPException(status_code=400, detail="디렉토리가 아닙니다")

    entries: list[BrowseEntry] = []
    try:
        for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            # Skip hidden files/dirs and common noise
            if item.name.startswith(".") or item.name in {
                "node_modules",
                "__pycache__",
                ".git",
                ".next",
                ".venv",
                "venv",
            }:
                continue

            if item.is_dir():
                entries.append(
                    BrowseEntry(
                        name=item.name,
                        path=str(item.relative_to(root)),
                        is_dir=True,
                    )
                )
            elif item.suffix.lower() in BROWSE_ALLOWED_EXTENSIONS:
                entries.append(
                    BrowseEntry(
                        name=item.name,
                        path=str(item.relative_to(root)),
                        is_dir=False,
                        size=item.stat().st_size,
                    )
                )
    except PermissionError:
        raise HTTPException(status_code=403, detail="디렉토리 접근 권한이 없습니다")

    # Calculate relative current/parent paths
    current_rel = str(target.relative_to(root)) if target != root else ""
    parent_rel = str(target.parent.relative_to(root)) if target != root else None

    return BrowseResponse(current=current_rel, parent=parent_rel, entries=entries)


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
    extractor = await _get_extractor(session, service, user.id)

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
