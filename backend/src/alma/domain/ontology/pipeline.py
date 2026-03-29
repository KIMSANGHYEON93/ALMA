import uuid

from alma.config import settings
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.models import PurificationResult, RawExtraction
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator


class PurificationPipeline:
    def __init__(
        self,
        dedup_service: DeduplicationService,
        schema_validator: SchemaValidator,
        ontology_service: OntologyService,
    ):
        self.dedup = dedup_service
        self.validator = schema_validator
        self.ontology = ontology_service

    async def process(self, extraction: RawExtraction, user_id: uuid.UUID, force_draft: bool = False) -> PurificationResult:
        result = PurificationResult()

        # Stage 1: Deduplication
        for candidate in extraction.node_candidates:
            if candidate.embedding:
                similar = await self.dedup.find_similar(
                    user_id, candidate.embedding,
                    threshold=settings.ontology_dedup_review_threshold,
                )
                if similar and similar.similarity > settings.ontology_dedup_auto_merge_threshold:
                    candidate.action = "merge"
                    candidate.merge_target_id = similar.object_id
                elif similar:
                    candidate.action = "review"

        # Stage 2: Schema Validation
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            if not self.validator.validate_properties(candidate):
                candidate.action = "reject"
                continue
            await self.ontology.create_object_type(
                user_id, candidate.sub_type, candidate.parent_category,
                property_schema=self.validator.infer_schema(candidate.properties),
            )

        # Stage 3: Normalization
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            candidate.properties = self.validator.normalize(candidate.properties)

        # Stage 4: Confidence Gate
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                result.rejected_count += 1
                continue
            if force_draft:
                candidate.status = "draft"
                continue  # skip auto-verify
            if candidate.confidence < settings.ontology_confidence_reject:
                candidate.action = "reject"
                result.rejected_count += 1
                continue
            if candidate.confidence >= settings.ontology_confidence_auto_verify and candidate.action == "create":
                candidate.status = "verified"
            else:
                candidate.status = "draft"

        # Persist nodes
        for candidate in extraction.node_candidates:
            if candidate.action == "merge" and candidate.merge_target_id:
                await self.ontology.merge_object(candidate.merge_target_id, candidate)
                result.merged_objects.append((candidate.name, candidate.merge_target_id))
            elif candidate.action in ("create", "review"):
                obj_id = await self.ontology.create_object(user_id, candidate)
                if candidate.status == "draft":
                    result.review_objects.append(obj_id)
                else:
                    result.created_objects.append(obj_id)

        # Persist edges
        for edge in extraction.edge_candidates:
            if edge.confidence < settings.ontology_confidence_reject:
                continue
            source_obj = await self.ontology.find_object_by_name(user_id, edge.source_name)
            target_obj = await self.ontology.find_object_by_name(user_id, edge.target_name)
            if source_obj and target_obj:
                link_id = await self.ontology.create_link(
                    user_id, edge.relation, source_obj.id, target_obj.id,
                    edge.properties, edge.confidence, edge.source_origin,
                )
                result.created_links.append(link_id)

        return result
