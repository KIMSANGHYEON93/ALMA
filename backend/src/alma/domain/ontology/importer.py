import hashlib
import logging
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.models import EdgeCandidate, NodeCandidate, RawExtraction
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.repository import ImportSourceRepository
from alma.domain.ontology.service import OntologyService

logger = logging.getLogger(__name__)


@dataclass
class ScanFileItem:
    path: str
    status: str  # "new" | "modified" | "unchanged"
    size: int
    hash: str


@dataclass
class ScanResult:
    files: list[ScanFileItem] = field(default_factory=list)
    summary: dict = field(default_factory=dict)


@dataclass
class ImportResult:
    processed: int = 0
    draft_count: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def compute_file_hash(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class ImportScanner:
    def __init__(self, import_repo: ImportSourceRepository):
        self.import_repo = import_repo

    async def scan_directory(
        self, user_id: uuid.UUID, directory: str, pattern: str = "**/*.md"
    ) -> ScanResult:
        base_path = Path(directory)
        if not base_path.exists():
            return ScanResult(summary={"error": f"Directory not found: {directory}"})

        files = []
        new_count = modified_count = unchanged_count = 0

        for file_path in sorted(base_path.glob(pattern)):
            if not file_path.is_file():
                continue
            rel_path = str(file_path.relative_to(base_path))
            file_hash = compute_file_hash(str(file_path))
            file_size = file_path.stat().st_size

            existing = await self.import_repo.get_by_path(user_id, rel_path)
            if existing is None:
                status = "new"
                new_count += 1
            elif existing.file_hash != file_hash:
                status = "modified"
                modified_count += 1
            else:
                status = "unchanged"
                unchanged_count += 1

            files.append(ScanFileItem(path=rel_path, status=status, size=file_size, hash=file_hash))

        return ScanResult(
            files=files,
            summary={"new": new_count, "modified": modified_count, "unchanged": unchanged_count},
        )

    async def scan_db_source(
        self, user_id: uuid.UUID, source_type: str, current_count: int
    ) -> ScanFileItem:
        source_path = f"db://{source_type.replace('db_', '')}"
        existing = await self.import_repo.get_by_path(user_id, source_path)
        if existing is None:
            return ScanFileItem(path=source_path, status="new", size=current_count, hash="")
        elif existing.node_count != current_count:
            return ScanFileItem(path=source_path, status="modified", size=current_count, hash="")
        else:
            return ScanFileItem(path=source_path, status="unchanged", size=current_count, hash="")


class ImportProcessor:
    def __init__(
        self,
        ontology_service: OntologyService,
        pipeline: PurificationPipeline,
        import_repo: ImportSourceRepository,
        extractor=None,
    ):
        self.ontology = ontology_service
        self.pipeline = pipeline
        self.import_repo = import_repo
        self.extractor = extractor

    async def process_markdown(
        self, user_id: uuid.UUID, base_dir: str, rel_path: str
    ) -> ImportResult:
        result = ImportResult()
        full_path = os.path.join(base_dir, rel_path)

        try:
            with open(full_path, encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            result.errors.append(f"Failed to read {rel_path}: {e}")
            return result

        file_hash = compute_file_hash(full_path)

        # Extract nodes from markdown
        if self.extractor:
            extraction = await self.extractor.extract(content[:3000], user_id)
        else:
            # Fallback: extract headings as Topic nodes
            extraction = self._extract_headings(content, rel_path)

        if not extraction.node_candidates:
            result.skipped += 1
            return result

        # Set all candidates to import source
        for node in extraction.node_candidates:
            node.source_type = "knowledge"

        # Process through pipeline with force_draft
        pipeline_result = await self.pipeline.process(extraction, user_id, force_draft=True)
        result.processed = 1
        result.draft_count = len(pipeline_result.created_objects) + len(
            pipeline_result.review_objects
        )

        # Record import source
        existing = await self.import_repo.get_by_path(user_id, rel_path)
        if existing:
            await self.import_repo.update_hash(existing.id, file_hash, result.draft_count)
        else:
            await self.import_repo.create(
                user_id=user_id,
                source_type="markdown",
                source_path=rel_path,
                file_hash=file_hash,
                node_count=result.draft_count,
            )

        return result

    async def process_db_goals(self, user_id: uuid.UUID, session: AsyncSession) -> ImportResult:
        from alma.domain.growth.repository import GoalRepository

        result = ImportResult()
        goal_repo = GoalRepository(session)
        goals = await goal_repo.list_by_user(user_id)

        candidates = []
        for goal in goals:
            existing = await self.ontology.find_by_source("goal", goal.id)
            if existing:
                result.skipped += 1
                continue
            candidates.append(
                NodeCandidate(
                    name=goal.title,
                    parent_category="Action",
                    sub_type="Goal",
                    properties={
                        "category": goal.category,
                        "status": goal.status,
                        "progress": goal.progress,
                    },
                    confidence=1.0,
                    source_type="goal",
                    source_id=goal.id,
                )
            )

        if candidates:
            extraction = RawExtraction(node_candidates=candidates)
            pipeline_result = await self.pipeline.process(extraction, user_id, force_draft=True)
            result.processed = len(candidates)
            result.draft_count = len(pipeline_result.created_objects) + len(
                pipeline_result.review_objects
            )

            # Record source
            source_path = "db://goals"
            existing_src = await self.import_repo.get_by_path(user_id, source_path)
            if existing_src:
                await self.import_repo.update_hash(
                    existing_src.id, None, result.draft_count + result.skipped
                )
            else:
                await self.import_repo.create(
                    user_id=user_id,
                    source_type="db_goals",
                    source_path=source_path,
                    node_count=result.draft_count + result.skipped,
                )

        return result

    async def process_db_habits(self, user_id: uuid.UUID, session: AsyncSession) -> ImportResult:
        from alma.domain.habit.repository import HabitRepository

        result = ImportResult()
        habit_repo = HabitRepository(session)
        habits = await habit_repo.list_by_user(user_id)

        candidates = []
        edge_candidates = []
        for habit in habits:
            existing = await self.ontology.find_by_source("habit", habit.id)
            if existing:
                result.skipped += 1
                continue
            candidates.append(
                NodeCandidate(
                    name=habit.title,
                    parent_category="Action",
                    sub_type="Habit",
                    properties={"frequency": habit.frequency_type},
                    confidence=1.0,
                    source_type="habit",
                    source_id=habit.id,
                )
            )
            if habit.goal_id:
                goal_obj = await self.ontology.find_by_source("goal", habit.goal_id)
                if goal_obj:
                    edge_candidates.append(
                        EdgeCandidate(
                            source_name=habit.title,
                            target_name=goal_obj.name,
                            relation="supports",
                            properties={},
                            confidence=1.0,
                            source_origin="system",
                        )
                    )

        if candidates:
            extraction = RawExtraction(node_candidates=candidates, edge_candidates=edge_candidates)
            pipeline_result = await self.pipeline.process(extraction, user_id, force_draft=True)
            result.processed = len(candidates)
            result.draft_count = len(pipeline_result.created_objects) + len(
                pipeline_result.review_objects
            )

            source_path = "db://habits"
            existing_src = await self.import_repo.get_by_path(user_id, source_path)
            if existing_src:
                await self.import_repo.update_hash(
                    existing_src.id, None, result.draft_count + result.skipped
                )
            else:
                await self.import_repo.create(
                    user_id=user_id,
                    source_type="db_habits",
                    source_path=source_path,
                    node_count=result.draft_count + result.skipped,
                )

        return result

    def _extract_headings(self, content: str, filename: str) -> RawExtraction:
        """Fallback: extract markdown headings as Topic nodes when LLM is unavailable."""
        import re

        headings = re.findall(r"^#{1,3}\s+(.+)$", content, re.MULTILINE)
        candidates = []
        for heading in headings[:10]:  # max 10 per file
            heading = heading.strip()
            if len(heading) < 3 or heading.startswith("---"):
                continue
            candidates.append(
                NodeCandidate(
                    name=heading,
                    parent_category="Concept",
                    sub_type="Topic",
                    properties={"source_file": filename},
                    confidence=0.6,
                    source_type="knowledge",
                )
            )
        return RawExtraction(node_candidates=candidates)
