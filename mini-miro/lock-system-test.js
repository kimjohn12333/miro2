// 편집 잠금 시스템 상세 테스트
const io = require('socket.io-client');

console.log('=== 편집 잠금 시스템 테스트 시작 ===');

const tests = [
  { name: '기본 잠금 획득/해제', passed: false },
  { name: '중복 잠금 요청 차단', passed: false },
  { name: '잠금 만료 시간 확인', passed: false },
  { name: '연결 해제 시 자동 잠금 해제', passed: false },
  { name: '잠금 없이 편집 시도 차단', passed: false }
];

let currentTest = 0;

// 테스트 1: 기본 잠금 획득/해제
function test1() {
  console.log('\n📝 테스트 1: 기본 잠금 획득/해제');
  
  const client = io('http://localhost:3003');
  
  client.on('connect', () => {
    client.emit('identify', { userName: 'LockTestUser1' });
    client.emit('join-diagram', { diagramId: 1 });
  });
  
  client.on('lock-status', (data) => {
    if (!data.locked) {
      client.emit('request-lock', { diagramId: 1 });
    }
  });
  
  client.on('lock-acquired', (data) => {
    console.log('  ✅ 잠금 획득 성공');
    console.log('  ⏰ 만료 시간:', new Date(data.expiresAt).toLocaleTimeString());
    
    setTimeout(() => {
      client.emit('release-lock', { diagramId: 1 });
    }, 1000);
  });
  
  client.on('lock-released', (data) => {
    console.log('  ✅ 잠금 해제 성공');
    tests[0].passed = true;
    client.disconnect();
    setTimeout(test2, 500);
  });
}

// 테스트 2: 중복 잠금 요청 차단
function test2() {
  console.log('\n📝 테스트 2: 중복 잠금 요청 차단');
  
  const client1 = io('http://localhost:3003');
  const client2 = io('http://localhost:3003');
  
  let lockAcquired = false;
  
  client1.on('connect', () => {
    client1.emit('identify', { userName: 'LockTestUser1' });
    client1.emit('join-diagram', { diagramId: 1 });
  });
  
  client2.on('connect', () => {
    client2.emit('identify', { userName: 'LockTestUser2' });
    client2.emit('join-diagram', { diagramId: 1 });
  });
  
  client1.on('lock-status', (data) => {
    if (!data.locked && !lockAcquired) {
      client1.emit('request-lock', { diagramId: 1 });
    }
  });
  
  client1.on('lock-acquired', (data) => {
    console.log('  ✅ Client 1 잠금 획득');
    lockAcquired = true;
    
    // Client 2에서 잠금 요청 시도
    setTimeout(() => {
      client2.emit('request-lock', { diagramId: 1 });
    }, 500);
  });
  
  client2.on('lock-error', (data) => {
    console.log('  ✅ Client 2 잠금 요청 차단됨:', data.message);
    tests[1].passed = true;
    
    client1.disconnect();
    client2.disconnect();
    setTimeout(test3, 500);
  });
}

// 테스트 3: 잠금 만료 시간 확인
function test3() {
  console.log('\n📝 테스트 3: 잠금 만료 시간 확인');
  
  const client = io('http://localhost:3003');
  
  client.on('connect', () => {
    client.emit('identify', { userName: 'LockTestUser1' });
    client.emit('join-diagram', { diagramId: 1 });
  });
  
  client.on('lock-status', (data) => {
    if (!data.locked) {
      client.emit('request-lock', { diagramId: 1 });
    }
  });
  
  client.on('lock-acquired', (data) => {
    const expiresAt = new Date(data.expiresAt);
    const now = new Date();
    const duration = expiresAt - now;
    
    console.log('  ✅ 잠금 획득');
    console.log('  ⏰ 현재 시간:', now.toLocaleTimeString());
    console.log('  ⏰ 만료 시간:', expiresAt.toLocaleTimeString());
    console.log('  ⏰ 지속 시간:', Math.round(duration / 1000), '초');
    
    // 5분(300초) ± 5초 범위인지 확인
    if (duration >= 295000 && duration <= 305000) {
      console.log('  ✅ 만료 시간이 올바름 (약 5분)');
      tests[2].passed = true;
    } else {
      console.log('  ❌ 만료 시간이 잘못됨');
    }
    
    client.disconnect();
    setTimeout(test4, 500);
  });
}

// 테스트 4: 연결 해제 시 자동 잠금 해제
function test4() {
  console.log('\n📝 테스트 4: 연결 해제 시 자동 잠금 해제');
  
  const client1 = io('http://localhost:3003');
  const client2 = io('http://localhost:3003');
  
  client1.on('connect', () => {
    client1.emit('identify', { userName: 'LockTestUser1' });
    client1.emit('join-diagram', { diagramId: 1 });
  });
  
  client2.on('connect', () => {
    client2.emit('identify', { userName: 'LockTestUser2' });
    client2.emit('join-diagram', { diagramId: 1 });
  });
  
  client1.on('lock-status', (data) => {
    if (!data.locked) {
      client1.emit('request-lock', { diagramId: 1 });
    }
  });
  
  client1.on('lock-acquired', (data) => {
    console.log('  ✅ Client 1 잠금 획득');
    
    // Client 1 연결 해제
    setTimeout(() => {
      console.log('  🔌 Client 1 연결 해제');
      client1.disconnect();
    }, 1000);
  });
  
  client2.on('lock-released', (data) => {
    console.log('  ✅ 자동 잠금 해제 감지됨');
    tests[3].passed = true;
    
    client2.disconnect();
    setTimeout(test5, 500);
  });
}

// 테스트 5: 잠금 없이 편집 시도 차단
function test5() {
  console.log('\n📝 테스트 5: 잠금 없이 편집 시도 차단');
  
  const client = io('http://localhost:3003');
  
  client.on('connect', () => {
    client.emit('identify', { userName: 'LockTestUser1' });
    client.emit('join-diagram', { diagramId: 1 });
    
    // 잠금 없이 바로 업데이트 시도
    setTimeout(() => {
      const changes = {
        nodes: {
          added: [{
            id: 'unauthorized-node',
            x: 200,
            y: 200,
            width: 100,
            height: 50,
            text: 'Unauthorized',
            fill: '#FF0000',
            type: 'rectangle'
          }]
        }
      };
      
      client.emit('update-diagram', { diagramId: 1, changes });
    }, 1000);
  });
  
  client.on('update-error', (data) => {
    console.log('  ✅ 무단 편집 시도 차단됨:', data.message);
    tests[4].passed = true;
    
    client.disconnect();
    setTimeout(showResults, 500);
  });
  
  // 타임아웃으로 테스트 실패 처리
  setTimeout(() => {
    if (!tests[4].passed) {
      console.log('  ❌ 무단 편집 차단 실패 (타임아웃)');
      client.disconnect();
      showResults();
    }
  }, 3000);
}

function showResults() {
  console.log('\n=== 편집 잠금 시스템 테스트 결과 ===');
  
  let passed = 0;
  tests.forEach((test, index) => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}`);
    if (test.passed) passed++;
  });
  
  console.log(`\n📊 통과율: ${passed}/${tests.length} (${Math.round(passed/tests.length*100)}%)`);
  
  process.exit(0);
}

// 테스트 시작
test1();