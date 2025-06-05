import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const express = require('express');
const cors = require('cors');

import { MCPVideoEditingServer, MCPRequest, MCPResponse } from '../api/mcpInterface';

// MCP 서버를 HTTP API로 실행하는 서버
class MCPHttpServer {
  private app: any;
  private mcpServer: MCPVideoEditingServer;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.mcpServer = new MCPVideoEditingServer();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // CORS 활성화
    this.app.use(cors());
    
    // JSON 파싱 (큰 파일 업로드를 위해 제한 증가)
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // 로깅 미들웨어
    this.app.use((req: any, res: any, next: any) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // 서버 상태 확인
    this.app.get('/health', (req: any, res: any) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        server: 'MCP Video Editing Server'
      });
    });

    // MCP 요청 처리 (POST)
    this.app.post('/mcp', async (req: any, res: any) => {
      try {
        const mcpRequest: MCPRequest = req.body;
        
        // 요청 검증
        if (!mcpRequest.id || !mcpRequest.method) {
          return res.status(400).json({
            error: {
              code: -1,
              message: 'Invalid MCP request: id and method are required'
            }
          });
        }

        console.log(`Processing MCP request: ${mcpRequest.method} (ID: ${mcpRequest.id})`);
        
        // MCP 서버에서 요청 처리
        const response: MCPResponse = await this.mcpServer.handleRequest(mcpRequest);
        
        res.json(response);
        
      } catch (error) {
        console.error('MCP request processing error:', error);
        res.status(500).json({
          error: {
            code: -1,
            message: error instanceof Error ? error.message : 'Internal server error'
          }
        });
      }
    });

    // 편의를 위한 REST API 엔드포인트들
    
    // 세션 생성
    this.app.post('/sessions', async (req: any, res: any) => {
      try {
        const mcpRequest: MCPRequest = {
          id: `session-${Date.now()}`,
          method: 'session.create',
          params: {}
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 세션 목록 조회
    this.app.get('/sessions', async (req: any, res: any) => {
      try {
        const mcpRequest: MCPRequest = {
          id: `list-${Date.now()}`,
          method: 'session.list',
          params: {}
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 트랙 생성
    this.app.post('/sessions/:sessionId/tracks', async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        const { name, type } = req.body;
        
        const mcpRequest: MCPRequest = {
          id: `track-${Date.now()}`,
          method: 'edit.create_track',
          params: {
            sessionId,
            name,
            type
          }
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 타임라인 조회
    this.app.get('/sessions/:sessionId/timeline', async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        
        const mcpRequest: MCPRequest = {
          id: `timeline-${Date.now()}`,
          method: 'edit.get_timeline',
          params: {
            sessionId
          }
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 편집 지시사항 제출
    this.app.post('/sessions/:sessionId/directives', async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        const { directives } = req.body;
        
        const mcpRequest: MCPRequest = {
          id: `directives-${Date.now()}`,
          method: 'agent.submit_directives',
          params: {
            sessionId,
            directives
          }
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 편집 상태 조회
    this.app.get('/sessions/:sessionId/status', async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        
        const mcpRequest: MCPRequest = {
          id: `status-${Date.now()}`,
          method: 'agent.get_status',
          params: {
            sessionId
          }
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 다음 지시사항 실행
    this.app.post('/sessions/:sessionId/execute', async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        
        const mcpRequest: MCPRequest = {
          id: `execute-${Date.now()}`,
          method: 'agent.execute_next',
          params: {
            sessionId
          }
        };
        
        const response = await this.mcpServer.handleRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 404 처리
    this.app.use((req: any, res: any) => {
      res.status(404).json({
        error: {
          code: -404,
          message: `Endpoint not found: ${req.method} ${req.path}`
        }
      });
    });
  }

  // 서버 시작
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`
🚀 MCP Video Editing Server is running!
   
   Server: http://localhost:${this.port}
   Health: http://localhost:${this.port}/health
   
   Available endpoints:
   - POST   /mcp                        (Raw MCP requests)
   - POST   /sessions                   (Create session)
   - GET    /sessions                   (List sessions)
   - POST   /sessions/:id/tracks        (Create track)
   - GET    /sessions/:id/timeline      (Get timeline)
   - POST   /sessions/:id/directives    (Submit directives)
   - GET    /sessions/:id/status        (Get editing status)
   - POST   /sessions/:id/execute       (Execute next directive)
   
   Press Ctrl+C to stop the server.
        `);
        resolve();
      });
    });
  }

  // 서버 종료
  public stop(): void {
    console.log('\n🛑 Stopping MCP Server...');
    process.exit(0);
  }
}

// 스크립트 직접 실행시
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPHttpServer(3000);
  
  // 서버 시작
  server.start().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
  
  // 종료 시그널 처리
  process.on('SIGINT', () => {
    server.stop();
  });
  
  process.on('SIGTERM', () => {
    server.stop();
  });
}

export { MCPHttpServer }; 