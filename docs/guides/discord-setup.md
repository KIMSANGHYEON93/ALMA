# Discord Bot 연결 가이드

## 사전 준비

- VIVARA 앱 ID: `1488065902048968704`
- Public Key: `d5e2d68012cdb547239fa5d5fba08976210916fe1e4575d0ff2b799292d222ca`

---

## Step 1: Bot Token 발급

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. 앱 선택 → **Bot** 탭
3. **Reset Token** 클릭 → 토큰 복사
4. **Privileged Gateway Intents** 섹션:
   - Message Content Intent → ON
   - Server Members Intent → ON

## Step 2: Guild ID 확인

1. Discord 앱 → 사용자 설정 → 고급 → **개발자 모드** ON
2. 봇을 사용할 서버 이름 우클릭 → **서버 ID 복사**

## Step 3: 봇 서버 초대

아래 URL을 브라우저에 붙여넣기:

```
https://discord.com/api/oauth2/authorize?client_id=1488065902048968704&permissions=3072&scope=bot%20applications.commands
```

- 서버 선택 → 승인

## Step 4: .env 설정

`alma/backend/.env`에 추가:

```env
DISCORD_BOT_TOKEN=여기에_봇_토큰_붙여넣기
DISCORD_ALLOWED_GUILDS=여기에_서버_ID_붙여넣기
```

여러 서버면 쉼표로 구분: `123456,789012`

## Step 5: Interactions Endpoint (선택)

Discord Developer Portal → 앱 → General Information:

```
Interactions Endpoint URL: https://your-domain.com/api/discord/webhook
```

로컬 테스트 시 [ngrok](https://ngrok.com/) 사용:
```bash
ngrok http 8000
# 표시된 URL + /api/discord/webhook 을 Endpoint에 입력
```

## Step 6: 서버 재시작

```bash
cd alma/backend
source .venv/Scripts/activate
uvicorn alma.main:app --reload --port 8000
```

## 사용법

Discord 서버에서:
- `!help` — 사용 가능한 명령어
- `!id` — Discord ID 확인
- 일반 메시지 → VIVARA가 AI 응답

## Telegram 설정

별도 가이드: [telegram-setup.md](telegram-setup.md) (작성 예정)

```env
TELEGRAM_BOT_TOKEN=BotFather에서_발급한_토큰
TELEGRAM_ALLOWED_USERS=텔레그램_사용자_ID (쉼표 구분)
```
