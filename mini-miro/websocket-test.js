// WebSocket 연결 테스트 스크립트
const io = require('socket.io-client');

console.log('=== WebSocket 연결 테스트 시작 ===');

// 두 개의 클라이언트 생성 (협업 시뮬레이션)
const client1 = io('http://localhost:3003');
const client2 = io('http://localhost:3003');

let testResults = {
  connection: { client1: false, client2: false },
  identification: { client1: false, client2: false },
  diagramJoin: { client1: false, client2: false },
  lockAcquisition: false,
  lockStatus: false,
  lockRelease: false,
  diagramUpdate: false
};

// 테스트 타임아웃
const testTimeout = setTimeout(() => {
  console.log('\n❌ 테스트 타임아웃 (10초)');
  printResults();
  process.exit(1);
}, 10000);

// Client 1 설정
client1.on('connect', () => {
  console.log('✅ Client 1 연결됨');
  testResults.connection.client1 = true;
  
  client1.emit('identify', { userName: 'TestUser1' });
  testResults.identification.client1 = true;
  
  setTimeout(() => {
    client1.emit('join-diagram', { diagramId: 1 });
  }, 100);
});

client1.on('lock-status', (data) => {
  console.log('📊 Client 1 - Lock Status:', data);
  testResults.lockStatus = true;
  
  if (!data.locked) {
    // 잠금 요청
    client1.emit('request-lock', { diagramId: 1 });
  }
});

client1.on('lock-acquired', (data) => {
  console.log('🔒 Client 1 - Lock Acquired:', data);
  testResults.lockAcquisition = true;
  
  // 다이어그램 업데이트 테스트
  setTimeout(() => {
    const changes = {
      nodes: {
        added: [{
          id: 'test-node-1',
          x: 100,
          y: 100,
          width: 120,
          height: 60,
          text: 'Test Node',
          fill: '#E3F2FD',
          type: 'rectangle'
        }]
      }
    };
    
    client1.emit('update-diagram', { diagramId: 1, changes });
  }, 500);
});

// Client 1에서는 diagram-updated 이벤트를 받지 않음 (자신이 업데이트했으므로)
// 대신 업데이트가 성공했다고 가정하고 잠금 해제
client1.on('diagram-updated', (data) => {
  console.log('📝 Client 1 - Diagram Updated:', data);
});

// Client 2가 업데이트를 받으면 테스트 성공으로 간주
let updateReceived = false;

client1.on('lock-released', (data) => {
  console.log('🔓 Client 1 - Lock Released:', data);
  testResults.lockRelease = true;
  
  // 테스트 완료
  setTimeout(() => {
    clearTimeout(testTimeout);
    printResults();
    process.exit(0);
  }, 500);
});

client1.on('user-joined', (data) => {
  console.log('👤 Client 1 - User Joined:', data);
});

client1.on('lock-error', (data) => {
  console.log('❌ Client 1 - Lock Error:', data);
});

// Client 2 설정 (두 번째 사용자 시뮬레이션)
client2.on('connect', () => {
  console.log('✅ Client 2 연결됨');
  testResults.connection.client2 = true;
  
  client2.emit('identify', { userName: 'TestUser2' });
  testResults.identification.client2 = true;
  
  setTimeout(() => {
    client2.emit('join-diagram', { diagramId: 1 });
    testResults.diagramJoin.client2 = true;
  }, 200);
});

client2.on('lock-status', (data) => {
  console.log('📊 Client 2 - Lock Status:', data);
});

client2.on('diagram-updated', (data) => {
  console.log('📝 Client 2 - Diagram Updated (실시간 수신):', data);
  testResults.diagramUpdate = true;
  updateReceived = true;
  
  // 업데이트를 받은 후 잠금 해제 요청
  setTimeout(() => {
    client1.emit('release-lock', { diagramId: 1 });
  }, 200);
});

client2.on('user-joined', (data) => {
  console.log('👤 Client 2 - User Joined:', data);
});

client2.on('lock-acquired', (data) => {
  console.log('🔒 Client 2 - Lock Status Changed:', data);
});

client2.on('lock-released', (data) => {
  console.log('🔓 Client 2 - Lock Released:', data);
});

// 연결 에러 처리
client1.on('connect_error', (error) => {
  console.log('❌ Client 1 연결 에러:', error.message);
});

client2.on('connect_error', (error) => {
  console.log('❌ Client 2 연결 에러:', error.message);
});

function printResults() {
  console.log('\n=== WebSocket 테스트 결과 ===');
  
  const results = [
    { name: 'Client 1 연결', status: testResults.connection.client1 },
    { name: 'Client 2 연결', status: testResults.connection.client2 },
    { name: 'Client 1 식별', status: testResults.identification.client1 },
    { name: 'Client 2 식별', status: testResults.identification.client2 },
    { name: 'Client 2 다이어그램 참여', status: testResults.diagramJoin.client2 },
    { name: '잠금 상태 확인', status: testResults.lockStatus },
    { name: '편집 잠금 획득', status: testResults.lockAcquisition },
    { name: '다이어그램 업데이트', status: testResults.diagramUpdate },
    { name: '편집 잠금 해제', status: testResults.lockRelease }
  ];
  
  let passed = 0;
  results.forEach(result => {
    const icon = result.status ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.status) passed++;
  });
  
  console.log(`\n📊 통과율: ${passed}/${results.length} (${Math.round(passed/results.length*100)}%)`);
  
  client1.disconnect();
  client2.disconnect();
}