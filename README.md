# Remotion 영상편집 MCP 서버

Remotion 기반의 웹 영상편집 플랫폼으로, MCP (Model Context Protocol) 서버를 통해 직접적인 편집 기능을 제공합니다.

## 🎯 주요 기능

### 1. 미디어 파일 관리
- **파일 업로드**: 비디오, 오디오, 이미지 파일 지원
- **메타데이터 추출**: 해상도, 지속시간, 파일크기 등 자동 추출
- **썸네일 생성**: 비디오 및 이미지 파일의 썸네일 자동 생성
- **파일 형식 지원**: MP4, MOV, AVI, MP3, WAV, JPG, PNG 등

### 2. 타임라인 편집
- **멀티트랙 지원**: 비디오, 오디오, 자막 트랙 독립 관리
- **정밀한 시간 조정**: 프레임 단위 편집 가능
- **드래그 앤 드롭**: 직관적인 미디어 배치
- **실시간 미리보기**: 편집 중 즉시 결과 확인

### 3. 편집 작업
- **트림**: 시작/끝점 조정으로 클립 길이 편집
- **분할**: 특정 지점에서 클립을 둘로 나누기
- **이동**: 타임라인 상에서 클립 위치 이동
- **겹침 해결**: 자동으로 충돌하는 클립 정리
- **실행 취소/다시 실행**: 모든 편집 작업 되돌리기 가능

### 4. 레이아웃 및 배치
- **2D 변환**: 위치, 크기, 회전, 투명도 조정
- **레이어 관리**: 여러 미디어의 층별 배치
- **키프레임 애니메이션**: 시간에 따른 속성 변화
- **트랜지션 효과**: fadeIn, fadeOut, slide 등

## 🏗️ 아키텍처

### 핵심 컴포넌트

#### 1. MediaFileManager (`src/utils/mediaUtils.ts`)
```typescript
// 미디어 파일 업로드 및 관리
const mediaManager = new MediaFileManager();
const mediaFile = await mediaManager.uploadFile(file);
```

#### 2. TimelineManager (`src/utils/timelineUtils.ts`)
```typescript
// 타임라인 및 편집 작업 관리
const timeline = new TimelineManager(30); // 30fps
const track = timeline.createTrack('Video Track', 'video');
timeline.addItemToTrack(trackId, mediaItem);
```

#### 3. MCPVideoEditingServer (`src/api/mcpInterface.ts`)
```typescript
// MCP 서버 인터페이스
const server = new MCPVideoEditingServer();
const sessionId = server.createSession();
const response = await server.handleRequest(mcpRequest);
```

### MCP API 엔드포인트

#### 세션 관리
- `session.create`: 새 편집 세션 생성
- `session.delete`: 세션 삭제
- `session.list`: 활성 세션 목록

#### 미디어 관리
- `media.upload`: 파일 업로드
- `media.list`: 미디어 라이브러리 조회
- `media.delete`: 파일 삭제
- `media.get_info`: 파일 정보 조회

#### 타임라인 편집
- `timeline.create_track`: 새 트랙 생성
- `timeline.add_item`: 미디어를 트랙에 추가
- `timeline.move_item`: 클립 이동
- `timeline.trim_item`: 클립 트림
- `timeline.split_item`: 클립 분할
- `timeline.get_state`: 현재 타임라인 상태

#### 편집 작업
- `edit.undo`: 실행 취소
- `edit.redo`: 다시 실행
- `render.export`: 비디오 내보내기

## 🚀 시작하기

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

## 💻 사용 예시

### 기본 편집 워크플로우
```typescript
// 1. MCP 클라이언트 초기화
const client = new MCPClient('http://localhost:3000/mcp');
await client.startSession();

// 2. 미디어 파일 업로드
const mediaFile = await client.uploadMedia(fileData, 'video.mp4', 'video/mp4');

// 3. 트랙 생성 및 미디어 추가
const track = await client.createTrack('Main Video', 'video');
const mediaItem = await client.addToTimeline(track.id, mediaFile.id, 0);

// 4. 편집 작업
await client.trimItem(track.id, mediaItem.id, 30, 180); // 30-180프레임 구간만 사용

// 5. 내보내기
const exportId = await client.exportVideo('mp4', 'high');
```

### 고급 편집 기능
```typescript
// 키프레임 애니메이션
const keyframeManager = new KeyframeManager();
keyframeManager.addKeyframe(itemId, {
  frame: 0,
  property: 'opacity',
  value: 0,
  easing: 'ease-in'
});
keyframeManager.addKeyframe(itemId, {
  frame: 30,
  property: 'opacity',
  value: 1,
  easing: 'ease-in'
});

// 현재 프레임에서 값 계산
const currentOpacity = keyframeManager.getValue(itemId, 15, 'opacity'); // 0.5
```

## 🎨 컴포넌트 구조

### MyComposition
메인 비디오 컴포지션으로, 모든 미디어 요소들을 렌더링합니다.

```typescript
<MyComposition 
  mediaItems={mediaItems}
  timelineControls={timelineControls}
/>
```

### EditorDemo
편집 인터페이스 데모 컴포넌트입니다.

```typescript
<EditorDemo 
  width={1280}
  height={720}
  fps={30}
/>
```

## 📁 프로젝트 구조

```
src/
├── Composition.tsx          # 메인 비디오 컴포지션
├── Root.tsx                 # Remotion 루트 컴포넌트
├── utils/
│   ├── mediaUtils.ts        # 미디어 파일 관리 유틸리티
│   └── timelineUtils.ts     # 타임라인 편집 유틸리티
├── api/
│   └── mcpInterface.ts      # MCP 서버 인터페이스
└── demo/
    └── EditorDemo.tsx       # 편집 데모 컴포넌트
```

## 🔧 확장 가능성

### 1. 추가 효과
- 색상 보정 (Color Grading)
- 오디오 이퀄라이저
- 텍스트 오버레이
- 모션 그래픽스

### 2. 고급 기능
- 멀티카메라 편집
- 360도 비디오 지원
- AI 기반 자동 편집
- 실시간 협업

### 3. 통합
- 클라우드 스토리지 연동
- 외부 미디어 라이브러리
- 라이브 스트리밍
- 소셜 미디어 직접 업로드

## 🤝 기여하기

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🙏 Acknowledgments

- [Remotion](https://remotion.dev) - React 기반 비디오 제작 프레임워크
- [Model Context Protocol](https://modelcontextprotocol.io) - AI 에이전트 통신 프로토콜
