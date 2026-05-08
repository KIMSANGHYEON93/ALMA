import uuid
from dataclasses import dataclass, field


@dataclass
class NodeCandidate:
    name: str
    parent_category: str
    sub_type: str
    properties: dict
    confidence: float
    embedding: list[float] | None = None
    source_type: str = "llm_extracted"
    source_id: uuid.UUID | None = None
    action: str = "create"
    merge_target_id: uuid.UUID | None = None
    status: str = "draft"


@dataclass
class EdgeCandidate:
    source_name: str
    target_name: str
    relation: str
    properties: dict
    confidence: float
    source_origin: str = "llm"


@dataclass
class RawExtraction:
    node_candidates: list[NodeCandidate] = field(default_factory=list)
    edge_candidates: list[EdgeCandidate] = field(default_factory=list)

    @staticmethod
    def from_llm_response(content: str) -> "RawExtraction":
        import json

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return RawExtraction()
        nodes = [
            NodeCandidate(
                name=n["name"],
                parent_category=n["parent_category"],
                sub_type=n["sub_type"],
                properties=n.get("properties", {}),
                confidence=n.get("confidence", 0.5),
            )
            for n in data.get("nodes", [])
        ]
        edges = [
            EdgeCandidate(
                source_name=e["source_name"],
                target_name=e["target_name"],
                relation=e["relation"],
                properties=e.get("properties", {}),
                confidence=e.get("confidence", 0.5),
            )
            for e in data.get("edges", [])
        ]
        return RawExtraction(node_candidates=nodes, edge_candidates=edges)


@dataclass
class PurificationResult:
    created_objects: list[uuid.UUID] = field(default_factory=list)
    merged_objects: list[tuple] = field(default_factory=list)
    review_objects: list[uuid.UUID] = field(default_factory=list)
    rejected_count: int = 0
    created_links: list[uuid.UUID] = field(default_factory=list)


@dataclass
class SchemaContext:
    object_type_names: list[str] = field(default_factory=list)
    link_type_names: list[str] = field(default_factory=list)
    recent_node_names: list[str] = field(default_factory=list)


@dataclass
class GraphNode:
    id: uuid.UUID
    name: str
    type_id: uuid.UUID
    depth: int


@dataclass
class GraphData:
    nodes: list[dict] = field(default_factory=list)
    edges: list[dict] = field(default_factory=list)
