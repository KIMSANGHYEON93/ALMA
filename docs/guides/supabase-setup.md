# Supabase 설정 가이드 (ALMA 개발환경)

## 1. 프로젝트 생성

1. https://supabase.com 접속 → GitHub/Google 로그인
2. **New Project** 클릭
3. 설정:
   - Organization: 기본 또는 새로 생성
   - Project name: `alma-dev`
   - Database Password: 안전한 비밀번호 입력 (기록해두기!)
   - Region: **Northeast Asia (Tokyo)** — 가장 가까운 리전
4. **Create new project** 클릭 → 2~3분 대기

## 2. Connection String 가져오기

1. 좌측 메뉴 → **Settings** (톱니바퀴)
2. **Database** 탭
3. **Connection string** 섹션 → **URI** 탭
4. 형식:
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```
5. **Transaction** 모드(6543 포트) 사용 — Alembic 마이그레이션 시에는 **Session** 모드(5432 포트) 필요할 수 있음

## 3. pgvector 확장 활성화

1. 좌측 메뉴 → **SQL Editor**
2. 아래 SQL 실행:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. 성공 메시지 확인

## 4. 로컬 .env 파일 설정

```bash
cd ~/alma/backend
cp ../.env.example .env
```

`.env` 파일 편집:
```env
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
JWT_SECRET=your-random-secret-string
```

> **주의:** `postgresql://` → `postgresql+asyncpg://` 로 드라이버 변경 필수

## 5. Alembic 마이그레이션 실행

```bash
cd ~/alma/backend
source .venv/Scripts/activate  # Windows
# source .venv/bin/activate    # Mac/Linux

# 초기 마이그레이션 생성
alembic revision --autogenerate -m "initial tables"

# 마이그레이션 적용
alembic upgrade head
```

## 6. 테스트 실행

```bash
# 테스트용 DB URL 설정 (같은 Supabase DB 사용 가능)
export TEST_DATABASE_URL="postgresql+asyncpg://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

# 전체 테스트
pytest -v
```

## 7. 트러블슈팅

### Connection refused
- Supabase 대시보드에서 프로젝트가 Active 상태인지 확인
- 무료 티어는 7일 비활성 시 자동 일시정지 → **Restore** 버튼 클릭

### pgvector extension not found
- SQL Editor에서 `CREATE EXTENSION vector;` 재실행

### SSL 관련 에러
- Connection string에 `?sslmode=require` 추가:
  ```
  postgresql+asyncpg://...@.../postgres?sslmode=require
  ```

### asyncpg connection error
- `postgresql://` 대신 `postgresql+asyncpg://` 사용 확인
- Transaction mode(6543) vs Session mode(5432) 확인

## 8. 나중에 Docker로 전환 시

Docker 환경이 준비되면 `.env`의 `DATABASE_URL`만 변경:
```env
DATABASE_URL=postgresql+asyncpg://alma:alma@localhost:5432/alma
```

`docker-compose.yml`은 이미 프로젝트에 포함되어 있음.
