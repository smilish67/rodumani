// MCP 서버 인터페이스 - 에이전트 협업 기반 편집 시스템
import { random } from 'remotion';
import { MediaItem } from '../Composition';
import { MediaFile, MediaFileManager } from '../utils/mediaUtils';
import { Track, TimelineManager } from '../utils/timelineUtils';

// 에이전트 타입 정의
export type AgentType = 'director' | 'bgm_generator' | 'sfx_generator' | 'tts_generator' | 'editor';

// 편집 지시사항 타입 (감독 에이전트로부터)
export interface EditingDirective {
  id: string;
  type: 'cut_sequence' | 'add_bgm' | 'add_sfx' | 'add_text' | 'add_transition' | 'apply_effect';
  target?: string; // 대상 미디어 ID 또는 시간
  parameters: {
    startTime?: number;
    endTime?: number;
    position?: { x: number; y: number };
    style?: any;
    asset?: GeneratedAsset;
    text?: string;
    effect?: string;
  };
  priority: number; // 실행 순서
  description: string; // 자연어 설명
}

// 생성된 에셋 타입 (다른 에이전트들로부터)
export interface GeneratedAsset {
  id: string;
  type: 'bgm' | 'sfx' | 'tts' | 'image' | 'video';
  agentId: string;
  data: ArrayBuffer | string; // 파일 데이터 또는 URL
  metadata: {
    duration?: number;
    filename: string;
    mimeType: string;
    description?: string;
    tags?: string[];
  };
  generationParams?: any; // 생성에 사용된 파라미터
}

// 편집 상태 보고
export interface EditingStatus {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message: string;
  completedDirectives: string[];
  pendingDirectives: string[];
  generatedAssets: GeneratedAsset[];
}

// MCP 메시지 타입
export interface MCPRequest {
  id: string;
  method: string;
  params: RequestParams;
}

export interface MCPResponse {
  id: string;
  result?: ResponseResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// 요청 파라미터 타입 (간소화됨)
interface RequestParams {
  sessionId?: string;
  
  // 기본 미디어 관리
  fileData?: ArrayBuffer;
  fileName?: string;
  fileType?: string;
  mediaId?: string;
  
  // 기본 편집 작업
  trackId?: string;
  itemId?: string;
  name?: string;
  type?: 'video' | 'audio' | 'subtitle' | 'overlay';
  startFrame?: number;
  endFrame?: number;
  newStartFrame?: number;
  newTrackId?: string;
  splitFrame?: number;
  
  // 기본 변형
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
  scale?: number;
  rotation?: number;
  
  // 텍스트 오버레이
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  
  // 에이전트 협업
  agentId?: string;
  agentType?: AgentType;
  directive?: EditingDirective;
  directives?: EditingDirective[];
  asset?: GeneratedAsset;
  assets?: GeneratedAsset[];
  
  // 기타
  frame?: number;
  format?: string;
  quality?: string;
  outputPath?: string;
}

// 응답 결과 타입
interface ResponseResult {
  sessionId?: string;
  success?: boolean;
  sessions?: string[];
  mediaFile?: MediaFile;
  mediaFiles?: MediaFile[];
  track?: Track;
  tracks?: Track[];
  currentFrame?: number;
  totalDuration?: number;
  mediaItem?: MediaItem;
  exportId?: string;
  status?: string;
  message?: string;
  
  // 에이전트 협업 관련
  editingStatus?: EditingStatus;
  acceptedAssets?: string[];
  processedDirectives?: string[];
  pendingTasks?: string[];
}

// 편집 세션 관리 (확장됨)
export class EditingSession {
  private sessionId: string;
  private mediaManager: MediaFileManager;
  private timelineManager: TimelineManager;
  private lastSaved: Date;
  private isDirty: boolean = false;
  
  // 에이전트 협업 관련
  private directorAgent?: string;
  private connectedAgents: Map<AgentType, string> = new Map();
  private pendingDirectives: EditingDirective[] = [];
  private completedDirectives: string[] = [];
  private generatedAssets: Map<string, GeneratedAsset> = new Map();
  private editingStatus: EditingStatus;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.mediaManager = new MediaFileManager();
    this.timelineManager = new TimelineManager();
    this.lastSaved = new Date();
    
