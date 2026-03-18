from unittest.mock import MagicMock

from alma.domain.memory.embedding import create_embedding_provider
from alma.domain.memory.models import SearchQuery, SearchResult
from alma.infrastructure.llm.base import ChatMessage


def test_search_query_creation():
    q = SearchQuery(user_id="abc", query="hello")
    assert q.limit == 5


def test_search_result_creation():
    r = SearchResult(
        messages=[ChatMessage(role="user", content="hi")],
        scores=[0.1],
    )
    assert len(r.messages) == 1


def test_create_embedding_provider_none():
    settings = MagicMock()
    settings.gemini_api_key = ""
    settings.openai_api_key = ""
    provider = create_embedding_provider(settings)
    assert provider is None
