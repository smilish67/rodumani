const express = require('express');
const cors = require('cors');

// 간단한 MCP 서버 시뮬레이션
const app = express();
const port = 3000;

// 메모리 저장소
const sessions = new Map();
let sessionCounter = 1;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 로깅
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'Simple MCP Video Editing Server'
  });
});

// 세션 생성
app.post('/sessions', (req, res) => {
  const sessionId = `session_simple_${Date.now()}_${sessionCounter++}`;
  const session = {
    id: sessionId,
    tracks: [],
    currentFrame: 0,
    totalDuration: 0,
    directives: [],
    completedDirectives: []
  };
  
  sessions.set(sessionId, session);
  
  res.json({
    id: `req-${Date.now()}`,
    result: { sessionId }
  });
});

// 세션 목록
app.get('/sessions', (req, res) => {
  res.json({
    id: `req-${Date.now()}`,
    result: { sessions: Array.from(sessions.keys()) }
  });
});

// 트랙 생성
app.post('/sessions/:sessionId/tracks', (req, res) => {
  const { sessionId } = req.params;
  const { name, type } = req.body;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const track = {
    id: `track_${Date.now()}`,
    name: name || 'New Track',
    type: type || 'video',
    items: [],
    isLocked: false,
    isVisible: true
  };
  
  session.tracks.push(track);
  
  res.json({
    id: `req-${Date.now()}`,
    result: { track }
  });
});

// 타임라인 조회
app.get('/sessions/:sessionId/timeline', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id: `req-${Date.now()}`,
    result: {
      tracks: session.tracks,
      currentFrame: session.currentFrame,
      totalDuration: session.totalDuration
    }
  });
});

// 편집 지시사항 제출
app.post('/sessions/:sessionId/directives', (req, res) => {
  const { sessionId } = req.params;
  const { directives } = req.body;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // 지시사항 추가
  session.directives.push(...directives);
  
  const editingStatus = {
    sessionId,
    currentStep: session.completedDirectives.length,
    totalSteps: session.directives.length + session.completedDirectives.length,
    status: 'processing',
    message: `${directives.length} directives received`,
    completedDirectives: session.completedDirectives,
    pendingDirectives: session.directives.map(d => d.id),
    generatedAssets: []
  };
  
  res.json({
    id: `req-${Date.now()}`,
    result: {
      success: true,
      message: `${directives.length} directives received`,
      editingStatus
    }
  });
});

// 편집 상태 조회
app.get('/sessions/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const editingStatus = {
    sessionId,
    currentStep: session.completedDirectives.length,
    totalSteps: session.directives.length + session.completedDirectives.length,
    status: session.directives.length > 0 ? 'processing' : 'idle',
    message: `${session.completedDirectives.length} completed, ${session.directives.length} pending`,
    completedDirectives: session.completedDirectives,
    pendingDirectives: session.directives.map(d => d.id),
    generatedAssets: []
  };
  
  res.json({
    id: `req-${Date.now()}`,
    result: { editingStatus }
  });
});

// 지시사항 실행
app.post('/sessions/:sessionId/execute', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.directives.length === 0) {
    return res.json({
      id: `req-${Date.now()}`,
      result: {
        success: false,
        message: 'No pending directives'
      }
    });
  }
  
  // 첫 번째 지시사항 실행
  const directive = session.directives.shift();
  session.completedDirectives.push(directive.id);
  
  // 텍스트 추가 지시사항 처리
  if (directive.type === 'add_text') {
    // 텍스트 트랙 찾기 또는 생성
    let textTrack = session.tracks.find(t => t.name.includes('Text'));
    if (!textTrack) {
      textTrack = {
        id: `track_text_${Date.now()}`,
        name: 'Text Overlay',
        type: 'video',
        items: [],
        isLocked: false,
        isVisible: true
      };
      session.tracks.push(textTrack);
    }
    
    // 텍스트 아이템 추가
    const textItem = {
      id: `item_${Date.now()}`,
      type: 'text',
      text: directive.parameters.text,
      startFrame: Math.floor((directive.parameters.startTime || 0) * 30),
      durationInFrames: Math.floor(((directive.parameters.endTime || 3) - (directive.parameters.startTime || 0)) * 30),
      x: directive.parameters.position?.x || 50,
      y: directive.parameters.position?.y || 100,
      width: 800,
      height: 100,
      opacity: 1,
      scale: 1,
      rotation: 0
    };
    
    textTrack.items.push(textItem);
    session.totalDuration = Math.max(session.totalDuration, textItem.startFrame + textItem.durationInFrames);
  }
  
  const editingStatus = {
    sessionId,
    currentStep: session.completedDirectives.length,
    totalSteps: session.directives.length + session.completedDirectives.length,
    status: session.directives.length > 0 ? 'processing' : 'completed',
    message: `Directive ${directive.id} completed: ${directive.description}`,
    completedDirectives: session.completedDirectives,
    pendingDirectives: session.directives.map(d => d.id),
    generatedAssets: []
  };
  
  res.json({
    id: `req-${Date.now()}`,
    result: {
      success: true,
      message: `Directive ${directive.id} completed: ${directive.description}`,
      editingStatus
    }
  });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: -404,
      message: `Endpoint not found: ${req.method} ${req.path}`
    }
  });
});

// 서버 시작
app.listen(port, () => {
  console.log(`
🚀 Simple MCP Video Editing Server is running!
   
   Server: http://localhost:${port}
   Health: http://localhost:${port}/health
   
   Available endpoints:
   - POST   /sessions                   (Create session)
   - GET    /sessions                   (List sessions)
   - POST   /sessions/:id/tracks        (Create track)
   - GET    /sessions/:id/timeline      (Get timeline)
   - POST   /sessions/:id/directives    (Submit directives)
   - GET    /sessions/:id/status        (Get editing status)
   - POST   /sessions/:id/execute       (Execute next directive)
   
   Press Ctrl+C to stop the server.
  `);
});

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Simple MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping Simple MCP Server...');
  process.exit(0);
}); 