    this.editingStatus = {
      sessionId,
      currentStep: 0,
      totalSteps: 0,
      status: 'idle',
      message: 'Session created',
      completedDirectives: [],
      pendingDirectives: [],
      generatedAssets: []
    };
  }

  // 기존 메서드들...
  getSessionId(): string { return this.sessionId; }
  getMediaManager(): MediaFileManager { return this.mediaManager; }
  getTimelineManager(): TimelineManager { return this.timelineManager; }
  markDirty(): void { this.isDirty = true; }
  markSaved(): void { this.isDirty = false; this.lastSaved = new Date(); }
  isDirtyState(): boolean { return this.isDirty; }
  getLastSaved(): Date { return this.lastSaved; }

  // 에이전트 협업 메서드들
  registerAgent(agentType: AgentType, agentId: string): void {
    this.connectedAgents.set(agentType, agentId);
    if (agentType === 'director') {
      this.directorAgent = agentId;
    }
  }

  addDirectives(directives: EditingDirective[]): void {
    this.pendingDirectives.push(...directives);
    this.pendingDirectives.sort((a, b) => a.priority - b.priority);
    this.updateEditingStatus();
  }

  addGeneratedAsset(asset: GeneratedAsset): void {
    this.generatedAssets.set(asset.id, asset);
    this.updateEditingStatus();
  }

  getNextDirective(): EditingDirective | undefined {
    return this.pendingDirectives.shift();
  }

  markDirectiveCompleted(directiveId: string): void {
    this.completedDirectives.push(directiveId);
    this.updateEditingStatus();
  }

  getEditingStatus(): EditingStatus {
    return this.editingStatus;
  }

  private updateEditingStatus(): void {
    this.editingStatus = {
      sessionId: this.sessionId,
      currentStep: this.completedDirectives.length,
      totalSteps: this.completedDirectives.length + this.pendingDirectives.length,
      status: this.pendingDirectives.length > 0 ? 'processing' : 'completed',
      message: `${this.completedDirectives.length} tasks completed, ${this.pendingDirectives.length} pending`,
      completedDirectives: [...this.completedDirectives],
      pendingDirectives: this.pendingDirectives.map(d => d.id),
      generatedAssets: Array.from(this.generatedAssets.values())
    };
  }
}

// MCP 비디오 편집 서버 - 간단한 편집 도구 + 에이전트 협업
export class MCPVideoEditingServer {
  private sessions: Map<string, EditingSession> = new Map();

