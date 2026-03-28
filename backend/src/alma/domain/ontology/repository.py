import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import (
    LinkType,
    ObjectType,
    OntologyActionLog,
    OntologyActionType,
    OntologyInsight,
    OntologyLink,
    OntologyObject,
)


class ObjectTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        parent_category: str,
        description: str | None = None,
        property_schema: dict | None = None,
        is_system: bool = False,
    ) -> ObjectType:
        obj_type = ObjectType(
            user_id=user_id,
            name=name,
            parent_category=parent_category,
            description=description,
            property_schema=property_schema or {},
            is_system=is_system,
        )
        self.session.add(obj_type)
        await self.session.flush()
        return obj_type

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> ObjectType | None:
        result = await self.session.execute(
            select(ObjectType).where(
                ObjectType.user_id == user_id,
                ObjectType.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[ObjectType]:
        result = await self.session.execute(
            select(ObjectType)
            .where(ObjectType.user_id == user_id)
            .order_by(ObjectType.parent_category, ObjectType.name)
        )
        return list(result.scalars().all())


class ObjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        type_id: uuid.UUID,
        name: str,
        properties: dict | None = None,
        source_type: str = "llm_extracted",
        source_id: uuid.UUID | None = None,
        confidence: float = 1.0,
        status: str = "draft",
    ) -> OntologyObject:
        obj = OntologyObject(
            user_id=user_id,
            type_id=type_id,
            name=name,
            properties=properties or {},
            source_type=source_type,
            source_id=source_id,
            confidence=confidence,
            status=status,
        )
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, object_id: uuid.UUID) -> OntologyObject | None:
        result = await self.session.execute(
            select(OntologyObject).where(OntologyObject.id == object_id)
        )
        return result.scalar_one_or_none()

    async def find_by_source(
        self,
        source_type: str,
        source_id: uuid.UUID,
    ) -> list[OntologyObject]:
        result = await self.session.execute(
            select(OntologyObject).where(
                OntologyObject.source_type == source_type,
                OntologyObject.source_id == source_id,
            )
        )
        return list(result.scalars().all())

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        status: str | None = None,
        type_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[OntologyObject]:
        query = select(OntologyObject).where(OntologyObject.user_id == user_id)
        if status:
            query = query.where(OntologyObject.status == status)
        if type_id:
            query = query.where(OntologyObject.type_id == type_id)
        query = query.order_by(desc(OntologyObject.updated_at)).limit(limit).offset(offset)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_recent(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
    ) -> list[OntologyObject]:
        result = await self.session.execute(
            select(OntologyObject)
            .where(OntologyObject.user_id == user_id)
            .order_by(desc(OntologyObject.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def find_by_name(
        self,
        user_id: uuid.UUID,
        name: str,
        type_id: uuid.UUID | None = None,
    ) -> OntologyObject | None:
        query = select(OntologyObject).where(
            OntologyObject.user_id == user_id,
            OntologyObject.name == name,
        )
        if type_id:
            query = query.where(OntologyObject.type_id == type_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def count_by_category(self, user_id: uuid.UUID) -> dict[str, int]:
        result = await self.session.execute(
            select(
                ObjectType.parent_category,
                func.count(OntologyObject.id).label("cnt"),
            )
            .join(ObjectType, OntologyObject.type_id == ObjectType.id)
            .where(OntologyObject.user_id == user_id)
            .group_by(ObjectType.parent_category)
        )
        return {row.parent_category: row.cnt for row in result.all()}


class LinkTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        source_type_id: uuid.UUID | None = None,
        target_type_id: uuid.UUID | None = None,
        cardinality: str = "N:M",
        description: str | None = None,
        is_system: bool = False,
    ) -> LinkType:
        link_type = LinkType(
            user_id=user_id,
            name=name,
            source_type_id=source_type_id,
            target_type_id=target_type_id,
            cardinality=cardinality,
            description=description,
            is_system=is_system,
        )
        self.session.add(link_type)
        await self.session.flush()
        return link_type

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> LinkType | None:
        result = await self.session.execute(
            select(LinkType).where(
                LinkType.user_id == user_id,
                LinkType.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[LinkType]:
        result = await self.session.execute(
            select(LinkType)
            .where(LinkType.user_id == user_id)
            .order_by(LinkType.name)
        )
        return list(result.scalars().all())


class LinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        type_id: uuid.UUID,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        properties: dict | None = None,
        confidence: float = 1.0,
        source_origin: str = "system",
    ) -> OntologyLink:
        link = OntologyLink(
            user_id=user_id,
            type_id=type_id,
            source_id=source_id,
            target_id=target_id,
            properties=properties or {},
            confidence=confidence,
            source_origin=source_origin,
        )
        self.session.add(link)
        await self.session.flush()
        return link

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        type_id: uuid.UUID | None = None,
        limit: int = 100,
    ) -> list[OntologyLink]:
        query = select(OntologyLink).where(OntologyLink.user_id == user_id)
        if type_id:
            query = query.where(OntologyLink.type_id == type_id)
        query = query.order_by(desc(OntologyLink.created_at)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_by_object(
        self,
        object_id: uuid.UUID,
        direction: str = "both",
    ) -> list[OntologyLink]:
        if direction == "outgoing":
            condition = OntologyLink.source_id == object_id
        elif direction == "incoming":
            condition = OntologyLink.target_id == object_id
        else:
            from sqlalchemy import or_
            condition = or_(
                OntologyLink.source_id == object_id,
                OntologyLink.target_id == object_id,
            )
        result = await self.session.execute(
            select(OntologyLink).where(condition).order_by(desc(OntologyLink.created_at))
        )
        return list(result.scalars().all())


class ActionTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        target_type_id: uuid.UUID | None = None,
        param_schema: dict | None = None,
        side_effects: dict | None = None,
        permissions: dict | None = None,
        is_system: bool = False,
    ) -> OntologyActionType:
        action_type = OntologyActionType(
            user_id=user_id,
            name=name,
            target_type_id=target_type_id,
            param_schema=param_schema or {},
            side_effects=side_effects or {},
            permissions=permissions or {},
            is_system=is_system,
        )
        self.session.add(action_type)
        await self.session.flush()
        return action_type

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> OntologyActionType | None:
        result = await self.session.execute(
            select(OntologyActionType).where(
                OntologyActionType.user_id == user_id,
                OntologyActionType.name == name,
            )
        )
        return result.scalar_one_or_none()


class ActionLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        action_type_id: uuid.UUID,
        user_id: uuid.UUID,
        actor: str,
        input_params: dict | None = None,
        result: dict | None = None,
        affected_objects: list | None = None,
        status: str = "success",
    ) -> OntologyActionLog:
        log = OntologyActionLog(
            action_type_id=action_type_id,
            user_id=user_id,
            actor=actor,
            input_params=input_params or {},
            result=result or {},
            affected_objects=affected_objects or [],
            status=status,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        limit: int = 50,
    ) -> list[OntologyActionLog]:
        result = await self.session.execute(
            select(OntologyActionLog)
            .where(OntologyActionLog.user_id == user_id)
            .order_by(desc(OntologyActionLog.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())


class InsightRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        insight_type: str,
        title: str,
        description: str,
        evidence: dict | None = None,
        confidence: float = 0.5,
        actionable: bool = False,
        action_suggestion: str | None = None,
    ) -> OntologyInsight:
        insight = OntologyInsight(
            user_id=user_id,
            insight_type=insight_type,
            title=title,
            description=description,
            evidence=evidence or {},
            confidence=confidence,
            actionable=actionable,
            action_suggestion=action_suggestion,
        )
        self.session.add(insight)
        await self.session.flush()
        return insight

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        insight_type: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[OntologyInsight]:
        query = select(OntologyInsight).where(OntologyInsight.user_id == user_id)
        if insight_type:
            query = query.where(OntologyInsight.insight_type == insight_type)
        if status:
            query = query.where(OntologyInsight.status == status)
        query = query.order_by(desc(OntologyInsight.created_at)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get(self, insight_id: uuid.UUID) -> OntologyInsight | None:
        result = await self.session.execute(
            select(OntologyInsight).where(OntologyInsight.id == insight_id)
        )
        return result.scalar_one_or_none()

    async def update_status(
        self, insight_id: uuid.UUID, new_status: str
    ) -> OntologyInsight | None:
        insight = await self.get(insight_id)
        if insight:
            insight.status = new_status
            await self.session.flush()
        return insight

    async def get_summary(self, user_id: uuid.UUID) -> dict:
        all_insights = await self.list_by_user(user_id, limit=500)
        by_type: dict[str, int] = {}
        new_count = 0
        for i in all_insights:
            by_type[i.insight_type] = by_type.get(i.insight_type, 0) + 1
            if i.status == "new":
                new_count += 1
        return {"total": len(all_insights), "new_count": new_count, "by_type": by_type}
