import pytest
from sqlalchemy import select

from alma.models.models import User, Conversation, Message


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="test@example.com", password_hash="hashed", display_name="Test")
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    saved = result.scalar_one()
    assert saved.email == "test@example.com"
    assert saved.display_name == "Test"
    assert saved.id is not None


@pytest.mark.asyncio
async def test_create_conversation(db_session):
    user = User(email="conv@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()

    conv = Conversation(user_id=user.id, title="Test Chat")
    db_session.add(conv)
    await db_session.commit()

    result = await db_session.execute(select(Conversation).where(Conversation.user_id == user.id))
    saved = result.scalar_one()
    assert saved.title == "Test Chat"


@pytest.mark.asyncio
async def test_create_message(db_session):
    user = User(email="msg@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()

    conv = Conversation(user_id=user.id, title="Msg Test")
    db_session.add(conv)
    await db_session.flush()

    msg = Message(conversation_id=conv.id, role="user", content="Hello ALMA")
    db_session.add(msg)
    await db_session.commit()

    result = await db_session.execute(select(Message).where(Message.conversation_id == conv.id))
    saved = result.scalar_one()
    assert saved.content == "Hello ALMA"
    assert saved.role == "user"
