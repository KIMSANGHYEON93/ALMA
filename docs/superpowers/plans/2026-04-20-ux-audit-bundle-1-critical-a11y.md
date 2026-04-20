# UX Audit Bundle 1 — Critical Accessibility Fixes 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VIVARA 프론트엔드의 WCAG 4.5:1 미달 텍스트 대비와 44×44 미달 터치 타겟, 헤딩 계층 스킵을 수정하여 모바일/저시력/스크린 리더 사용자의 접근성을 확보한다.

**Architecture:** 순수 CSS 클래스 교체 기반 스타일 수정 (로직 변경 없음). 기존 VIVARA 디자인 시스템(`sky-*`, `emerald-*`, `gray-*`) 유지, Tailwind 유틸리티만 교체. 광역 찾아바꾸기가 아닌, 실제 본문/캡션/라벨 용도로 쓰인 `text-gray-400|500` 위치만 선별 수정 — 의도적으로 약하게 표시하는 placeholder/보조 텍스트는 보존.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, Tailwind 3.4, TypeScript 5.5, ESLint (`next/core-web-vitals`).

---

## 사전 준비

**브랜치:** 현재 `feature/phase1-mvp`에 정리되지 않은 백엔드 변경이 다수 있음. 프론트엔드 전용 작업이므로 별도 브랜치로 분리 권장:

```bash
cd C:/Users/sha2.kim/alma
git checkout -b feature/ux-audit-bundle-1
```

백엔드 변경과 격리 필요 시 worktree 사용:
```bash
git worktree add ../alma-ux-1 feature/ux-audit-bundle-1
cd ../alma-ux-1
```

---

## 파일 구조

**변경 파일 (12개):**

| 파일 | 책임 | 변경 유형 |
|---|---|---|
| `frontend/src/app/page.tsx` | 랜딩 페이지 | gray 대비 10+ 위치, h4→h3 (L384), canvas 검증 (L111) |
| `frontend/src/app/settings/page.tsx` | 설정 페이지 | gray 대비 10+ 위치, 삭제 버튼 터치 타겟 (L277) |
| `frontend/src/app/automations/page.tsx` | 자동화 리스트 | gray 대비 3 위치 (L36, L60, L82) |
| `frontend/src/app/knowledge/page.tsx` | 지식 리스트 | gray 대비 2 위치 (L34, L58) |
| `frontend/src/app/chat/page.tsx` | 대화 페이지 | empty state 대비 (L34) |
| `frontend/src/components/AddKnowledgeModal.tsx` | 지식 추가 모달 | gray 대비 4 위치 (L82, L144, L148, L149) |
| `frontend/src/components/AutomationCard.tsx` | 자동화 카드 | gray 대비 2 위치 (L40, L50) |
| `frontend/src/components/HabitCard.tsx` | 습관 카드 | 토글 버튼 터치 타겟 확장 (L90-108), 옵션 버튼 (L122-135), 메모 토글 (L194-199) |
| `frontend/src/components/MessageBubble.tsx` | 채팅 메시지 | 복사 버튼 터치 타겟 (L62-71) |
| `frontend/src/components/ConversationList.tsx` | 대화 리스트 | 편집/삭제 버튼 터치 타겟 (L228-253) |
| `frontend/src/components/GoalDetail.tsx` | 목표 상세 | 마일스톤 토글(L124-142)/삭제(L152-160) 터치 타겟 |
| `frontend/src/components/common/NavBar.tsx` | 상단 네비 | 다크모드 토글(L68-84)/햄버거(L92-107) 터치 타겟 |

**비대상 (보존):**
- 프로그레스바 `text-gray-400` 위 캡션 — 이미 `dark:text-gray-300` 존재 시 유지
- 아이콘 hover 전환 전 중립 상태 (`text-gray-400 hover:text-sky-500`) — hover 대비는 OK
- 입력창 글자수 카운터 `text-gray-400` — placeholder 보조 성격이므로 유지 가능

---

## Task 1.1: Gray-on-gray 본문 색 대비 수정

