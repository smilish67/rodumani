// MCP 서버 HTTP 클라이언트 테스트
class MCPHttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  // HTTP 요청 헬퍼
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // 서버 헬스 체크
  async checkHealth() {
    return await this.request('/health');
  }

  // Raw MCP 요청
  async sendMCPRequest(method: string, params: any = {}) {
    return await this.request('/mcp', {
      method: 'POST',
      body: JSON.stringify({
        id: `request-${Date.now()}`,
        method,
        params
      })
    });
  }

  // 편의 메소드들
  async createSession() {
    return await this.request('/sessions', { method: 'POST' });
  }

  async listSessions() {
    return await this.request('/sessions');
  }

  async createTrack(sessionId: string, name: string, type: string) {
    return await this.request(`/sessions/${sessionId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ name, type })
    });
  }

  async getTimeline(sessionId: string) {
    return await this.request(`/sessions/${sessionId}/timeline`);
  }

  async submitDirectives(sessionId: string, directives: any[]) {
    return await this.request(`/sessions/${sessionId}/directives`, {
      method: 'POST',
      body: JSON.stringify({ directives })
    });
  }

  async getStatus(sessionId: string) {
    return await this.request(`/sessions/${sessionId}/status`);
  }

  async executeNext(sessionId: string) {
    return await this.request(`/sessions/${sessionId}/execute`, {
      method: 'POST'
    });
  }
}

// 테스트 실행 클래스
class MCPHttpTest {
  private client: MCPHttpClient;

  constructor() {
    this.client = new MCPHttpClient();
  }

  async testBasicOperations() {
    console.log('🔍 Testing basic HTTP operations...\n');

    try {
      // 1. 헬스 체크
      console.log('1. Health check...');
      const health = await this.client.checkHealth();
      console.log(`   ✅ Server status: ${health.status}`);

      // 2. 세션 생성
      console.log('2. Creating session...');
      const sessionResponse = await this.client.createSession();
      const sessionId = sessionResponse.result?.sessionId;
      console.log(`   ✅ Session created: ${sessionId}`);

      if (!sessionId) {
        throw new Error('Failed to create session');
      }

      // 3. 트랙 생성
      console.log('3. Creating video track...');
      const trackResponse = await this.client.createTrack(sessionId, 'Main Video', 'video');
      console.log(`   ✅ Track created: ${trackResponse.result?.track?.name}`);

      // 4. 타임라인 조회
      console.log('4. Getting timeline...');
      const timeline = await this.client.getTimeline(sessionId);
      console.log(`   ✅ Timeline tracks: ${timeline.result?.tracks?.length || 0}`);

      // 5. 편집 지시사항 제출
      console.log('5. Submitting directives...');
      const directives = [
        {
          id: 'dir-1',
          type: 'add_text',
          parameters: {
            text: 'MCP Test Text',
            position: { x: 50, y: 50 },
            startTime: 0,
            endTime: 3
          },
          priority: 1,
          description: 'Add test text overlay'
        }
      ];
      
      const directiveResponse = await this.client.submitDirectives(sessionId, directives);
      console.log(`   ✅ Directives submitted. Status: ${directiveResponse.result?.editingStatus?.status}`);

      // 6. 편집 상태 확인
      console.log('6. Checking editing status...');
      const status = await this.client.getStatus(sessionId);
      console.log(`   ✅ Current status: ${status.result?.editingStatus?.status}`);
      console.log(`   📋 Pending directives: ${status.result?.editingStatus?.pendingDirectives?.length || 0}`);

      // 7. 지시사항 실행
      console.log('7. Executing next directive...');
      const executeResponse = await this.client.executeNext(sessionId);
      console.log(`   ✅ Execution result: ${executeResponse.result?.success ? 'Success' : 'Failed'}`);
      console.log(`   💬 Message: ${executeResponse.result?.message}`);

      console.log('\n✅ All HTTP tests passed!\n');
      return true;

    } catch (error) {
      console.error('❌ HTTP test failed:', error);
      return false;
    }
  }

  async testRawMCPRequests() {
    console.log('🔧 Testing raw MCP requests...\n');

    try {
      // 1. 세션 생성 (Raw MCP)
      console.log('1. Raw MCP session creation...');
      const sessionResponse = await this.client.sendMCPRequest('session.create');
      const sessionId = sessionResponse.result?.sessionId;
      console.log(`   ✅ Session created via raw MCP: ${sessionId}`);

      // 2. 에이전트 등록 (Raw MCP)
      console.log('2. Raw MCP agent registration...');
      const agentResponse = await this.client.sendMCPRequest('agent.register', {
        sessionId,
        agentId: 'test-agent-001',
        agentType: 'director'
      });
      console.log(`   ✅ Agent registered: ${agentResponse.result?.success}`);

      // 3. 세션 목록 조회 (Raw MCP)
      console.log('3. Raw MCP session listing...');
      const listResponse = await this.client.sendMCPRequest('session.list');
      console.log(`   ✅ Sessions found: ${listResponse.result?.sessions?.length || 0}`);

      console.log('\n✅ All raw MCP tests passed!\n');
      return true;

    } catch (error) {
      console.error('❌ Raw MCP test failed:', error);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting MCP HTTP Client Test Suite...\n');
    console.log('='.repeat(50));

    // 서버 연결 확인
    try {
      await this.client.checkHealth();
      console.log('✅ Server is running and healthy\n');
    } catch (error) {
      console.error('❌ Server is not running. Please start the MCP server first:');
      console.error('   npm run mcp:server\n');
      return false;
    }

    const results = {
      httpTests: await this.testBasicOperations(),
      rawMcpTests: await this.testRawMCPRequests()
    };

    console.log('='.repeat(50));
    console.log('📊 Test Results Summary:');
    console.log(`   HTTP API Tests: ${results.httpTests ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Raw MCP Tests: ${results.rawMcpTests ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(results).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    return results;
  }
}

// Node.js 환경에서 fetch 사용을 위한 polyfill
if (typeof globalThis.fetch === 'undefined') {
  // Node.js 18+ 에서는 fetch가 내장되어 있음
  // 만약 구버전이라면 node-fetch를 설치해야 함
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { default: fetch } = require('node-fetch');
    (globalThis as any).fetch = fetch;
  } catch (error) {
    console.error('❌ fetch is not available. Please upgrade to Node.js 18+ or install node-fetch');
    process.exit(1);
  }
}

// 테스트 실행 함수
export async function runMCPHttpTests() {
  const tester = new MCPHttpTest();
  return await tester.runAllTests();
}

// 스크립트 직접 실행시
if (import.meta.url === `file://${process.argv[1]}`) {
  runMCPHttpTests().then(() => {
    console.log('\n🏁 HTTP test execution completed.');
  }).catch(error => {
    console.error('❌ HTTP test execution failed:', error);
  });
} 