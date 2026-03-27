from alma.domain.ontology.models import NodeCandidate

VALID_CATEGORIES = {"Entity", "Action", "Concept", "Attribute", "Temporal"}


class SchemaValidator:
    def validate_category(self, parent_category: str) -> bool:
        return parent_category in VALID_CATEGORIES

    def validate_properties(self, candidate: NodeCandidate) -> bool:
        if not self.validate_category(candidate.parent_category):
            return False
        return True

    def normalize(self, properties: dict) -> dict:
        normalized = {}
        for k, v in properties.items():
            if v is None:
                continue
            if isinstance(v, str):
                v = v.strip()
            normalized[k] = v
        return normalized

    def infer_schema(self, properties: dict) -> dict:
        return {k: type(v).__name__ for k, v in properties.items() if v is not None}