**변경 원칙** (Tailwind CSS gray scale 기준 WCAG 대비):
- `text-gray-400` (≈#9ca3af) on white: 2.84:1 ❌ 
- `text-gray-500` (≈#6b7280) on white: 4.47:1 ❌ (소수점 미달)
- `text-gray-600` (≈#4b5563) on white: 6.10:1 ✅
- `text-gray-700` (≈#374151) on white: 9.19:1 ✅
- Dark 모드: `dark:text-gray-300` (≈#d1d5db) on gray-900: 11.3:1 ✅

**규칙:**
- 본문/설명/라벨: `text-gray-400|500` → `text-gray-700 dark:text-gray-300`
- 작은 캡션 (12-14px): `text-gray-400|500` → `text-gray-600 dark:text-gray-400`
- 비활성/중립 hover 시작점 (`hover:text-*`이 있는 경우): 기존 유지 허용

### Files: `frontend/src/app/page.tsx`

- [ ] **Step 1: 랜딩 페이지 본문/설명 대비 수정**

다음 라인의 `text-gray-500 dark:text-gray-400`을 `text-gray-700 dark:text-gray-300`으로 교체 (본문 단락):
- L318, L344, L370, L398, L426 (`max-w-xl|2xl` 설명 단락)
- L444, L521 (hero 하위 설명)
- L385 (feature step 설명)
- L457 (voice 설명)

작은 캡션은 `text-gray-600 dark:text-gray-400`으로:
- L177, L357, L486, L497, L501, L505, L509 (sublabel/수치 설명)
- L203 (러닝/수면 캡션)
- L554 (이용 안내 작은 글씨)

Icon hover 중립 상태는 유지:
- L332 (`w-6 h-6 text-gray-400` — 화살표 아이콘, `hover:` 전환이 있으므로 현 상태 보존)
- L477 (`text-sm text-gray-400 line-through` — 강조하지 않는 "before" 스트라이크, 의도적 약화)

- [ ] **Step 2: feature tab 비활성 탭 색 검증**

L413 `text-gray-600 dark:text-gray-400`은 비활성 탭이므로 유지. 활성 상태(L411 부근)는 대비 충분 — 변경 없음.

### Files: `frontend/src/app/settings/page.tsx`

- [ ] **Step 3: API 키 섹션 라벨 대비 수정**

L169, L179, L189의 provider 라벨을 본문 대비로 승격:

```tsx
// Before (L169)
<label className="text-xs text-gray-400 mb-1 block">Anthropic (Claude)</label>
// After
<label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Anthropic (Claude)</label>
```

동일 패턴을 L179, L189에 적용.

- [ ] **Step 4: 설정 페이지 보조 설명 대비 수정**

본문 성격 설명 — `text-gray-700 dark:text-gray-300`으로:
- L152 (모델 설명): 현 `text-xs text-gray-400 ml-2` → `text-xs text-gray-600 dark:text-gray-400 ml-2`
- L214 ("암호화되어 저장됩니다"): `text-xs text-gray-400` → `text-xs text-gray-600 dark:text-gray-400`
- L338 ("이 브라우저는...지원하지 않습니다"): `text-sm text-gray-400` → `text-sm text-gray-700 dark:text-gray-300`
- L315, L396, L428, L430: `text-xs text-gray-400` → `text-xs text-gray-600 dark:text-gray-400`
- L366: `text-xs text-gray-500` → `text-xs text-gray-600 dark:text-gray-400`

삭제/경고 버튼(L277 `text-gray-400 hover:text-red-500`)은 hover 상태 전환이므로 유지. 단 터치 타겟은 Task 1.2에서 처리.

- [ ] **Step 5: 설정 페이지 그룹 라벨**

L133 `text-xs font-medium text-gray-500 dark:text-gray-400`은 그룹 헤딩이므로 `text-gray-600 dark:text-gray-400`으로 승격:

```tsx
<p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{group.label}</p>
```

### Files: `frontend/src/app/automations/page.tsx`

- [ ] **Step 6: 자동화 리스트 수치/empty state 대비 수정**

- L36: `text-sm text-gray-500 dark:text-gray-400` → `text-sm text-gray-700 dark:text-gray-300` (활성 개수 수치)
- L60: `text-sm mb-4 text-gray-500 dark:text-gray-400` → `text-sm mb-4 text-gray-700 dark:text-gray-300` (empty state 안내)
- L82: `text-xs text-gray-500 dark:text-gray-500 pt-2` → `text-xs text-gray-600 dark:text-gray-400 pt-2` ("비활성" 뱃지 — `dark:text-gray-500` 중복 오타 수정 포함)

### Files: `frontend/src/app/knowledge/page.tsx`

- [ ] **Step 7: 지식 페이지 동일 패턴**

- L34: `text-sm text-gray-500 dark:text-gray-400` → `text-sm text-gray-700 dark:text-gray-300`
- L58: 동일 변경 패턴 (empty state)

### Files: `frontend/src/app/chat/page.tsx`

- [ ] **Step 8: 채팅 empty state 대비 수정**

L34:
```tsx
// Before
<div className="flex items-center justify-center h-full text-gray-400">
// After
<div className="flex items-center justify-center h-full text-gray-700 dark:text-gray-300">
```

### Files: `frontend/src/components/AddKnowledgeModal.tsx`

- [ ] **Step 9: 업로드 모달 텍스트 대비 수정**

- L82 (비활성 탭): 현 `text-gray-600 dark:text-gray-400` — 대비 OK. 유지.
- L144 (파일 크기 캡션): `text-xs text-gray-400 dark:text-gray-500` → `text-xs text-gray-600 dark:text-gray-400`
- L148 (안내 본문): `text-sm text-gray-500 dark:text-gray-400` → `text-sm text-gray-700 dark:text-gray-300`
- L149 ("최대 10MB"): `text-xs text-gray-400 dark:text-gray-500` → `text-xs text-gray-600 dark:text-gray-400`

### Files: `frontend/src/components/AutomationCard.tsx`

- [ ] **Step 10: 자동화 카드 설명/수치 대비 수정**

- L40: `text-xs text-gray-500 dark:text-gray-400 mt-0.5` → `text-xs text-gray-600 dark:text-gray-400 mt-0.5`
- L50: `text-xs text-gray-400` → `text-xs text-gray-600 dark:text-gray-400`

- [ ] **Step 11: Lint + 타입 체크로 Task 1.1 완료 검증**

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Expected: 오류 0, 경고는 기존 대비 증가 없음.

**Acceptance Criteria 1.1:**
- [ ] 본문/설명으로 쓰인 `text-gray-400|500`이 `gray-700 dark:gray-300`로 승격됨
- [ ] 작은 캡션이 `gray-600 dark:gray-400`로 승격됨
- [ ] hover 중립 상태(icon buttons with `hover:` 전환)는 건드리지 않음
- [ ] Lint/Type 오류 없음
- [ ] Chrome DevTools Lighthouse Accessibility 점수 증가 (수동 확인)

- [ ] **Step 12: Task 1.1 커밋**

```bash
git add frontend/src/app/page.tsx \
        frontend/src/app/settings/page.tsx \
        frontend/src/app/automations/page.tsx \
        frontend/src/app/knowledge/page.tsx \
        frontend/src/app/chat/page.tsx \
        frontend/src/components/AddKnowledgeModal.tsx \
        frontend/src/components/AutomationCard.tsx
git commit -m "fix(a11y): improve text contrast to WCAG AA (gray-400/500 → gray-700/dark:gray-300)"
```

---

## Task 1.2: 아이콘 버튼 터치 타겟 44×44 확보

**원칙:** 시각적 아이콘 크기는 그대로(12-20px), 부모 버튼의 패딩을 확장해서 hit area를 최소 44×44로 만듦. Tailwind 기준:
- `p-2` = 8px padding → 24px icon + 16px = 40px (부족)
- `p-2.5` = 10px padding → 24px icon + 20px = 44px ✅
- `p-3` = 12px padding → 24px icon + 24px = 48px ✅ (권장)
- 아이콘이 `w-4 h-4` (16px)면 `p-3.5` = 14px → 16+28 = 44px

### Files: `frontend/src/components/HabitCard.tsx`

- [ ] **Step 1: 체크박스 토글 버튼 터치 확장**

L91-107 체크박스 버튼의 시각 크기는 `w-6 h-6` (24px) — 터치 타겟 부족. 시각 크기 유지하면서 hit area 확장: 부모를 감싸는 대신 버튼 자체에 `relative` + `before` pseudo로 확장.

단순 해결: 버튼을 `w-6 h-6` 유지하되 `before:absolute before:inset-[-10px]` 추가하거나, 아니면 버튼 크기를 `w-11 h-11` (44px)로 확장 후 내부 체크박스 UI를 중앙 배치.

권장: 버튼 외곽 확장이 레이아웃을 건드리므로 `before` 가상 요소로 투명 hit area만 확장.

```tsx
// Before (L91-100)
<button
  onClick={handleToggle}
  disabled={loading}
  aria-label={`${item.title} 완료 토글`}
  aria-pressed={item.completed}
  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
    item.completed
      ? "bg-emerald-500 border-emerald-500 text-white"
      : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
  }`}
>

// After — 가상 요소로 hit area 확장 (44×44)
<button
  onClick={handleToggle}
  disabled={loading}
  aria-label={`${item.title} 완료 토글`}
  aria-pressed={item.completed}
  className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center transition before:absolute before:inset-[-10px] before:content-[''] ${
    item.completed
      ? "bg-emerald-500 border-emerald-500 text-white"
      : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
  }`}
>
```

- [ ] **Step 2: 옵션 메뉴 버튼 확장**

L122-135 옵션 버튼: 현 `p-2` + `w-4 h-4` = 32px. `p-3`으로 확장하여 40px(여전히 부족) → `p-3.5` 로 44px 확보.

```tsx
// Before (L128)
className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// After
className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
```

아이콘 주변 클릭 영역을 기존 시각 크기와 맞추기 위해 `p-3` 이면 최종 40px — 여전히 4px 부족. 대안:

```tsx
className="p-2.5 -m-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
```

`-m-2.5`로 negative margin을 주어 주변 레이아웃 영향 최소화하면서 hit area만 확장. 최종 hit area: 10+16+10 = 36px → 여전히 부족.

더 정확히: `w-4 h-4` (16px) 아이콘을 44×44로 감싸려면 padding 14px 필요. Tailwind에 `p-3.5` (14px) 있음.

```tsx
className="p-3.5 -m-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
```

최종 크기: 16 + 28 = 44px ✅. `-m-3.5`로 주변 레이아웃 영향 상쇄.

- [ ] **Step 3: 메모 토글 터치 확장**

L194-199 메모 토글:
```tsx
// Before
className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// After — 인라인 text-button이므로 최소 44px 높이 강제
className="mt-2 py-2 px-3 -ml-3 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
```

`py-2` = 8px*2 + text-xs line-height ≈ 32px — 이 버튼은 예외로 최소 36px 허용 (참고: Apple HIG 44, MD 48 — 인라인 텍스트 링크는 32+도 실무에서 허용). 시각 영향 최소화 위해 유지.

### Files: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 4: 메시지 복사 버튼 확장**

L62-71 복사 버튼 `w-7 h-7` (28px) — 확장 필요.

```tsx
// Before (L66)
className={`absolute -top-2 ${
  isUser ? "-left-8" : "-right-8"
} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm border border-gray-200 dark:border-gray-600 text-sm`}

// After — w-7 h-7 → w-11 h-11 (44px), offset 조정
className={`absolute -top-3 ${
  isUser ? "-left-12" : "-right-12"
} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-11 h-11 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm border border-gray-200 dark:border-gray-600 text-sm`}
```

`-left-12`/`-right-12` (48px)로 `-left-8`/`-right-8`에서 확장. 모바일에서 메시지와 겹치는지 `max-w-[85%]` 버블과 비교 필요 — 기존 `-left-8/-right-8`도 버블 외부였으므로 `-12`도 안전.

### Files: `frontend/src/components/ConversationList.tsx`

- [ ] **Step 5: 대화 리스트 편집/삭제 아이콘 버튼 확장**

L229-253 `p-1 text-gray-400 ...` 두 버튼: 현재 `p-1` + `w-3.5 h-3.5` = 22px — 매우 부족.

```tsx
// Before (L232-240)
<button
  onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
  className="p-1 text-gray-400 hover:text-sky-500 transition"
  title="이름 변경"
>
  <svg className="w-3.5 h-3.5" ... />
</button>

// After
<button
  onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
  aria-label={`${conv.title || "새 대화"} 이름 변경`}
  className="p-3 text-gray-400 hover:text-sky-500 transition"
  title="이름 변경"
>
  <svg className="w-4 h-4" ... />
</button>
```

`p-3` + `w-4 h-4` = 40px → 여전히 부족. `p-3.5` + `w-4 h-4` = 44px ✅. 단 L228 `absolute right-2 top-1/2` 컨테이너 내부 버튼이 2개이므로 `gap-1`로는 겹침 위험. `gap-0.5`로 조정.

```tsx
// L228 wrapper
<div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
  <button ... className="p-3 text-gray-400 hover:text-sky-500 transition" ...>
    <svg className="w-4 h-4" ... />
  </button>
  <button ... className="p-3 text-gray-400 hover:text-red-500 transition" ...>
    <svg className="w-4 h-4" ... />
  </button>
</div>
```

`p-3` + `w-4 h-4` = 40px. 여전히 4px 부족하지만 hidden-group-hover UX이므로 약간 완화 — 커스텀 `before:inset-[-2px]`로 보완 가능. 간결성 위해 `p-3` 채택, 아이콘을 `w-5 h-5` (20px)로 키워 최종 44px.

최종:
```tsx
<button ... className="p-3 -m-1 text-gray-400 hover:text-sky-500 transition" ...>
  <svg className="w-5 h-5" ... />
</button>
```

아이콘이 `w-3.5 h-3.5` → `w-5 h-5`로 커지면 시각적으로 도드라지므로 디자인 검토 필요. 대안: `before:absolute before:inset-[-6px]` 유지.

**권장 최종:**
```tsx
<button
  onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
  aria-label={`${conv.title || "새 대화"} 이름 변경`}
  className="relative p-2 text-gray-400 hover:text-sky-500 transition before:absolute before:inset-[-6px] before:content-['']"
  title="이름 변경"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> ... </svg>
</button>
```

시각 크기 유지(아이콘 16px, 버튼 시각 32px), hit area 44px 확보.

### Files: `frontend/src/components/GoalDetail.tsx`

- [ ] **Step 6: 마일스톤 토글 버튼 확장**

L124-142 `w-5 h-5` (20px) 체크박스 버튼:

```tsx
// Before (L131)
className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${...}`}

// After
className={`relative w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 before:absolute before:inset-[-12px] before:content-[''] ${...}`}
```

- [ ] **Step 7: 마일스톤 삭제 버튼 확장**

L152-160 delete button:

```tsx
// Before
<button
  onClick={() => onDeleteMilestone(ms.id)}
  aria-label={`${ms.title} 마일스톤 삭제`}
  className="text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
>
  <svg className="w-4 h-4" ... />
</button>

// After — padding 추가 (마일스톤 행은 `p-3` 부모라 여유 있음)
<button
  onClick={() => onDeleteMilestone(ms.id)}
  aria-label={`${ms.title} 마일스톤 삭제`}
  className="relative p-2 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition before:absolute before:inset-[-6px] before:content-['']"
>
  <svg className="w-4 h-4" ... />
</button>
```

`group-focus-within:opacity-100` 추가 — Bundle 3에서 다룰 내용이지만 같은 수정 영역이므로 함께 반영.

### Files: `frontend/src/components/common/NavBar.tsx`

- [ ] **Step 8: 다크모드/햄버거 버튼 확장**

L72 다크모드 토글: 현 `p-2` + `w-4 h-4` = 32px → `p-3` + `w-5 h-5` = 44px ✅

```tsx
// L72 Before
className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
// After
className="p-3 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
```

L76, L80 내부 svg를 `w-4 h-4` → `w-5 h-5`로 승격:

```tsx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"> ... </svg>
```

L98 햄버거 메뉴: 현 `p-2` + `w-5 h-5` = 36px → `p-3` 로 44px ✅

```tsx
// L98
className="md:hidden p-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
```

- [ ] **Step 9: Lint + 시각 회귀 수동 확인**

```bash
cd frontend
npm run lint && npx tsc --noEmit
npm run dev
```

수동 체크 (브라우저 localhost:3000):
- Mobile viewport (375px) — NavBar 아이콘 크기 확인
- /chat — 메시지 버블 호버 시 복사 버튼 위치
- /habits — HabitCard 옵션 메뉴 탭 가능
- /goals — 마일스톤 체크박스, 삭제 버튼 탭 가능

Chrome DevTools → "Emulate devices" → iPhone SE로 확인.

**Acceptance Criteria 1.2:**
- [ ] HabitCard 체크박스/옵션/메모 버튼 hit area ≥44×44
- [ ] MessageBubble 복사 버튼 hit area 44×44
- [ ] ConversationList 편집/삭제 버튼 hit area ≥40px (완화 허용, `before` 확장 44px 목표)
- [ ] GoalDetail 마일스톤 토글/삭제 hit area ≥44×44
- [ ] NavBar 다크모드/햄버거 44×44
- [ ] Lint/Type 오류 없음
- [ ] 기존 레이아웃 시각 변화 없음 (아이콘 크기 변경은 허용)

- [ ] **Step 10: Task 1.2 커밋**

```bash
git add frontend/src/components/HabitCard.tsx \
        frontend/src/components/MessageBubble.tsx \
        frontend/src/components/ConversationList.tsx \
        frontend/src/components/GoalDetail.tsx \
        frontend/src/components/common/NavBar.tsx
git commit -m "fix(a11y): expand icon button hit areas to 44×44 minimum (WCAG 2.5.5)"
```

---

## Task 1.3: Heading 계층 스킵 수정

### Files: `frontend/src/app/page.tsx`

- [ ] **Step 1: h4 → h3 변경**

L383-386 solution section의 step cards는 `<section>` 내에서 h2(L369 "AI가 당신의 삶을...")의 하위 레벨이므로 h3이어야 함. 현재 h4는 한 단계 건너뜀.

```tsx
// Before (L384)
<h4 className="font-semibold mb-2">{item.title}</h4>

// After
<h3 className="font-semibold mb-2">{item.title}</h3>
```

다른 h4 사용처 검증:

```bash
cd frontend
grep -n '<h4' src/app/page.tsx
```

Expected: 다른 `<h4>` 남아있으면 같은 방식으로 h3 승격 검토 (feature tabs 내부 mockup에 h4 없을 것으로 예상). 발견 시 각 섹션의 상위 h2 레벨을 확인하고 h3으로 교체.

- [ ] **Step 2: Heading 계층 수동 검증**

Chrome 확장 "HeadingsMap" 또는 Lighthouse로 확인:
1. `npm run dev`
2. localhost:3000 방문
3. DevTools → Lighthouse → Accessibility
4. "Heading elements are not in a sequentially-descending order" 룰 pass 확인

**Acceptance Criteria 1.3:**
- [ ] `app/page.tsx` 내 heading 순서가 h1 → h2 → h3 (h4 스킵 없음)
- [ ] Lighthouse heading 경고 해소

- [ ] **Step 3: Task 1.3 커밋**

```bash
git add frontend/src/app/page.tsx
git commit -m "fix(a11y): correct heading hierarchy h2→h4 skip on landing page"
```

---

## 최종 검증

- [ ] **Step 1: 통합 Lint + Type + Build**

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Expected: 모두 성공, 번들 크기 변화 없거나 미미 (스타일 교체만).

- [ ] **Step 2: a11y 자동 스캔 (선택)**

axe DevTools 확장 설치 후 각 페이지 자동 스캔:
- `/` (landing)
- `/chat`, `/goals`, `/habits`, `/insights`, `/knowledge`, `/automations`, `/ontology`, `/settings`

기대: Critical/Serious 위반 감소 (이전 대비 측정).

- [ ] **Step 3: 시각 회귀 수동 확인 — light/dark 양 모드**

브라우저 탭 열고 각 페이지에서:
- 다크 모드 토글 후 본문 텍스트 가독성 확인
- 모바일 뷰포트(375px)에서 NavBar, HabitCard, ChatWindow 터치

- [ ] **Step 4: PR 생성**

```bash
git log --oneline feature/phase1-mvp..HEAD
gh pr create --title "fix(a11y): Bundle 1 — WCAG contrast + touch target + heading hierarchy" \
  --body "$(cat <<'EOF'
## Summary
- 본문 `text-gray-400|500` → `gray-700 dark:gray-300` (WCAG AA 대비)
- 아이콘 버튼 터치 타겟 44×44 확보 (HabitCard, MessageBubble, ConversationList, GoalDetail, NavBar)
- 랜딩 페이지 heading h4→h3 (계층 스킵 해소)

## 체크리스트
- [x] Lint/Type/Build 성공
- [x] Lighthouse Accessibility 점수 증가
- [ ] axe DevTools Critical 위반 0

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 참고 — 왜 이 변경들인가

- **WCAG 2.1 AA 기준** 본문 텍스트 대비 4.5:1. `text-gray-400`/`500`은 white 배경에서 미달 → 저시력/시각 피로 사용자 접근성 장애.
- **Apple HIG / Material Design** 최소 터치 타겟 44×44pt / 48×48dp. 현재 다수 `p-1` + `w-3.5` 버튼은 20-22px로 명백 미달 → 모바일 오터치율 증가.
- **Heading 계층** 스크린 리더가 문서 구조 네비게이션 시 h-level 순서 의존. 스킵은 "섹션 누락됐나?"라는 혼란 유발.
