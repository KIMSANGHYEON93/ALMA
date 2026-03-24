import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.knowledge.service import KnowledgeService, chunk_text, html_to_text


def test_chunk_text():
    text = "a" * 1200
    chunks = chunk_text(text, chunk_size=500, overlap=100)
    assert len(chunks) == 3
    assert len(chunks[0]) == 500
    # second chunk starts at 400
    assert len(chunks[1]) == 500


def test_chunk_text_short():
    text = "short text"
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == "short text"


def test_html_to_text():
    html = (
        "<html><head><script>alert(1)</script></head><body><h1>Hello</h1><p>World</p></body></html>"
    )
    text = html_to_text(html)
    assert "Hello" in text
    assert "World" in text
    assert "<" not in text
    assert "alert" not in text


def test_html_to_text_style():
    html = "<style>.foo{color:red}</style><div>Content</div>"
    text = html_to_text(html)
    assert "Content" in text
    assert "color" not in text


@pytest.mark.asyncio
async def test_add_document_text(db_session: AsyncSession, test_user):
    service = KnowledgeService(db_session)
    doc = await service.add_document(test_user.id, "테스트 문서", "이것은 테스트 문서입니다.")
    assert doc.title == "테스트 문서"
    assert doc.status == "ready"
    assert doc.chunk_count >= 1


@pytest.mark.asyncio
async def test_add_document_creates_chunks(db_session: AsyncSession, test_user):
    service = KnowledgeService(db_session)
    long_text = "테스트 " * 200  # ~800자
    doc = await service.add_document(test_user.id, "긴 문서", long_text)
    assert doc.chunk_count >= 2

    from alma.domain.knowledge.repository import DocumentChunkRepository

    chunk_repo = DocumentChunkRepository(db_session)
    chunks = await chunk_repo.list_by_document(doc.id)
    assert len(chunks) == doc.chunk_count


@pytest.mark.asyncio
async def test_list_documents(db_session: AsyncSession, test_user):
    service = KnowledgeService(db_session)
    await service.add_document(test_user.id, "Doc 1", "content 1")
    await service.add_document(test_user.id, "Doc 2", "content 2")

    docs = await service.list_documents(test_user.id)
    assert len(docs) == 2


@pytest.mark.asyncio
async def test_delete_cascades_chunks(db_session: AsyncSession, test_user):
    service = KnowledgeService(db_session)
    doc = await service.add_document(test_user.id, "삭제 테스트", "content " * 100)
    doc_id = doc.id
    assert doc.chunk_count >= 1

    await service.delete_document(doc_id)

    from alma.domain.knowledge.repository import DocumentChunkRepository

    chunk_repo = DocumentChunkRepository(db_session)
    chunks = await chunk_repo.list_by_document(doc_id)
    assert len(chunks) == 0
