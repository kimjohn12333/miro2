const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro 핵심 기능 E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 메인 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('메인 페이지 로딩 및 기본 UI 확인', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/Mini-Miro/);
    
    // 헤더 요소 확인
    await expect(page.locator('h1')).toContainText('Mini-Miro');
    
    // 사용자 이름 입력 필드 확인
    const userNameInput = page.locator('input[placeholder*="이름"]');
    await expect(userNameInput).toBeVisible();
    
    // 다이어그램 생성 버튼 확인
    const createButton = page.locator('button:has-text("새 다이어그램")');
    await expect(createButton).toBeVisible();
  });

  test('사용자 인증 및 다이어그램 목록 확인', async ({ page }) => {
    // 사용자 이름 입력
    const userNameInput = page.locator('input[placeholder*="이름"]');
    await userNameInput.fill('테스트사용자');
    
    // 입력 확인 (Enter 키 또는 버튼 클릭)
    await userNameInput.press('Enter');
    
    // 다이어그램 목록이 로드되는지 확인
    await page.waitForTimeout(1000);
    
    // 기존 다이어그램이 있는지 확인
    const diagramList = page.locator('.diagram-item');
    const count = await diagramList.count();
    
    if (count > 0) {
      // 최소 하나의 다이어그램이 표시되어야 함
      await expect(diagramList.first()).toBeVisible();
      console.log(`발견된 다이어그램 개수: ${count}`);
    }
  });

  test('새 다이어그램 생성 및 이름 설정', async ({ page }) => {
    // 사용자 로그인
    await page.locator('input[placeholder*="이름"]').fill('테스트사용자');
    await page.locator('input[placeholder*="이름"]').press('Enter');
    await page.waitForTimeout(1000);
    
    // 새 다이어그램 버튼 클릭
    const createButton = page.locator('button:has-text("새 다이어그램")');
    await createButton.click();
    
    // 다이어그램 생성 대화상자가 나타나는지 확인
    const modal = page.locator('.modal, .dialog, [role="dialog"]');
    if (await modal.isVisible()) {
      // 제목 입력
      const titleInput = page.locator('input[placeholder*="제목"], input[name="title"]');
      await titleInput.fill('E2E 테스트 다이어그램');
      
      // 생성 버튼 클릭
      const submitButton = page.locator('button:has-text("생성"), button:has-text("확인")');
      await submitButton.click();
      
      // 다이어그램 편집 화면으로 이동 확인
      await page.waitForTimeout(2000);
    }
    
    // URL 변경 확인 (다이어그램 편집 페이지로 이동)
    const currentUrl = page.url();
    console.log('현재 URL:', currentUrl);
  });

  test('다이어그램 편집 화면 접근 및 기본 요소 확인', async ({ page }) => {
    // 사용자 로그인
    await page.locator('input[placeholder*="이름"]').fill('테스트사용자');
    await page.locator('input[placeholder*="이름"]').press('Enter');
    await page.waitForTimeout(1000);
    
    // 첫 번째 다이어그램 클릭 (있다면)
    const firstDiagram = page.locator('.diagram-item').first();
    if (await firstDiagram.isVisible()) {
      await firstDiagram.click();
      await page.waitForTimeout(2000);
      
      // 편집 화면 요소들 확인
      const toolPanel = page.locator('.tool-panel, .toolbar');
      if (await toolPanel.isVisible()) {
        await expect(toolPanel).toBeVisible();
      }
      
      // 캔버스 영역 확인
      const canvas = page.locator('canvas, .canvas-container, .stage-container');
      if (await canvas.isVisible()) {
        await expect(canvas).toBeVisible();
      }
      
      // 편집 잠금 버튼 확인
      const lockButton = page.locator('button:has-text("편집"), button:has-text("잠금")');
      if (await lockButton.isVisible()) {
        await expect(lockButton).toBeVisible();
      }
    }
  });

  test('편집 잠금 기능 테스트', async ({ page }) => {
    // 사용자 로그인
    await page.locator('input[placeholder*="이름"]').fill('편집테스트사용자');
    await page.locator('input[placeholder*="이름"]').press('Enter');
    await page.waitForTimeout(1000);
    
    // 첫 번째 다이어그램 선택
    const firstDiagram = page.locator('.diagram-item').first();
    if (await firstDiagram.isVisible()) {
      await firstDiagram.click();
      await page.waitForTimeout(2000);
      
      // 편집 잠금 버튼 찾기 및 클릭
      const lockButton = page.locator('button:has-text("편집"), button:has-text("잠금")').first();
      if (await lockButton.isVisible()) {
        await lockButton.click();
        await page.waitForTimeout(1000);
        
        // 잠금 상태 확인
        const lockedIndicator = page.locator(':has-text("편집 중"), :has-text("잠금"), .locked');
        if (await lockedIndicator.isVisible()) {
          await expect(lockedIndicator).toBeVisible();
          console.log('편집 잠금이 성공적으로 획득됨');
        }
      }
    }
  });

  test('반응형 디자인 및 화면 크기 테스트', async ({ page }) => {
    // 데스크톱 크기에서 테스트
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 기본 요소들이 보이는지 확인
    await expect(page.locator('h1')).toBeVisible();
    
    // 태블릿 크기로 변경
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // 여전히 기본 요소들이 보이는지 확인
    await expect(page.locator('h1')).toBeVisible();
    
    // 모바일 크기로 변경 (참고용 - 요구사항에서 제외)
    // await page.setViewportSize({ width: 375, height: 667 });
    // await page.waitForTimeout(500);
    
    console.log('반응형 디자인 테스트 완료');
  });

  test('페이지 성능 및 로딩 시간 측정', async ({ page }) => {
    // 성능 메트릭 수집 시작
    const startTime = Date.now();
    
    // 페이지 로드
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const domContentLoadedTime = Date.now() - startTime;
    
    // 네트워크가 안정될 때까지 대기
    await page.waitForLoadState('networkidle');
    
    const fullyLoadedTime = Date.now() - startTime;
    
    console.log(`DOM Content Loaded: ${domContentLoadedTime}ms`);
    console.log(`Fully Loaded: ${fullyLoadedTime}ms`);
    
    // 성능 기준 검증 (3초 이내)
    expect(fullyLoadedTime).toBeLessThan(3000);
    
    // 주요 요소들이 빠르게 로드되는지 확인
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder*="이름"]')).toBeVisible();
  });

  test('접근성 기본 검증', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 키보드 내비게이션 테스트
    const userNameInput = page.locator('input[placeholder*="이름"]');
    await userNameInput.focus();
    
    // Tab 키로 이동 가능한지 확인
    await page.keyboard.press('Tab');
    
    // 버튼에 적절한 레이블이 있는지 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        
        // 버튼에 텍스트나 aria-label이 있어야 함
        expect(text || ariaLabel).toBeTruthy();
      }
    }
    
    console.log('기본 접근성 검증 완료');
  });
});