  // 새 편집 세션 생성
  createSession(): string {
    const sessionId = this.generateSessionId();
    const session = new EditingSession(sessionId);
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  // 세션 조회
  getSession(sessionId: string): EditingSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 세션 삭제
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // MCP 요청 처리
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      const result = await this.processRequest(request);
      return {
        id: request.id,
        result
      };
    } catch (error) {
      return {
        id: request.id,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // 요청 처리 로직 - 간소화된 기본 편집 도구들
  private async processRequest(request: MCPRequest): Promise<ResponseResult> {
    const { method, params } = request;

    switch (method) {
      // === 세션 관리 ===
      case 'session.create':
        return { sessionId: this.createSession() };

      case 'session.delete':
        return { success: this.deleteSession(params.sessionId!) };

      case 'session.list':
        return { sessions: Array.from(this.sessions.keys()) };

      // === 기본 미디어 관리 ===
      case 'media.upload':
        return await this.handleMediaUpload(params);

      case 'media.list':
        return this.handleMediaList(params);

      case 'media.delete':
        return this.handleMediaDelete(params);

      case 'media.get_info':
        return this.handleMediaInfo(params);

      // === 기본 편집 도구들 ===
      case 'edit.create_track':
        return this.handleCreateTrack(params);

      case 'edit.add_media':
        return this.handleAddMedia(params);

      case 'edit.move_clip':
        return this.handleMoveClip(params);

      case 'edit.trim_clip':
        return this.handleTrimClip(params);

      case 'edit.split_clip':
        return this.handleSplitClip(params);

      case 'edit.delete_clip':
        return this.handleDeleteClip(params);

      case 'edit.set_properties':
        return this.handleSetProperties(params);

      case 'edit.add_text':
        return this.handleAddText(params);

      case 'edit.get_timeline':
        return this.handleGetTimeline(params);

      // === 에이전트 협업 ===
      case 'agent.register':
        return this.handleAgentRegister(params);

      case 'agent.submit_asset':
        return this.handleSubmitAsset(params);

      case 'agent.submit_directives':
        return this.handleSubmitDirectives(params);

      case 'agent.get_status':
        return this.handleGetStatus(params);

      case 'agent.execute_next':
        return await this.handleExecuteNext(params);

      // === 기본 렌더링 ===
      case 'render.export':
        return this.handleExport(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // === 기본 편집 도구 구현 ===

  private async handleMediaUpload(params: RequestParams): Promise<ResponseResult> {
    const { sessionId, fileData, fileName, fileType } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const file = new File([fileData!], fileName!, { type: fileType! });
    const mediaFile = await session.getMediaManager().uploadFile(file);
    
    session.markDirty();
    return { mediaFile };
  }

  private handleMediaList(params: RequestParams): ResponseResult {
    const { sessionId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    return { mediaFiles: session.getMediaManager().getMediaFiles() };
  }

  private handleMediaDelete(params: RequestParams): ResponseResult {
    const { sessionId, mediaId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const success = session.getMediaManager().deleteMediaFile(mediaId!);
    if (success) session.markDirty();
    
    return { success };
  }

  private handleMediaInfo(params: RequestParams): ResponseResult {
    const { sessionId, mediaId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const mediaFile = session.getMediaManager().getMediaFile(mediaId!);
    return { mediaFile };
  }

  private handleCreateTrack(params: RequestParams): ResponseResult {
    const { sessionId, name, type } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    // overlay 타입을 video로 변환
    const trackType = type === 'overlay' ? 'video' : type as 'video' | 'audio' | 'subtitle';
    const track = session.getTimelineManager().createTrack(name!, trackType);
    session.markDirty();
    
    return { track };
  }

  private handleAddMedia(params: RequestParams): ResponseResult {
    const { sessionId, trackId, mediaId, startFrame } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const mediaFile = session.getMediaManager().getMediaFile(mediaId!);
    if (!mediaFile) throw new Error('Media file not found');

    const mediaItem: MediaItem = {
      id: this.generateId(),
      type: mediaFile.type,
      src: mediaFile.url,
      startFrame: startFrame || 0,
      durationInFrames: Math.floor((mediaFile.metadata.duration || 5) * 30),
      x: params.x || 0,
      y: params.y || 0,
      width: params.width || mediaFile.metadata.width || 1280,
      height: params.height || mediaFile.metadata.height || 720,
      opacity: params.opacity || 1,
      scale: params.scale || 1,
      rotation: params.rotation || 0
    };

    const success = session.getTimelineManager().addItemToTrack(trackId!, mediaItem);
    if (success) session.markDirty();
    
    return { success, mediaItem };
  }

  private handleMoveClip(params: RequestParams): ResponseResult {
    const { sessionId, trackId, itemId, newStartFrame, newTrackId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const success = session.getTimelineManager().moveItem(trackId!, itemId!, newStartFrame!, newTrackId);
    if (success) session.markDirty();
    
    return { success };
  }

  private handleTrimClip(params: RequestParams): ResponseResult {
    const { sessionId, trackId, itemId, startFrame, endFrame } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const success = session.getTimelineManager().trimItem(trackId!, itemId!, startFrame, endFrame);
    if (success) session.markDirty();
    
    return { success };
  }

  private handleSplitClip(params: RequestParams): ResponseResult {
    const { sessionId, trackId, itemId, splitFrame } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const success = session.getTimelineManager().splitItem(trackId!, itemId!, splitFrame!);
    if (success) session.markDirty();
    
    return { success };
  }

  private handleDeleteClip(params: RequestParams): ResponseResult {
    const { sessionId, trackId, itemId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const success = session.getTimelineManager().removeItemFromTrack(trackId!, itemId!);
    if (success) session.markDirty();
    
    return { success };
  }

  private handleSetProperties(params: RequestParams): ResponseResult {
    const { sessionId, trackId, itemId, x, y, width, height, opacity, scale, rotation } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const track = session.getTimelineManager().getTrack(trackId!);
    if (!track) throw new Error('Track not found');

    const item = track.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');

    // 속성 업데이트
    if (x !== undefined) item.x = x;
    if (y !== undefined) item.y = y;
    if (width !== undefined) item.width = width;
    if (height !== undefined) item.height = height;
    if (opacity !== undefined) item.opacity = opacity;
    if (scale !== undefined) item.scale = scale;
    if (rotation !== undefined) item.rotation = rotation;

    session.markDirty();
    return { success: true, mediaItem: item };
  }

  private handleAddText(params: RequestParams): ResponseResult {
    const { sessionId, text, startFrame, x, y, width, height, fontSize, color, fontFamily } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    // 텍스트 오버레이용 트랙 찾기 또는 생성
    let textTrack = session.getTimelineManager().getTracks().find(t => t.name.includes('Text'));
    if (!textTrack) {
      textTrack = session.getTimelineManager().createTrack('Text Overlay', 'video');
    }

    const textItem: MediaItem = {
      id: this.generateId(),
      type: 'image', // 텍스트를 이미지로 렌더링
      src: this.generateTextDataURL(text!, { fontSize, color, fontFamily }),
      startFrame: startFrame || 0,
      durationInFrames: 90, // 3초 기본
      x: x || 50,
      y: y || 50,
      width: width || 400,
      height: height || 100,
      opacity: 1
    };

    const success = session.getTimelineManager().addItemToTrack(textTrack.id, textItem);
    if (success) session.markDirty();
    
    return { success, mediaItem: textItem, track: textTrack };
  }

  private handleGetTimeline(params: RequestParams): ResponseResult {
    const { sessionId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    return {
      tracks: session.getTimelineManager().getTracks(),
      currentFrame: session.getTimelineManager().getCurrentFrame(),
      totalDuration: session.getTimelineManager().getTotalDuration()
    };
  }

  // === 에이전트 협업 구현 ===

  private handleAgentRegister(params: RequestParams): ResponseResult {
    const { sessionId, agentId, agentType } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    session.registerAgent(agentType!, agentId!);
    return { success: true, message: `Agent ${agentId} registered as ${agentType}` };
  }

  private handleSubmitAsset(params: RequestParams): ResponseResult {
    const { sessionId, asset } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    session.addGeneratedAsset(asset!);
    return { success: true, message: `Asset ${asset!.id} received` };
  }

  private handleSubmitDirectives(params: RequestParams): ResponseResult {
    const { sessionId, directives } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    session.addDirectives(directives!);
    return { 
      success: true, 
      message: `${directives!.length} directives received`,
      editingStatus: session.getEditingStatus()
    };
  }

  private handleGetStatus(params: RequestParams): ResponseResult {
    const { sessionId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    return { editingStatus: session.getEditingStatus() };
  }

  private async handleExecuteNext(params: RequestParams): Promise<ResponseResult> {
    const { sessionId } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const directive = session.getNextDirective();
    if (!directive) {
      return { success: false, message: 'No pending directives' };
    }

    try {
      await this.executeDirective(session, directive);
      session.markDirectiveCompleted(directive.id);
      return { 
        success: true, 
        message: `Directive ${directive.id} completed: ${directive.description}`,
        editingStatus: session.getEditingStatus()
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to execute directive: ${error}` 
      };
    }
  }

  // 지시사항 실행
  private async executeDirective(session: EditingSession, directive: EditingDirective): Promise<void> {
    const { type, parameters } = directive;

    switch (type) {
      case 'cut_sequence':
        // 구간 자르기
        await this.executeCutSequence(session, parameters);
        break;
      
      case 'add_bgm':
        // 배경음악 추가
        await this.executeAddBGM(session, parameters);
        break;
      
      case 'add_sfx':
        // 효과음 추가
        await this.executeAddSFX(session, parameters);
        break;
      
      case 'add_text':
        // 텍스트 추가
        await this.executeAddText(session, parameters);
        break;
      
      case 'add_transition':
        // 트랜지션 추가
        await this.executeAddTransition(session, parameters);
        break;
      
      case 'apply_effect':
        // 효과 적용
        await this.executeApplyEffect(session, parameters);
        break;
    }
  }

  private async executeCutSequence(session: EditingSession, params: any): Promise<void> {
    // 기본 편집 도구 조합으로 구간 자르기 구현
    // trim_clip, split_clip, delete_clip 등을 조합
  }

  private async executeAddBGM(session: EditingSession, params: any): Promise<void> {
    // 생성된 BGM 에셋을 오디오 트랙에 추가
    if (params.asset) {
      // BGM 트랙 생성 또는 찾기
      let bgmTrack = session.getTimelineManager().getTracks().find(t => t.name.includes('BGM'));
      if (!bgmTrack) {
        bgmTrack = session.getTimelineManager().createTrack('Background Music', 'audio');
      }
      
      // 에셋을 미디어 파일로 등록하고 트랙에 추가하는 로직
    }
  }

  private async executeAddSFX(session: EditingSession, params: any): Promise<void> {
    // 효과음 추가 로직
  }

  private async executeAddText(session: EditingSession, params: any): Promise<void> {
    // 텍스트 오버레이 추가 로직
  }

  private async executeAddTransition(session: EditingSession, params: any): Promise<void> {
    // 트랜지션 효과 추가 로직
  }

  private async executeApplyEffect(session: EditingSession, params: any): Promise<void> {
    // 비주얼 효과 적용 로직
  }

  private handleExport(params: RequestParams): ResponseResult {
    const { sessionId, format, quality } = params;
    const session = this.getSession(sessionId!);
    if (!session) throw new Error('Session not found');

    const exportId = this.generateId();
    // 실제 렌더링 로직은 별도 구현
    
    return { exportId, status: 'queued', message: 'Export started' };
  }

  // 유틸리티 메서드들
  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36) + random(null).toString(36).substr(2);
  }

  private generateId(): string {
    return Date.now().toString(36) + random(null).toString(36).substr(2);
  }

  private generateTextDataURL(text: string, style: any): string {
    // Canvas API로 텍스트 이미지 생성 (실제 구현 필요)
    return `data:image/png;base64,generated_text_${Date.now()}`;
  }
}

// MCP 클라이언트 - 간단한 편집 도구 + 에이전트 협업
export class MCPClient {
  private serverUrl: string;
  private sessionId?: string;
  private agentId?: string;
  private agentType?: AgentType;

  constructor(serverUrl: string, agentId?: string, agentType?: AgentType) {
    this.serverUrl = serverUrl;
    this.agentId = agentId;
    this.agentType = agentType;
  }

  // === 세션 관리 ===
  async startSession(): Promise<void> {
    const response = await this.sendRequest('session.create', {});
    this.sessionId = response.sessionId;

    // 에이전트 등록
    if (this.agentId && this.agentType) {
      await this.sendRequest('agent.register', {
        sessionId: this.sessionId,
        agentId: this.agentId,
        agentType: this.agentType
      });
    }
  }

  // === 기본 편집 도구 ===
  async uploadMedia(fileData: ArrayBuffer, fileName: string, fileType: string): Promise<MediaFile> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('media.upload', {
      sessionId: this.sessionId,
      fileData,
      fileName,
      fileType
    });
    
    return response.mediaFile!;
  }

  async createTrack(name: string, type: 'video' | 'audio' | 'subtitle' | 'overlay'): Promise<Track> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.create_track', {
      sessionId: this.sessionId,
      name,
      type
    });
    
    return response.track!;
  }

  async addMediaToTrack(trackId: string, mediaId: string, options?: {
    startFrame?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
    scale?: number;
    rotation?: number;
  }): Promise<MediaItem> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.add_media', {
      sessionId: this.sessionId,
      trackId,
      mediaId,
      ...options
    });
    
    return response.mediaItem!;
  }

  async moveClip(trackId: string, itemId: string, newStartFrame: number, newTrackId?: string): Promise<boolean> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.move_clip', {
      sessionId: this.sessionId,
      trackId,
      itemId,
      newStartFrame,
      newTrackId
    });
    
    return response.success!;
  }

  async trimClip(trackId: string, itemId: string, startFrame?: number, endFrame?: number): Promise<boolean> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.trim_clip', {
      sessionId: this.sessionId,
      trackId,
      itemId,
      startFrame,
      endFrame
    });
    
    return response.success!;
  }

  async splitClip(trackId: string, itemId: string, splitFrame: number): Promise<boolean> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.split_clip', {
      sessionId: this.sessionId,
      trackId,
      itemId,
      splitFrame
    });
    
    return response.success!;
  }

  async deleteClip(trackId: string, itemId: string): Promise<boolean> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.delete_clip', {
      sessionId: this.sessionId,
      trackId,
      itemId
    });
    
    return response.success!;
  }

  async setClipProperties(trackId: string, itemId: string, properties: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
    scale?: number;
    rotation?: number;
  }): Promise<MediaItem> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.set_properties', {
      sessionId: this.sessionId,
      trackId,
      itemId,
      ...properties
    });
    
    return response.mediaItem!;
  }

  async addText(text: string, options?: {
    startFrame?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
  }): Promise<{ mediaItem: MediaItem; track: Track }> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.add_text', {
      sessionId: this.sessionId,
      text,
      ...options
    });
    
    return { mediaItem: response.mediaItem!, track: response.track! };
  }

  async getTimeline(): Promise<{ tracks: Track[]; currentFrame: number; totalDuration: number }> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('edit.get_timeline', {
      sessionId: this.sessionId
    });
    
    return {
      tracks: response.tracks!,
      currentFrame: response.currentFrame!,
      totalDuration: response.totalDuration!
    };
  }

  // === 에이전트 협업 ===
  async submitAsset(asset: GeneratedAsset): Promise<boolean> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('agent.submit_asset', {
      sessionId: this.sessionId,
      asset
    });
    
    return response.success!;
  }

  async submitDirectives(directives: EditingDirective[]): Promise<EditingStatus> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('agent.submit_directives', {
      sessionId: this.sessionId,
      directives
    });
    
    return response.editingStatus!;
  }

  async getEditingStatus(): Promise<EditingStatus> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('agent.get_status', {
      sessionId: this.sessionId
    });
    
    return response.editingStatus!;
  }

  async executeNextDirective(): Promise<{ success: boolean; message: string; status?: EditingStatus }> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('agent.execute_next', {
      sessionId: this.sessionId
    });
    
    return {
      success: response.success!,
      message: response.message!,
      status: response.editingStatus
    };
  }

  // === 기본 렌더링 ===
  async exportVideo(format?: string, quality?: string): Promise<string> {
    if (!this.sessionId) throw new Error('Session not started');
    
    const response = await this.sendRequest('render.export', {
      sessionId: this.sessionId,
      format,
      quality
    });
    
    return response.exportId!;
  }

  // === 헬퍼 메서드들 ===

  // 자동 침묵 제거 (기본 도구 조합)
  async autoRemoveSilence(audioTrackId: string, silenceThreshold: number = -40): Promise<void> {
    // 이 메서드는 기본 편집 도구들을 조합해서 구현
    const timeline = await this.getTimeline();
    const audioTrack = timeline.tracks.find(t => t.id === audioTrackId);
    
    if (!audioTrack) throw new Error('Audio track not found');
    
    // 침묵 구간 분석 후 split, delete, move 조합으로 처리
    // 실제 구현에서는 Web Audio API나 별도 분석 도구 사용
  }

  // 자동 하이라이트 생성 (기본 도구 조합) 
  async createHighlights(videoTrackId: string, highlightDuration: number = 5): Promise<string> {
    // 기본 편집 도구들을 조합해서 하이라이트 트랙 생성
    const highlightTrack = await this.createTrack('Auto Highlights', 'video');
    
    // split, copy, move 등의 기본 도구 조합으로 하이라이트 생성
    return highlightTrack.id;
  }

  // 내부 메서드
  private async sendRequest(method: string, params: RequestParams): Promise<ResponseResult> {
    const request: MCPRequest = {
      id: this.generateId(),
      method,
      params
    };

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const mcpResponse: MCPResponse = await response.json();
    
    if (mcpResponse.error) {
      throw new Error(mcpResponse.error.message);
    }
    
    return mcpResponse.result!;
  }

  private generateId(): string {
    return Date.now().toString(36) + random(null).toString(36).substr(2);
  }
} 