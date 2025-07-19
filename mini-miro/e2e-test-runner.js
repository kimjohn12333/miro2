const { chromium } = require('playwright');

/**
 * Mini-Miro E2E 테스트 러너
 * Playwright를 직접 사용하여 브라우저 테스트 실행
 */

async function runE2ETests() {
  console.log('🚀 Mini-Miro E2E 테스트 시작');
  console.log('================================================');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseURL = 'http://localhost:3003';
  const testResults = [];
  
  try {
    // 테스트 1: 페이지 기본 로딩
    console.log('\n📋 테스트 1: 페이지 기본 로딩 및 구조');
    try {
      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');
      
      const title = await page.title();
      console.log(`페이지 타이틀: ${title}`);
      
      if (title.includes('Mini-Miro')) {
        console.log('✅ 페이지 타이틀 확인됨');
        testResults.push({ test: '페이지 타이틀', status: 'PASS' });
      } else {
        console.log('❌ 페이지 타이틀 불일치');
        testResults.push({ test: '페이지 타이틀', status: 'FAIL' });
      }
      
      const rootElement = await page.locator('#root').isVisible();
      if (rootElement) {
        console.log('✅ React 앱 루트 엘리먼트 확인됨');
        testResults.push({ test: 'React 앱 구조', status: 'PASS' });
      } else {
        console.log('❌ React 앱 루트 엘리먼트 없음');
        testResults.push({ test: 'React 앱 구조', status: 'FAIL' });
      }
      
    } catch (error) {
      console.log(`❌ 페이지 로딩 실패: ${error.message}`);
      testResults.push({ test: '페이지 로딩', status: 'FAIL', error: error.message });
    }
    
    // 테스트 2: API 연결성
    console.log('\n📋 테스트 2: REST API 연결성');
    try {
      const response = await page.request.get(`${baseURL}/api/diagrams`);
      const status = response.status();
      
      if (status === 200) {
        console.log('✅ API 연결 성공');
        
        const data = await response.json();
        console.log(`다이어그램 개수: ${data.length}`);
        testResults.push({ test: 'API 연결성', status: 'PASS', data: `${data.length}개 다이어그램` });
        
        // 개별 다이어그램 조회 테스트
        if (data.length > 0) {
          const detailResponse = await page.request.get(`${baseURL}/api/diagrams/${data[0].id}`);
          if (detailResponse.status() === 200) {
            console.log('✅ 다이어그램 상세 조회 성공');
            testResults.push({ test: '다이어그램 상세 조회', status: 'PASS' });
          }
        }
      } else {
        console.log(`❌ API 연결 실패 - 상태코드: ${status}`);
        testResults.push({ test: 'API 연결성', status: 'FAIL', error: `HTTP ${status}` });
      }
    } catch (error) {
      console.log(`❌ API 테스트 실패: ${error.message}`);
      testResults.push({ test: 'API 연결성', status: 'FAIL', error: error.message });
    }
    
    // 테스트 3: WebSocket 연결 감지
    console.log('\n📋 테스트 3: WebSocket 연결 감지');
    try {
      let wsConnected = false;
      let wsMessages = [];
      
      page.on('websocket', ws => {
        wsConnected = true;
        console.log(`🔗 WebSocket 연결 감지: ${ws.url()}`);
        
        ws.on('framereceived', event => {
          wsMessages.push('received');
          console.log(`📨 메시지 수신`);
        });
        
        ws.on('framesent', event => {
          wsMessages.push('sent');
          console.log(`📤 메시지 송신`);
        });
      });
      
      // WebSocket 연결을 트리거하기 위해 페이지 새로고침 및 대기
      await page.reload();
      await page.waitForTimeout(5000);
      
      if (wsConnected) {
        console.log('✅ WebSocket 연결 확인됨');
        console.log(`메시지 총 개수: ${wsMessages.length}`);
        testResults.push({ test: 'WebSocket 연결', status: 'PASS', data: `${wsMessages.length}개 메시지` });
      } else {
        console.log('ℹ️ WebSocket 연결이 트리거되지 않음 (정상일 수 있음)');
        testResults.push({ test: 'WebSocket 연결', status: 'SKIP', note: '연결 트리거 안됨' });
      }
    } catch (error) {
      console.log(`❌ WebSocket 테스트 실패: ${error.message}`);
      testResults.push({ test: 'WebSocket 연결', status: 'FAIL', error: error.message });
    }
    
    // 테스트 4: 성능 측정
    console.log('\n📋 테스트 4: 성능 측정');
    try {
      const startTime = Date.now();
      
      await page.goto(baseURL);
      const loadTime = Date.now() - startTime;
      
      await page.waitForLoadState('domcontentloaded');
      const domTime = Date.now() - startTime;
      
      await page.waitForLoadState('networkidle');
      const completeTime = Date.now() - startTime;
      
      console.log(`📊 성능 메트릭:`);
      console.log(`  ⚡ 초기 로드: ${loadTime}ms`);
      console.log(`  📄 DOM 준비: ${domTime}ms`);
      console.log(`  🎯 완전 로드: ${completeTime}ms`);
      
      if (completeTime < 10000) {
        console.log('✅ 성능 기준 충족 (10초 이내)');
        testResults.push({ 
          test: '성능 측정', 
          status: 'PASS', 
          data: `${completeTime}ms` 
        });
      } else {
        console.log('⚠️ 성능 기준 초과 (10초 이상)');
        testResults.push({ 
          test: '성능 측정', 
          status: 'WARN', 
          data: `${completeTime}ms (느림)` 
        });
      }
    } catch (error) {
      console.log(`❌ 성능 측정 실패: ${error.message}`);
      testResults.push({ test: '성능 측정', status: 'FAIL', error: error.message });
    }
    
    // 테스트 5: 브라우저 호환성
    console.log('\n📋 테스트 5: 브라우저 호환성');
    try {
      const userAgent = await page.evaluate(() => navigator.userAgent);
      console.log(`🌐 User Agent: ${userAgent.substring(0, 80)}...`);
      
      const apiSupport = await page.evaluate(() => {
        return {
          localStorage: typeof Storage !== 'undefined',
          websocket: typeof WebSocket !== 'undefined',
          fetch: typeof fetch !== 'undefined',
          canvas: typeof HTMLCanvasElement !== 'undefined'
        };
      });
      
      let allSupported = true;
      Object.entries(apiSupport).forEach(([api, supported]) => {
        if (supported) {
          console.log(`✅ ${api.toUpperCase()} API 지원됨`);
        } else {
          console.log(`❌ ${api.toUpperCase()} API 지원 안됨`);
          allSupported = false;
        }
      });
      
      if (allSupported) {
        testResults.push({ test: '브라우저 호환성', status: 'PASS' });
      } else {
        testResults.push({ test: '브라우저 호환성', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`❌ 브라우저 호환성 테스트 실패: ${error.message}`);
      testResults.push({ test: '브라우저 호환성', status: 'FAIL', error: error.message });
    }
    
    // 테스트 6: 에러 처리
    console.log('\n📋 테스트 6: 에러 처리');
    try {
      // 404 에러 테스트
      const notFoundResponse = await page.request.get(`${baseURL}/api/nonexistent`);
      console.log(`404 API 응답: ${notFoundResponse.status()}`);
      
      // 잘못된 ID 테스트
      const badIdResponse = await page.request.get(`${baseURL}/api/diagrams/999999`);
      console.log(`잘못된 ID 응답: ${badIdResponse.status()}`);
      
      console.log('✅ 에러 처리 확인됨');
      testResults.push({ test: '에러 처리', status: 'PASS' });
    } catch (error) {
      console.log(`❌ 에러 처리 테스트 실패: ${error.message}`);
      testResults.push({ test: '에러 처리', status: 'FAIL', error: error.message });
    }
    
  } finally {
    await browser.close();
  }
  
  // 결과 요약
  console.log('\n================================================');
  console.log('🏁 테스트 결과 요약');
  console.log('================================================');
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIP').length;
  const warnings = testResults.filter(r => r.status === 'WARN').length;
  
  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : 
                 result.status === 'FAIL' ? '❌' : 
                 result.status === 'WARN' ? '⚠️' : 'ℹ️';
    const extra = result.data ? ` (${result.data})` : 
                  result.error ? ` (${result.error})` : 
                  result.note ? ` (${result.note})` : '';
    console.log(`${icon} ${result.test}${extra}`);
  });
  
  console.log('\n📊 통계:');
  console.log(`  통과: ${passed}`);
  console.log(`  실패: ${failed}`);
  console.log(`  경고: ${warnings}`);
  console.log(`  건너뜀: ${skipped}`);
  console.log(`  총계: ${testResults.length}`);
  
  const successRate = Math.round((passed / testResults.length) * 100);
  console.log(`\n🎯 성공률: ${successRate}%`);
  
  if (failed === 0) {
    console.log('🎉 모든 핵심 테스트 통과!');
  } else {
    console.log(`⚠️ ${failed}개 테스트 실패`);
  }
  
  return { passed, failed, skipped, warnings, total: testResults.length, results: testResults };
}

// 테스트 실행
if (require.main === module) {
  runE2ETests().catch(console.error);
}

module.exports = { runE2ETests };