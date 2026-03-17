from sqlalchemy.ext.asyncio import AsyncSession

from alma.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.services.integration import IntegrationService
from alma.services.memory import MemoryService

SYSTEM_PROMPT = """You are ALMA (Adaptive Life Management Agent), a personal AI assistant.
Your mission: help users grow toward the life they desire.
You remember past conversations and use that context to provide personalized help.
You can take actions on behalf of the user (calendar, notes) when asked.
Always respond in the user's language. Be concise and helpful."""


class ChatService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        self.memory = MemoryService(session)
        self.integration = IntegrationService(session, llm)

    async def process_message(
        self, user_id: str, conversation_id: str, content: str
    ) -> str:
        # 1. Store user message
        await self.memory.store_message(conversation_id, "user", content)

        # 2. Search similar past conversations
        similar = await self.memory.search_similar(user_id, content, limit=3)

        # 3. Get current conversation history
        history = await self.memory.get_conversation_history(
            conversation_id, limit=10
        )

        # 4. Build LLM request
        messages: list[ChatMessage] = []

        if similar:
            context = "\n".join(
                [f"[Past {m.role}]: {m.content}" for m in similar]
            )
            messages.append(
                ChatMessage(
                    role="user", content=f"[Relevant past context]\n{context}"
                )
            )
            messages.append(
                ChatMessage(
                    role="assistant",
                    content="I'll keep this context in mind.",
                )
            )

        for msg in history:
            messages.append(msg)

        # 5. Call LLM
        request = LLMRequest(messages=messages, system_prompt=SYSTEM_PROMPT)
        response = await self.llm.complete(request)

        # 6. Detect action intent from response
        intent = await self.integration.detect_action_intent(response.content)
        action_note = ""
        if intent and intent.needs_confirmation:
            action_note = (
                f"\n\n---\n[Action: {intent.service}.{intent.action}"
                f"({intent.params}). 실행할까요? (예/아니오)]"
            )

        # 7. Store assistant response
        full_response = response.content + action_note
        await self.memory.store_message(
            conversation_id, "assistant", full_response
        )

        return full_response
