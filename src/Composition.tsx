import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Audio,
  Video,
  Img,
  AbsoluteFill,
  staticFile,
} from 'remotion';

// 미디어 아이템 타입 정의
export interface MediaItem {
  id: string;
  type: 'video' | 'audio' | 'image';
  src: string;
  startFrame: number;
  durationInFrames: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  scale?: number;
  rotation?: number;
}

// 타임라인 컨트롤 타입
interface TimelineControl {
  trimStart: number;
  trimEnd: number;
  playbackRate: number;
  volume?: number;
}

// 편집 컴포지션 props
interface EditorCompositionProps {
  mediaItems?: MediaItem[];
  timelineControls?: { [key: string]: TimelineControl };
}

// 미디어 렌더링 컴포넌트
const MediaRenderer: React.FC<{
  item: MediaItem;
  controls?: TimelineControl;
}> = ({ item, controls }) => {
  const frame = useCurrentFrame();
  
  // 시간 조정 로직
  const trimStart = controls?.trimStart || 0;
  const trimEnd = controls?.trimEnd || item.durationInFrames;
  const playbackRate = controls?.playbackRate || 1;
  const volume = controls?.volume || 1;
  
  // 현재 프레임이 아이템의 재생 범위 내에 있는지 확인
  const isVisible = frame >= item.startFrame && frame < item.startFrame + (trimEnd - trimStart);
  
  if (!isVisible) return null;
  
  // 위치 및 스타일 계산
  const transform = `
    translate(${item.x}px, ${item.y}px) 
    scale(${item.scale || 1}) 
    rotate(${item.rotation || 0}deg)
  `;
  
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: item.width,
    height: item.height,
    opacity: item.opacity || 1,
    transform,
    transformOrigin: 'center',
  };
  
  // 미디어 타입별 렌더링
  switch (item.type) {
    case 'video':
      return (
        <Video
          src={staticFile(item.src)}
          style={style}
          startFrom={trimStart}
          endAt={trimEnd}
          playbackRate={playbackRate}
          volume={(f) => interpolate(f, [0, 30], [volume, volume])}
        />
      );
    
    case 'audio':
      return (
        <Audio
          src={staticFile(item.src)}
          startFrom={trimStart}
          endAt={trimEnd}
          playbackRate={playbackRate}
          volume={(f) => interpolate(f, [0, 30], [volume, volume])}
        />
      );
    
    case 'image':
      return (
        <Img
          src={staticFile(item.src)}
          style={style}
        />
      );
    
    default:
      return null;
  }
};

// 트랜지션 효과 컴포넌트
const TransitionEffect: React.FC<{
  startFrame: number;
  durationInFrames: number;
  type: 'fadeIn' | 'fadeOut' | 'slideIn' | 'slideOut';
  children: React.ReactNode;
}> = ({ startFrame, durationInFrames, type, children }) => {
  const frame = useCurrentFrame();
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / durationInFrames));
  
  let opacity = 1;
  let transform = '';
  
  switch (type) {
    case 'fadeIn':
      opacity = interpolate(progress, [0, 1], [0, 1]);
      break;
    case 'fadeOut':
      opacity = interpolate(progress, [0, 1], [1, 0]);
      break;
    case 'slideIn':
      transform = `translateX(${interpolate(progress, [0, 1], [-100, 0])}px)`;
      break;
    case 'slideOut':
      transform = `translateX(${interpolate(progress, [0, 1], [0, 100])}px)`;
      break;
  }
  
  return (
    <div style={{ opacity, transform }}>
      {children}
    </div>
  );
};

// 메인 편집 컴포지션
export const MyComposition: React.FC<EditorCompositionProps> = ({
  mediaItems = [],
  timelineControls = {}
}) => {
  const frame = useCurrentFrame();
  
  // 미디어 아이템이 없는 경우 빈 상태 표시
  if (mediaItems.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <AbsoluteFill style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          color: 'white',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>
            No Media Items
          </div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>
            Upload files and add them to the timeline to get started
          </div>
          <div style={{ fontSize: 14, marginTop: 20, opacity: 0.5 }}>
            Frame: {frame} | Time: {(frame / 30).toFixed(2)}s
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 배경 레이어 */}
      <AbsoluteFill>
        {mediaItems
          .filter(item => item.type === 'image' && item.id.includes('background'))
          .map(item => (
            <MediaRenderer
              key={item.id}
              item={item}
              controls={timelineControls[item.id]}
            />
          ))}
      </AbsoluteFill>
      
      {/* 비디오 및 메인 컨텐츠 레이어 */}
      <AbsoluteFill>
        {mediaItems
          .filter(item => item.type === 'video')
          .map(item => (
            <Sequence
              key={item.id}
              from={item.startFrame}
              durationInFrames={item.durationInFrames}
            >
              <TransitionEffect
                startFrame={0}
                durationInFrames={15}
                type="fadeIn"
              >
                <MediaRenderer
                  item={item}
                  controls={timelineControls[item.id]}
                />
              </TransitionEffect>
            </Sequence>
          ))}
      </AbsoluteFill>
      
      {/* 오버레이 및 UI 요소 레이어 */}
      <AbsoluteFill>
        {mediaItems
          .filter(item => item.type === 'image' && !item.id.includes('background'))
          .map(item => (
            <Sequence
              key={item.id}
              from={item.startFrame}
              durationInFrames={item.durationInFrames}
            >
              <MediaRenderer
                item={item}
                controls={timelineControls[item.id]}
              />
            </Sequence>
          ))}
      </AbsoluteFill>
      
      {/* 오디오 레이어 */}
      {mediaItems
        .filter(item => item.type === 'audio')
        .map(item => (
          <Sequence
            key={item.id}
            from={item.startFrame}
            durationInFrames={item.durationInFrames}
          >
            <MediaRenderer
              item={item}
              controls={timelineControls[item.id]}
            />
          </Sequence>
        ))}
      
      {/* 타임라인 인디케이터 (개발용) */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          color: 'white',
          fontFamily: 'Arial',
          fontSize: 16,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
        }}>
          Frame: {frame} | Time: {(frame / 30).toFixed(2)}s
        </div>
        {mediaItems.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 35,
            left: 10,
            color: 'white',
            fontFamily: 'Arial',
            fontSize: 12,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            opacity: 0.7
          }}>
            {mediaItems.length} media item(s) loaded
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
