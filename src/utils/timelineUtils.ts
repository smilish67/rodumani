// 타임라인 편집 유틸리티
import { random } from 'remotion';
import { MediaItem } from '../Composition';

// 트랙 타입
export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle';
  items: MediaItem[];
  isLocked: boolean;
  isVisible: boolean;
  volume?: number;
}

// 편집 작업 파라미터 타입
interface EditOperationParameters {
  action?: string;
  item?: MediaItem;
  oldStartFrame?: number;
  newStartFrame?: number;
  oldTrackId?: string;
  newTrackId?: string;
  oldDuration?: number;
  newDuration?: number;
  trimStart?: number;
  trimEnd?: number;
  splitFrame?: number;
  secondPartId?: string;
}

// 편집 작업 타입
export interface EditOperation {
  id: string;
  type: 'cut' | 'trim' | 'move' | 'copy' | 'delete' | 'split';
  trackId: string;
  itemId: string;
  timestamp: number;
  parameters: EditOperationParameters;
}

// 키프레임 타입
export interface Keyframe {
  frame: number;
  property: string;
  value: number | string;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// 타임라인 내보내기 데이터 타입
interface TimelineExportData {
  tracks: Track[];
  currentFrame: number;
  totalDuration: number;
  fps: number;
}

// 타임라인 관리 클래스
export class TimelineManager {
  private tracks: Map<string, Track> = new Map();
  private currentFrame: number = 0;
  private totalDuration: number = 0;
  private fps: number = 30;
  private undoStack: EditOperation[] = [];
  private redoStack: EditOperation[] = [];

  constructor(fps: number = 30) {
    this.fps = fps;
  }

  // 트랙 생성
  createTrack(name: string, type: 'video' | 'audio' | 'subtitle'): Track {
    const track: Track = {
      id: this.generateId(),
      name,
      type,
      items: [],
      isLocked: false,
      isVisible: true,
      volume: type === 'audio' ? 1 : undefined
    };

    this.tracks.set(track.id, track);
    return track;
  }

  // 트랙 삭제
  deleteTrack(trackId: string): boolean {
    return this.tracks.delete(trackId);
  }

  // 트랙 목록 조회
  getTracks(): Track[] {
    return Array.from(this.tracks.values());
  }

  // 특정 트랙 조회
  getTrack(trackId: string): Track | undefined {
    return this.tracks.get(trackId);
  }

  // 미디어 아이템을 트랙에 추가
  addItemToTrack(trackId: string, item: MediaItem, insertFrame?: number): boolean {
    const track = this.tracks.get(trackId);
    if (!track || track.isLocked) return false;

    // 삽입 위치 계산
    if (insertFrame !== undefined) {
      item.startFrame = insertFrame;
    }

    // 겹침 검사 및 해결
    this.resolveOverlaps(track, item);

    track.items.push(item);
    this.updateTotalDuration();
    
    // 실행 취소를 위한 작업 기록
    this.recordOperation({
      id: this.generateId(),
      type: 'move',
      trackId,
      itemId: item.id,
      timestamp: Date.now(),
      parameters: { action: 'add', item }
    });

    return true;
  }

  // 미디어 아이템 삭제
  removeItemFromTrack(trackId: string, itemId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track || track.isLocked) return false;

    const itemIndex = track.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    const removedItem = track.items.splice(itemIndex, 1)[0];
    this.updateTotalDuration();

    // 실행 취소를 위한 작업 기록
    this.recordOperation({
      id: this.generateId(),
      type: 'delete',
      trackId,
      itemId,
      timestamp: Date.now(),
      parameters: { action: 'remove', item: removedItem }
    });

    return true;
  }

  // 아이템 이동
  moveItem(trackId: string, itemId: string, newStartFrame: number, newTrackId?: string): boolean {
    const sourceTrack = this.tracks.get(trackId);
    if (!sourceTrack || sourceTrack.isLocked) return false;

    const itemIndex = sourceTrack.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    const item = sourceTrack.items[itemIndex];
    const oldStartFrame = item.startFrame;

    // 같은 트랙 내에서 이동
    if (!newTrackId || newTrackId === trackId) {
      item.startFrame = newStartFrame;
      this.resolveOverlaps(sourceTrack, item);
    } else {
      // 다른 트랙으로 이동
      const targetTrack = this.tracks.get(newTrackId);
      if (!targetTrack || targetTrack.isLocked) return false;

      sourceTrack.items.splice(itemIndex, 1);
      item.startFrame = newStartFrame;
      this.resolveOverlaps(targetTrack, item);
      targetTrack.items.push(item);
    }

    this.updateTotalDuration();

    // 실행 취소를 위한 작업 기록
    this.recordOperation({
      id: this.generateId(),
      type: 'move',
      trackId,
      itemId,
      timestamp: Date.now(),
      parameters: { 
        oldStartFrame, 
        newStartFrame, 
        oldTrackId: trackId, 
        newTrackId: newTrackId || trackId 
      }
    });

    return true;
  }

