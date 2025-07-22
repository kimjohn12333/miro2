// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright 설정 - Mini-Miro E2E 테스트
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e-tests',
  /* 전체 테스트 타임아웃 */
  timeout: 30 * 1000,
  expect: {
    /* 대기 시간 설정 */
    timeout: 5000
  },
  /* 실패 시 재시도 */
  retries: process.env.CI ? 2 : 0,
  /* 병렬 테스트 워커 수 */
  workers: 1,
  /* 결과 리포터 설정 */
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  /* 공통 설정 */
  use: {
    /* 기본 URL */
    baseURL: 'http://localhost:8081',
    /* 스크린샷 및 비디오 설정 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* 브라우저 트레이스 */
    trace: 'on-first-retry',
  },

  /* 브라우저별 프로젝트 설정 - 크로뮴만 사용 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 테스트 전 서버 시작 - 이미 실행 중이므로 비활성화 */
  // webServer: {
  //   command: 'cd server && node server.js',
  //   port: 3003,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});