from abc import ABC, abstractmethod

from alma.core.events.models import DomainEvent
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.service import OntologyService


class DomainAdapter(ABC):
    def __init__(self, pipeline: PurificationPipeline, ontology: OntologyService):
        self.pipeline = pipeline
        self.ontology = ontology

    @abstractmethod
    async def handle(self, event: DomainEvent) -> None: ...
