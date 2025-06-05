// 미디어 파일 처리 유틸리티
import { random } from 'remotion';

export interface MediaMetadata {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}

export interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio' | 'image';
  metadata: MediaMetadata;
  thumbnail?: string;
}

// 미디어 파일 업로드 및 처리
export class MediaFileManager {
  private mediaFiles: Map<string, MediaFile> = new Map();
  private uploadPath: string;

  constructor(uploadPath: string = './public/uploads') {
    this.uploadPath = uploadPath;
  }

  // 파일 업로드 처리
  async uploadFile(file: File): Promise<MediaFile> {
    const fileId = this.generateId();
    const fileName = `${fileId}_${file.name}`;
    
    // 파일 타입 감지
    const mediaType = this.detectMediaType(file.type);
    
    // 메타데이터 추출
    const metadata = await this.extractMetadata(file);
    
    // 썸네일 생성 (비디오/이미지)
    const thumbnail = await this.generateThumbnail(file, mediaType);
    
    const mediaFile: MediaFile = {
      id: fileId,
      name: file.name,
      url: fileName,
      type: mediaType,
      metadata,
      thumbnail
    };
    
    this.mediaFiles.set(fileId, mediaFile);
    return mediaFile;
  }

  // 미디어 파일 목록 조회
  getMediaFiles(): MediaFile[] {
    return Array.from(this.mediaFiles.values());
  }

  // 특정 미디어 파일 조회
  getMediaFile(id: string): MediaFile | undefined {
    return this.mediaFiles.get(id);
  }

  // 미디어 파일 삭제
  deleteMediaFile(id: string): boolean {
    return this.mediaFiles.delete(id);
  }

  // 파일 타입 감지
  private detectMediaType(mimeType: string): 'video' | 'audio' | 'image' {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    throw new Error(`Unsupported media type: ${mimeType}`);
  }

  // 메타데이터 추출
  private async extractMetadata(file: File): Promise<MediaMetadata> {
    const metadata: MediaMetadata = {
      fileSize: file.size,
      mimeType: file.type,
      createdAt: new Date()
    };

    if (file.type.startsWith('video/')) {
      const videoMetadata = await this.extractVideoMetadata(file);
      Object.assign(metadata, videoMetadata);
    } else if (file.type.startsWith('image/')) {
      const imageMetadata = await this.extractImageMetadata(file);
      Object.assign(metadata, imageMetadata);
    }

    return metadata;
  }

  // 비디오 메타데이터 추출
  private async extractVideoMetadata(file: File): Promise<Partial<MediaMetadata>> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          fps: 30 // 기본값, 실제 구현에서는 더 정확한 방법 필요
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  // 이미지 메타데이터 추출
  private async extractImageMetadata(file: File): Promise<Partial<MediaMetadata>> {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
        URL.revokeObjectURL(img.src);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // 썸네일 생성
  private async generateThumbnail(file: File, type: 'video' | 'audio' | 'image'): Promise<string | undefined> {
    if (type === 'image') {
      return URL.createObjectURL(file);
    }
    
    if (type === 'video') {
      return this.generateVideoThumbnail(file);
    }
    
    return undefined;
  }

  // 비디오 썸네일 생성
  private async generateVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        video.currentTime = 1; // 1초 지점의 프레임 캡처
      };
      
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnailUrl);
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  // ID 생성 (Remotion의 deterministic random 사용)
  private generateId(): string {
    return Date.now().toString(36) + random(null).toString(36).substr(2);
  }
}

// 미디어 변환 유틸리티
export class MediaConverter {
  // 파일 형식 변환
  static async convertFormat(_file: File, _targetFormat: string): Promise<Blob> {
    // 실제 구현에서는 FFmpeg.js 등을 사용
    throw new Error('Media conversion not implemented');
  }

  // 비디오 압축
  static async compressVideo(_file: File, _quality: number): Promise<Blob> {
    // 실제 구현에서는 FFmpeg.js 등을 사용
    throw new Error('Video compression not implemented');
  }

  // 오디오 추출
  static async extractAudio(_videoFile: File): Promise<Blob> {
    // 실제 구현에서는 FFmpeg.js 등을 사용
    throw new Error('Audio extraction not implemented');
  }
}

// 시간 유틸리티
export class TimeUtils {
  // 초를 프레임으로 변환
  static secondsToFrames(seconds: number, fps: number = 30): number {
    return Math.round(seconds * fps);
  }

  // 프레임을 초로 변환
  static framesToSeconds(frames: number, fps: number = 30): number {
    return frames / fps;
  }

  // 시간 포맷팅 (HH:MM:SS)
  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 프레임을 시간 포맷으로 변환
  static formatFrameTime(frame: number, fps: number = 30): string {
    return this.formatTime(this.framesToSeconds(frame, fps));
  }
} 