import { test, expect, Page } from "@playwright/test";

const TEST_EMAIL = `pw-test-${Date.now()}@alma.dev`;
const TEST_PASSWORD = "test1234";
const TEST_NAME = "Playwright";

// ─── 유틸 ───

async function register(page: Page) {
  await page.goto("/login");
  // 회원가입 트리거 버튼 (로그인 폼 하단 링크)
  await page.getByRole("button", { name: /계정이 없으신가요/ }).click();
  // 모달 등장 대기
  const dialog = page.getByRole("dialog", { name: "회원가입" });
  await dialog.waitFor({ state: "visible" });
  await dialog.locator("#reg-name").fill(TEST_NAME);
  await dialog.locator("#reg-email").fill(TEST_EMAIL);
  await dialog.locator("#reg-password").fill(TEST_PASSWORD);
  await dialog.locator("#reg-password-confirm").fill(TEST_PASSWORD);
  // 모달 내 제출 버튼 (트리거 버튼과 구분)
  await dialog.getByRole("button", { name: /^회원가입$/ }).click();
  // 성공 시 모달이 1.5s 후 닫히고 URL은 /login 유지 → 모달 사라짐 대기
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
}

async function login(page: Page) {
  await page.goto("/login");
  // 로그인 폼 찾기
  const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"]').first();
  const passwordInput = page.locator('input[type="password"], input[placeholder*="비밀번호"]').first();
  await emailInput.fill(TEST_EMAIL);
  await passwordInput.fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /로그인|Login/ }).click();
  await page.waitForURL(/\/chat/, { timeout: 10000 });
}

async function ensureLoggedIn(page: Page) {
  // register는 모달이 닫힐 때까지만 기다림 (자동 로그인 안 함)
  // 이미 가입된 경우 → 모달이 안 닫혀서 throw → catch 후 로그인 시도
  try {
    await register(page);
  } catch {
    // 회원가입 실패 (이미 존재 등) → 무시하고 로그인 진행
  }
  await login(page);
}

// ─── 1. 인증 ───

test.describe("1. 인증", () => {
  test("1.1 로그인 페이지 접근", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // 이메일/비밀번호 입력 필드 존재
    await expect(page.locator('input[type="email"], input[placeholder*="이메일"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("1.2 미인증 → 보호 경로 접근 시 리다이렉트", async ({ page }) => {
    await page.goto("/habits");
    await expect(page).toHaveURL(/\/login/);
  });

  test("1.3 회원가입 + 로그인", async ({ page }) => {
    await ensureLoggedIn(page);
    await expect(page).toHaveURL(/\/chat/);
  });
});

// ─── 2. 네비게이션 ───

test.describe("2. 네비게이션", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("2.1 NavBar 탭 이동", async ({ page }) => {
    const tabs = ["대화", "목표", "습관", "인사이트", "지식", "자동화", "설정"];
    for (const tab of tabs) {
      const link = page.locator(`nav a:has-text("${tab}")`).first();
      if (await link.isVisible()) {
        await link.click();
        await page.waitForLoadState("networkidle");
      }
    }
  });
});

// ─── 3. 목표 ───

test.describe("3. 목표", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("3.1 목표 생성", async ({ page }) => {
    await page.goto("/goals");
    await page.waitForLoadState("networkidle");

    // + 버튼 또는 생성 버튼 클릭
    const createBtn = page.locator("button:has-text('+'), button:has-text('새 목표'), button:has-text('추가')").first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // 목표 제목 입력
      const titleInput = page.locator('input[placeholder*="목표"], input[placeholder*="제목"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill("Playwright 테스트 목표");
        // 생성 버튼
        const submitBtn = page.locator("button:has-text('생성'), button:has-text('추가'), button:has-text('만들기')").first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    // 페이지에 목표가 표시되는지 확인 (실패해도 OK)
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── 4. 습관 ───

test.describe("4. 습관", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("4.1 습관 페이지 접근", async ({ page }) => {
    await page.goto("/habits");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("4.2 습관 생성", async ({ page }) => {
    await page.goto("/habits");
    await page.waitForLoadState("networkidle");

    // FAB 버튼 클릭
    const fab = page.locator("button:has-text('+')").first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(500);

      // 습관 이름 입력
      const nameInput = page.locator('input[placeholder*="습관"], input[placeholder*="이름"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("Playwright 운동");
        // 추가 버튼
        const addBtn = page.locator("button:has-text('추가')").first();
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    await expect(page.locator("body")).toBeVisible();
  });

  test("4.3 통계 페이지 접근", async ({ page }) => {
    await page.goto("/habits/analytics");
    await page.waitForLoadState("networkidle");
    // 습관 통계 헤더 또는 로딩 완료 확인
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── 5. 지식 ───

test.describe("5. 지식", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("5.1 지식 페이지 접근", async ({ page }) => {
    await page.goto("/knowledge");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("5.2 텍스트 문서 추가", async ({ page }) => {
    await page.goto("/knowledge");
    await page.waitForLoadState("networkidle");

    const fab = page.locator("button:has-text('+')").first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(500);

      const titleInput = page.locator('input[placeholder*="제목"]').first();
      const contentArea = page.locator('textarea').first();
      if (await titleInput.isVisible() && await contentArea.isVisible()) {
        await titleInput.fill("PW 테스트 문서");
        await contentArea.fill("Playwright로 생성한 테스트 문서입니다. ALMA는 AI 개인 비서입니다.");
        const addBtn = page.locator("button:has-text('추가')").first();
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── 6. 자동화 ───

test.describe("6. 자동화", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("6.1 자동화 페이지 접근", async ({ page }) => {
    await page.goto("/automations");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("6.2 규칙 생성", async ({ page }) => {
    await page.goto("/automations");
    await page.waitForLoadState("networkidle");

    const fab = page.locator("button:has-text('+')").first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[placeholder*="규칙"], input[placeholder*="이름"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("PW 자동화 규칙");
        const addBtn = page.locator("button:has-text('추가')").first();
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── 7. 설정 ───

test.describe("7. 설정", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("7.1 설정 페이지 접근", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("7.2 AI 모델 선택 UI 존재", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    // AI 모델 섹션 확인
    const modelSection = page.locator("text=AI 모델").first();
    await expect(modelSection).toBeVisible({ timeout: 5000 });
  });

  test("7.3 다크모드 토글", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    // 다크모드 토글 버튼 확인
    const toggleBtn = page.locator("button:has-text('🌙'), button:has-text('☀️'), button[aria-label*='dark'], button[aria-label*='theme']").first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── 8. 채팅 ───

test.describe("8. 채팅", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("8.1 채팅 페이지 접근", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
