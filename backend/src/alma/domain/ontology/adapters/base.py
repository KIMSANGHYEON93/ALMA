from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.service import OntologyService


class DomainAdapter:
    def __init__(self, pipeline: PurificationPipeline, ontology: OntologyService):
        self.pipeline = pipeline
        self.ontology = ontology