  // 아이템 트림 (시작/끝 시간 조정)
  trimItem(trackId: string, itemId: string, trimStart?: number, trimEnd?: number): boolean {
    const track = this.tracks.get(trackId);
    if (!track || track.isLocked) return false;

    const item = track.items.find(item => item.id === itemId);
    if (!item) return false;

    const oldDuration = item.durationInFrames;
    
    if (trimStart !== undefined) {
      const trimAmount = trimStart - item.startFrame;
      item.startFrame = trimStart;
      item.durationInFrames = Math.max(1, item.durationInFrames - trimAmount);
    }
    
    if (trimEnd !== undefined) {
      const newDuration = trimEnd - item.startFrame;
      item.durationInFrames = Math.max(1, newDuration);
    }

    this.updateTotalDuration();

    // 실행 취소를 위한 작업 기록
    this.recordOperation({
      id: this.generateId(),
      type: 'trim',
      trackId,
      itemId,
      timestamp: Date.now(),
      parameters: { oldDuration, newDuration: item.durationInFrames, trimStart, trimEnd }
    });

    return true;
  }

  // 아이템 분할
  splitItem(trackId: string, itemId: string, splitFrame: number): boolean {
    const track = this.tracks.get(trackId);
    if (!track || track.isLocked) return false;

    const item = track.items.find(item => item.id === itemId);
    if (!item) return false;

    const relativeFrame = splitFrame - item.startFrame;
    if (relativeFrame <= 0 || relativeFrame >= item.durationInFrames) return false;

    // 두 번째 파트 생성
    const secondPart: MediaItem = {
      ...item,
      id: this.generateId(),
      startFrame: splitFrame,
      durationInFrames: item.durationInFrames - relativeFrame
    };

    // 첫 번째 파트 수정
    item.durationInFrames = relativeFrame;

    // 두 번째 파트 추가
    track.items.push(secondPart);

    // 실행 취소를 위한 작업 기록
    this.recordOperation({
      id: this.generateId(),
      type: 'split',
      trackId,
      itemId,
      timestamp: Date.now(),
      parameters: { splitFrame, secondPartId: secondPart.id }
    });

    return true;
  }

  // 겹침 해결
  private resolveOverlaps(track: Track, newItem: MediaItem): void {
    const newItemEnd = newItem.startFrame + newItem.durationInFrames;
    
    track.items.forEach(item => {
      if (item.id === newItem.id) return;
      
      const itemEnd = item.startFrame + item.durationInFrames;
      
      // 겹침 검사
      if (!(newItemEnd <= item.startFrame || newItem.startFrame >= itemEnd)) {
        // 기존 아이템을 뒤로 밀기
        if (newItem.startFrame < item.startFrame) {
          item.startFrame = newItemEnd;
        } else {
          // 기존 아이템 트림
          item.durationInFrames = Math.max(1, newItem.startFrame - item.startFrame);
        }
      }
    });
  }

  // 전체 지속 시간 업데이트
  private updateTotalDuration(): void {
    let maxDuration = 0;
    
    this.tracks.forEach(track => {
      track.items.forEach(item => {
        const itemEnd = item.startFrame + item.durationInFrames;
        maxDuration = Math.max(maxDuration, itemEnd);
      });
    });
    
    this.totalDuration = maxDuration;
  }

