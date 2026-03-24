# 멀티 채널: CLI + Telegram

## 1. 개요

비전 문서의 Gateway 패턴을 구현하여 Web 외에 CLI와 Telegram 채널을 추가한다.

**범위:**
- ChannelAdapter Protocol + UnifiedMessage/UnifiedResponse
- CLI 클라이언트 (터미널 대화형 인터페이스)
- Telegram 봇 (webhook 기반)
- 채널 공통 메시지 처리 서비스

**범위 외:** Discord, Slack, 이벤트 기반 비동기 처리 (직접 호출로 간소화)

---

## 2. 채널 추상화

### 2.1 UnifiedMessage / UnifiedResponse

```python
@dataclass(frozen=True)
class UnifiedMessage:
    channel: str           # "web", "cli", "telegram"
    user_id: str
    content: str
    conversation_id: str | None = None
    metadata: dict = field(default_factory=dict)

@dataclass(frozen=True)
class UnifiedResponse:
    content: str
    conversation_id: str
    metadata: dict = field(default_factory=dict)
```

### 2.2 ChannelService — 공통 처리

모든 채널이 공유하는 메시지 처리 로직 (기존 ChatService 재사용):

```python
class ChannelService:
    async def process_message(self, msg: UnifiedMessage) -> UnifiedResponse:
        # 1. conversation_id가 없으면 새 대화 생성
        # 2. ChatService.process_message() 호출
        # 3. UnifiedResponse 반환
```

---

## 3. CLI 클라이언트

### 3.1 구조

`backend/src/alma/cli.py` — 단독 실행 가능한 스크립트

```bash
python -m alma.cli --email user@example.com --password test1234
```

### 3.2 동작

1. 이메일/비밀번호로 로그인 → JWT 토큰 획득
2. HTTP API 호출 (`/api/auth/login`, `/api/chat/message`)
3. 대화형 루프: `입력 → API 호출 → 응답 표시`

### 3.3 CLI용 REST 엔드포인트 추가

WebSocket 대신 REST로 채팅:

```
POST /api/chat/message
Body: {"conversation_id": "...", "content": "..."}
Response: {"response": "...", "conversation_id": "..."}
```

이 엔드포인트는 CLI와 Telegram 모두 사용.

---

## 4. Telegram 봇

### 4.1 구조

`backend/src/alma/gateway/telegram.py` — FastAPI 라우터 (webhook)

### 4.2 설정

```
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ALLOWED_USERS=123456,789012  # 허용된 Telegram user_id
```

### 4.3 동작

1. Telegram → webhook POST `/api/telegram/webhook`
2. user_id → ALMA user 매핑 (DB에 telegram_id 저장)
3. ChannelService.process_message() 호출
4. 응답을 Telegram sendMessage API로 전송

### 4.4 Telegram user ↔ ALMA user 매핑

첫 메시지 시 `/start {email}` 명령으로 기존 계정 연결. `telegram_id` → user_id 매핑 테이블 or preferences에 저장.

간소화: `User.preferences`의 `telegram_id` 필드 사용.

---

## 5. 파일 구조

### Create
| 파일 | 책임 |
|------|------|
| `backend/src/alma/gateway/__init__.py` | 패키지 |
| `backend/src/alma/gateway/models.py` | UnifiedMessage, UnifiedResponse |
| `backend/src/alma/gateway/service.py` | ChannelService (공통 처리) |
| `backend/src/alma/gateway/telegram.py` | Telegram webhook 라우터 |
| `backend/src/alma/cli.py` | CLI 클라이언트 |
| `backend/src/alma/api/chat_rest.py` | REST 채팅 엔드포인트 |
| `backend/tests/test_channel.py` | 6개 테스트 |

### Modify
| 파일 | 변경 |
|------|------|
| `backend/src/alma/config.py` | +telegram_bot_token, +telegram_allowed_users |
| `backend/src/alma/main.py` | +chat_rest_router, +telegram_router |

---

## 6. 테스트

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_unified_message | UnifiedMessage 생성 |
| 2 | test_channel_service_process | ChannelService → ChatService 위임 |
| 3 | test_rest_chat_endpoint | POST /api/chat/message → 응답 |
| 4 | test_rest_chat_creates_conversation | conversation_id 없으면 새 대화 |
| 5 | test_telegram_webhook_unauthorized | 허용 안 된 user 거부 |
| 6 | test_cli_login | CLI 로그인 → 토큰 |
