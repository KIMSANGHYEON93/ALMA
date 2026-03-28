import logging
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.models import (
    GraphData,
    GraphNode,
    NodeCandidate,
    SchemaContext,
)
from alma.domain.ontology.repository import (
    ActionLogRepository,
    ActionTypeRepository,
    LinkRepository,
    LinkTypeRepository,
    ObjectRepository,
    ObjectTypeRepository,
)
from alma.models.models import OntologyObject

logger = logging.getLogger(__name__)


class OntologyService:
    def __init__(self, session: AsyncSession, embedding_provider=None):
        self.session = session
        self.embedding = embedding_provider
        self.ot_repo = ObjectTypeRepository(session)
        self.obj_repo = ObjectRepository(session)
        self.lt_repo = LinkTypeRepository(session)
        self.link_repo = LinkRepository(session)
        self.at_repo = ActionTypeRepository(session)
        self.al_repo = ActionLogRepository(session)

    async def ensure_seeded(self, user_id: uuid.UUID) -> None:
        """Lazy seed: run system seed if no object types exist for this user."""
        existing = await self.ot_repo.list_by_user(user_id)
        if not existing:
            from alma.domain.ontology.seed import SystemSeed
            seed = SystemSeed(self.session)
            await seed.seed_for_user(user_id)

    async def get_user_schema_context(self, user_id: uuid.UUID) -> SchemaContext:
        types = await self.ot_repo.list_by_user(user_id)
        link_types = await self.lt_repo.list_by_user(user_id)
        recent = await self.obj_repo.list_recent(user_id, limit=20)
        return SchemaContext(
            object_type_names=[t.name for t in types],
            link_type_names=[lt.name for lt in link_types],
            recent_node_names=[o.name for o in recent],
        )

    async def create_object(self, user_id: uuid.UUID, candidate: NodeCandidate) -> uuid.UUID:
        type_obj = await self.ot_repo.get_by_name(user_id, candidate.sub_type)
        if not type_obj:
            type_obj = await self.ot_repo.create(
                user_id=user_id,
                name=candidate.sub_type,
                parent_category=candidate.parent_category,
            )
        obj = await self.obj_repo.create(
            user_id=user_id,
            type_id=type_obj.id,
            name=candidate.name,
            properties=candidate.properties,
            source_type=candidate.source_type,
            source_id=candidate.source_id,
            confidence=candidate.confidence,
            status=candidate.status,
        )
        await self._log_action("create_object", user_id, "system", {"name": candidate.name}, str(obj.id))
        return obj.id

    async def get_object(self, object_id: uuid.UUID) -> OntologyObject | None:
        return await self.obj_repo.get(object_id)

    async def merge_object(self, target_id: uuid.UUID, candidate: NodeCandidate) -> None:
        target = await self.obj_repo.get(target_id)
        if not target:
            return
        # Merge strategy: existing values take priority, only add new keys from candidate
        merged_props = {**candidate.properties, **target.properties}
        target.properties = merged_props
        if candidate.confidence > target.confidence:
            target.confidence = candidate.confidence
        await self._log_action(
            "merge_objects", target.user_id, "system",
            {"merged_from": candidate.name}, str(target_id),
        )

    async def verify_object(self, object_id: uuid.UUID) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.status = "verified"
            await self._log_action("verify_object", obj.user_id, "user", {}, str(object_id))

    async def archive_object(self, object_id: uuid.UUID) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.status = "archived"
            await self._log_action("archive_object", obj.user_id, "system", {}, str(object_id))

    async def update_object_properties(self, object_id: uuid.UUID, changes: dict) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.properties = {**obj.properties, **changes}
            await self._log_action(
                "update_object", obj.user_id, "adapter",
                {"changes": list(changes.keys())}, str(object_id),
            )

    async def find_by_source(self, source_type: str, source_id: uuid.UUID) -> OntologyObject | None:
        results = await self.obj_repo.find_by_source(source_type, source_id)
        return results[0] if results else None

    async def find_object_by_name(self, user_id: uuid.UUID, name: str) -> OntologyObject | None:
        return await self.obj_repo.find_by_name(user_id, name)

    async def create_link(
        self,
        user_id: uuid.UUID,
        relation: str,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        properties: dict | None = None,
        confidence: float = 1.0,
        source_origin: str = "system",
    ) -> uuid.UUID:
        link_type = await self.lt_repo.get_by_name(user_id, relation)
        if not link_type:
            link_type = await self.lt_repo.create(user_id=user_id, name=relation)
        link = await self.link_repo.create(
            user_id=user_id,
            type_id=link_type.id,
            source_id=source_id,
            target_id=target_id,
            properties=properties,
            confidence=confidence,
            source_origin=source_origin,
        )
        await self._log_action("create_link", user_id, "system", {"relation": relation}, str(link.id))
        return link.id

    async def create_object_type(self, user_id: uuid.UUID, name: str, parent_category: str, **kwargs) -> None:
        existing = await self.ot_repo.get_by_name(user_id, name)
        if not existing:
            await self.ot_repo.create(user_id=user_id, name=name, parent_category=parent_category, **kwargs)

    async def get_neighbors(self, object_id: uuid.UUID, depth: int = 2) -> list[GraphNode]:
        query = text("""
            WITH RECURSIVE graph AS (
                SELECT o.id, o.name, o.type_id, 0 AS depth
                FROM ontology_objects o
                WHERE o.id = :start_id
                UNION ALL
                SELECT o2.id, o2.name, o2.type_id, g.depth + 1
                FROM graph g
                JOIN ontology_links l ON (l.source_id = g.id OR l.target_id = g.id)
                JOIN ontology_objects o2 ON (
                    o2.id = CASE WHEN l.source_id = g.id THEN l.target_id ELSE l.source_id END
                )
                WHERE g.depth < :max_depth
                  AND o2.status = 'verified'
            ) CYCLE id SET is_cycle USING path
            SELECT DISTINCT id, name, type_id, depth FROM graph WHERE NOT is_cycle ORDER BY depth
        """)
        result = await self.session.execute(query, {"start_id": object_id, "max_depth": depth})
        return [GraphNode(id=r.id, name=r.name, type_id=r.type_id, depth=r.depth) for r in result]

    async def get_full_graph(self, user_id: uuid.UUID) -> GraphData:
        objects = await self.obj_repo.list_by_user(user_id, status="verified")
        links = await self.link_repo.list_by_user(user_id)
        # Build link_type name map for relation resolution
        link_types = await self.lt_repo.list_by_user(user_id)
        lt_name_map = {str(lt.id): lt.name for lt in link_types}
        return GraphData(
            nodes=[
                {"id": str(o.id), "name": o.name, "type_id": str(o.type_id),
                 "properties": o.properties, "confidence": o.confidence}
                for o in objects
            ],
            edges=[
                {"id": str(link.id), "source": str(link.source_id), "target": str(link.target_id),
                 "type_id": str(link.type_id), "relation": lt_name_map.get(str(link.type_id), ""),
                 "properties": link.properties, "confidence": link.confidence}
                for link in links
            ],
        )

    async def get_stats(self, user_id: uuid.UUID) -> dict:
        all_objects = await self.obj_repo.list_by_user(user_id)
        all_links = await self.link_repo.list_by_user(user_id)
        by_category = await self.obj_repo.count_by_category(user_id)
        draft_count = sum(1 for o in all_objects if o.status == "draft")
        confidences = [o.confidence for o in all_objects]
        return {
            "total_nodes": len(all_objects),
            "total_edges": len(all_links),
            "nodes_by_category": by_category,
            "draft_count": draft_count,
            "avg_confidence": sum(confidences) / len(confidences) if confidences else 0,
        }

    async def generate_embedding(self, text_content: str) -> list[float] | None:
        if self.embedding:
            return await self.embedding.embed(text_content)
        return None

    async def _log_action(
        self, action_name: str, user_id: uuid.UUID, actor: str, params: dict, affected: str
    ) -> None:
        try:
            action_type = await self.at_repo.get_by_name(user_id, action_name)
            if action_type:
                await self.al_repo.create(
                    action_type_id=action_type.id,
                    user_id=user_id,
                    actor=actor,
                    input_params=params,
                    affected_objects=[affected],
                )
        except Exception:
            logger.warning("Action log failed for %s", action_name, exc_info=True)
