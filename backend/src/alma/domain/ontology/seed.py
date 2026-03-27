import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.repository import (
    ActionTypeRepository,
    LinkTypeRepository,
    ObjectTypeRepository,
)

SYSTEM_OBJECT_TYPES = [
    {"name": "Person", "parent": "Entity", "schema": {"role": "str"}},
    {"name": "Project", "parent": "Entity", "schema": {"status": "str", "deadline": "date"}},
    {"name": "Organization", "parent": "Entity", "schema": {"domain": "str"}},
    {"name": "Goal", "parent": "Action", "schema": {"category": "str", "progress": "int", "target_date": "date"}},
    {"name": "Habit", "parent": "Action", "schema": {"frequency": "str", "streak": "int"}},
    {"name": "Task", "parent": "Action", "schema": {"priority": "str", "due_date": "date", "status": "str"}},
    {"name": "Topic", "parent": "Concept", "schema": {"domain": "str"}},
    {"name": "Skill", "parent": "Concept", "schema": {"level": "str"}},
    {"name": "Value", "parent": "Concept", "schema": {"importance": "float"}},
    {"name": "Metric", "parent": "Attribute", "schema": {"unit": "str", "value": "float"}},
    {"name": "Emotion", "parent": "Attribute", "schema": {"intensity": "float"}},
    {"name": "Event", "parent": "Temporal", "schema": {"start": "datetime", "end": "datetime"}},
    {"name": "Period", "parent": "Temporal", "schema": {"start": "date", "end": "date"}},
]

SYSTEM_LINK_TYPES = [
    {"name": "supports", "cardinality": "N:M", "desc": "A supports/promotes B"},
    {"name": "blocks", "cardinality": "N:M", "desc": "A blocks/hinders B"},
    {"name": "causes", "cardinality": "N:M", "desc": "A causes B"},
    {"name": "part_of", "cardinality": "N:1", "desc": "A is part of B"},
    {"name": "related_to", "cardinality": "N:M", "desc": "A is related to B"},
    {"name": "depends_on", "cardinality": "N:M", "desc": "A depends on B"},
    {"name": "measured_by", "cardinality": "N:M", "desc": "A is measured by B"},
    {"name": "belongs_to", "cardinality": "N:1", "desc": "A belongs to B"},
    {"name": "precedes", "cardinality": "N:M", "desc": "A precedes B"},
    {"name": "contradicts", "cardinality": "N:M", "desc": "A contradicts B"},
]

SYSTEM_ACTION_TYPES = [
    {"name": "create_object", "desc": "Create node"},
    {"name": "update_object", "desc": "Update node properties"},
    {"name": "archive_object", "desc": "Archive node"},
    {"name": "merge_objects", "desc": "Merge duplicate nodes"},
    {"name": "create_link", "desc": "Create relationship"},
    {"name": "remove_link", "desc": "Remove relationship"},
    {"name": "verify_object", "desc": "Verify draft node"},
]


class SystemSeed:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ot_repo = ObjectTypeRepository(session)
        self.lt_repo = LinkTypeRepository(session)
        self.at_repo = ActionTypeRepository(session)

    async def seed_for_user(self, user_id: uuid.UUID) -> None:
        for ot in SYSTEM_OBJECT_TYPES:
            existing = await self.ot_repo.get_by_name(user_id, ot["name"])
            if not existing:
                await self.ot_repo.create(
                    user_id=user_id, name=ot["name"],
                    parent_category=ot["parent"],
                    property_schema=ot.get("schema", {}),
                    is_system=True,
                )

        for lt in SYSTEM_LINK_TYPES:
            existing = await self.lt_repo.get_by_name(user_id, lt["name"])
            if not existing:
                await self.lt_repo.create(
                    user_id=user_id, name=lt["name"],
                    cardinality=lt["cardinality"],
                    description=lt["desc"],
                    is_system=True,
                )

        for at in SYSTEM_ACTION_TYPES:
            existing = await self.at_repo.get_by_name(user_id, at["name"])
            if not existing:
                await self.at_repo.create(user_id=user_id, name=at["name"], is_system=True)

        await self.session.flush()
