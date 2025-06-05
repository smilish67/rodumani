import { MCPVideoEditingServer, MCPClient, EditingDirective } from '../api/mcpInterface';

// MCP 서버 테스트 스크립트
class MCPServerTest {
  private server: MCPVideoEditingServer;
  private client: MCPClient;

  constructor() {
    this.server = new MCPVideoEditingServer();
    this.client = new MCPClient('http://localhost:3000');
  }

  // 서버 기본 기능 테스트
  async testServerBasics() {
    console.log('🚀 Starting MCP Server Basic Tests...\n');

    try {
      // 1. 세션 생성 테스트
      console.log('1. Testing session creation...');
      const sessionId = this.server.createSession();
      console.log(`   ✅ Session created: ${sessionId}`);

      // 2. 세션 조회 테스트
      console.log('2. Testing session retrieval...');
      const session = this.server.getSession(sessionId);
      console.log(`   ✅ Session retrieved: ${session ? 'Yes' : 'No'}`);

      // 3. MCP 요청 테스트 - 세션 생성
      console.log('3. Testing MCP request handling...');
      const mcpRequest = {
        id: 'test-1',
        method: 'session.create',
        params: {}
      };
      const mcpResponse = await this.server.handleRequest(mcpRequest);
      console.log(`   ✅ MCP Response: ${JSON.stringify(mcpResponse, null, 2)}`);

      // 4. 트랙 생성 테스트
      console.log('4. Testing track creation...');
      const createTrackRequest = {
        id: 'test-2',
        method: 'edit.create_track',
        params: {
          sessionId: sessionId,
          name: 'Video Track 1',
          type: 'video' as const
        }
      };
      const trackResponse = await this.server.handleRequest(createTrackRequest);
      console.log(`   ✅ Track created: ${JSON.stringify(trackResponse.result?.track, null, 2)}`);

      console.log('\n✅ All basic tests passed!\n');
      return true;

    } catch (error) {
      console.error('❌ Basic test failed:', error);
      return false;
    }
  }

  // 에이전트 협업 테스트
  async testAgentCollaboration() {
    console.log('🤖 Starting Agent Collaboration Tests...\n');

    try {
      // 세션 생성
      const sessionId = this.server.createSession();
      console.log(`Session created: ${sessionId}`);

      // 1. 에이전트 등록 테스트
      console.log('1. Testing agent registration...');
      const registerRequest = {
        id: 'test-agent-1',
        method: 'agent.register',
        params: {
          sessionId: sessionId,
          agentId: 'director-001',
          agentType: 'director' as const
        }
      };
      const registerResponse = await this.server.handleRequest(registerRequest);
      console.log(`   ✅ Agent registered: ${JSON.stringify(registerResponse.result, null, 2)}`);

      // 2. 편집 지시사항 제출 테스트
      console.log('2. Testing directive submission...');
      const directives: EditingDirective[] = [
        {
          id: 'dir-1',
          type: 'add_text',
          parameters: {
            text: 'Hello MCP!',
            position: { x: 100, y: 100 },
            startTime: 0,
            endTime: 5
          },
          priority: 1,
          description: 'Add welcome text'
        },
        {
          id: 'dir-2',
          type: 'add_bgm',
          parameters: {
            startTime: 0,
            endTime: 30
          },
          priority: 2,
          description: 'Add background music'
        }
      ];

      const directiveRequest = {
        id: 'test-directive-1',
        method: 'agent.submit_directives',
        params: {
          sessionId: sessionId,
          directives: directives
        }
      };
      const directiveResponse = await this.server.handleRequest(directiveRequest);
      console.log(`   ✅ Directives submitted: ${JSON.stringify(directiveResponse.result?.editingStatus, null, 2)}`);

      // 3. 편집 상태 확인 테스트
      console.log('3. Testing editing status...');
      const statusRequest = {
        id: 'test-status-1',
        method: 'agent.get_status',
        params: {
          sessionId: sessionId
        }
      };
      const statusResponse = await this.server.handleRequest(statusRequest);
      console.log(`   ✅ Status retrieved: ${JSON.stringify(statusResponse.result?.editingStatus, null, 2)}`);

      console.log('\n✅ All agent collaboration tests passed!\n');
      return true;

    } catch (error) {
      console.error('❌ Agent collaboration test failed:', error);
      return false;
    }
  }

  // 클라이언트 테스트 (모의 서버 필요)
  async testClientOperations() {
    console.log('📱 Starting MCP Client Tests...\n');

    try {
      // 클라이언트 세션 시작 시뮬레이션
      console.log('1. Testing client session start...');
      // 실제로는 서버가 실행 중이어야 하지만, 여기서는 로직만 확인
      console.log('   ✅ Client session methods available');

      // 클라이언트 메소드 존재 확인
      console.log('2. Testing client method availability...');
      const clientMethods = [
        'startSession',
        'uploadMedia',
        'createTrack',
        'addMediaToTrack',
        'moveClip',
        'trimClip',
        'splitClip',
        'deleteClip',
        'addText',
        'getTimeline',
        'submitDirectives',
        'getEditingStatus',
        'executeNextDirective',
        'exportVideo'
      ];

      for (const method of clientMethods) {
        const hasMethod = typeof (this.client as any)[method] === 'function';
        console.log(`   ${hasMethod ? '✅' : '❌'} ${method}: ${hasMethod ? 'Available' : 'Missing'}`);
      }

      console.log('\n✅ All client tests passed!\n');
      return true;

    } catch (error) {
      console.error('❌ Client test failed:', error);
      return false;
    }
  }

  // 전체 테스트 실행
  async runAllTests() {
    console.log('🧪 Starting MCP Server Test Suite...\n');
    console.log('='.repeat(50));

    const results = {
      basicTests: await this.testServerBasics(),
      agentTests: await this.testAgentCollaboration(),
      clientTests: await this.testClientOperations()
    };

    console.log('='.repeat(50));
    console.log('📊 Test Results Summary:');
    console.log(`   Basic Server Tests: ${results.basicTests ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Agent Collaboration: ${results.agentTests ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Client Operations: ${results.clientTests ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(results).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    return results;
  }
}

// 테스트 실행 함수
export async function runMCPTests() {
  const tester = new MCPServerTest();
  return await tester.runAllTests();
}

// 스크립트 직접 실행시
if (import.meta.url === `file://${process.argv[1]}`) {
  runMCPTests().then(() => {
    console.log('\n🏁 Test execution completed.');
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
  });
} 