  // 현재 프레임 설정
  setCurrentFrame(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalDuration));
  }

  // 현재 프레임 조회
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  // 전체 지속 시간 조회
  getTotalDuration(): number {
    return this.totalDuration;
  }

  // 현재 프레임에서 활성 아이템들 조회
  getActiveItems(): MediaItem[] {
    const activeItems: MediaItem[] = [];
    
    this.tracks.forEach(track => {
      if (!track.isVisible) return;
      
      track.items.forEach(item => {
        if (this.currentFrame >= item.startFrame && 
            this.currentFrame < item.startFrame + item.durationInFrames) {
          activeItems.push(item);
        }
      });
    });
    
    return activeItems;
  }

  // 작업 기록 (실행 취소/다시 실행용)
  private recordOperation(operation: EditOperation): void {
    this.undoStack.push(operation);
    this.redoStack = []; // 새 작업 시 다시 실행 스택 초기화
    
    // 스택 크기 제한
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }

  // 실행 취소
  undo(): boolean {
    const operation = this.undoStack.pop();
    if (!operation) return false;

    // 작업 타입에 따른 역방향 실행
    this.executeReverseOperation(operation);
    this.redoStack.push(operation);
    
    return true;
  }

  // 다시 실행
  redo(): boolean {
    const operation = this.redoStack.pop();
    if (!operation) return false;

    // 작업 재실행
    this.executeOperation(operation);
    this.undoStack.push(operation);
    
    return true;
  }

  // 작업 실행
  private executeOperation(operation: EditOperation): void {
    // 실제 구현에서는 각 작업 타입에 맞는 실행 로직 구현
    console.log('Executing operation:', operation);
  }

  // 역방향 작업 실행
  private executeReverseOperation(operation: EditOperation): void {
    // 실제 구현에서는 각 작업 타입에 맞는 역방향 실행 로직 구현
    console.log('Executing reverse operation:', operation);
  }

  // ID 생성 (Remotion의 deterministic random 사용)
  private generateId(): string {
    return Date.now().toString(36) + random(null).toString(36).substr(2);
  }

  // 타임라인 데이터 내보내기
  export(): TimelineExportData {
    return {
      tracks: Array.from(this.tracks.values()),
      currentFrame: this.currentFrame,
      totalDuration: this.totalDuration,
      fps: this.fps
    };
  }

  // 타임라인 데이터 가져오기
  import(data: TimelineExportData): void {
    this.tracks.clear();
    
    if (data.tracks) {
      data.tracks.forEach((track: Track) => {
        this.tracks.set(track.id, track);
      });
    }
    
    this.currentFrame = data.currentFrame || 0;
    this.totalDuration = data.totalDuration || 0;
    this.fps = data.fps || 30;
  }
}

// 키프레임 애니메이션 관리
export class KeyframeManager {
  private keyframes: Map<string, Keyframe[]> = new Map();

  // 키프레임 추가
  addKeyframe(itemId: string, keyframe: Keyframe): void {
    if (!this.keyframes.has(itemId)) {
      this.keyframes.set(itemId, []);
    }
    
    const keyframes = this.keyframes.get(itemId)!;
    keyframes.push(keyframe);
    keyframes.sort((a, b) => a.frame - b.frame);
  }

  // 키프레임 삭제
  removeKeyframe(itemId: string, frame: number, property: string): boolean {
    const keyframes = this.keyframes.get(itemId);
    if (!keyframes) return false;

    const index = keyframes.findIndex(kf => kf.frame === frame && kf.property === property);
    if (index === -1) return false;

    keyframes.splice(index, 1);
    return true;
  }

  // 특정 프레임에서의 값 계산
  getValue(itemId: string, frame: number, property: string): number | string | undefined {
    const keyframes = this.keyframes.get(itemId);
    if (!keyframes) return undefined;

    const propertyKeyframes = keyframes.filter(kf => kf.property === property);
    if (propertyKeyframes.length === 0) return undefined;

    // 정확한 키프레임 찾기
    const exactKeyframe = propertyKeyframes.find(kf => kf.frame === frame);
    if (exactKeyframe) return exactKeyframe.value;

    // 보간 계산
    const beforeKeyframes = propertyKeyframes.filter(kf => kf.frame < frame);
    const afterKeyframes = propertyKeyframes.filter(kf => kf.frame > frame);

    if (beforeKeyframes.length === 0) return afterKeyframes[0]?.value;
    if (afterKeyframes.length === 0) return beforeKeyframes[beforeKeyframes.length - 1]?.value;

    const before = beforeKeyframes[beforeKeyframes.length - 1];
    const after = afterKeyframes[0];

    // 선형 보간
    const progress = (frame - before.frame) / (after.frame - before.frame);
    return this.interpolate(before.value, after.value, progress, before.easing || 'linear');
  }

  // 값 보간
  private interpolate(start: number | string, end: number | string, progress: number, easing: string): number | string {
    // 이징 함수 적용
    const easedProgress = this.applyEasing(progress, easing);

    // 타입별 보간
    if (typeof start === 'number' && typeof end === 'number') {
      return start + (end - start) * easedProgress;
    }

    // 기본적으로 선형 보간
    return typeof start === 'number' && typeof end === 'number' 
      ? start + (end - start) * easedProgress 
      : start;
  }

  // 이징 함수
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t; // linear
    }
  }
} 