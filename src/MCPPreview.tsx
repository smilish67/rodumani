import { useEffect, useState } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from 'remotion';

// MCP 서버에서 가져온 편집 데이터 타입
interface MCPTimeline {
  tracks: Array<{
    id: string;
    name: string;
    type: 'video' | 'audio' | 'subtitle' | 'text';
    items: Array<{
      id: string;
      type: 'image' | 'video' | 'audio' | 'text';
      src: string;
      startFrame: number;
      durationInFrames: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      opacity?: number;
      scale?: number;
      rotation?: number;
    }>;
  }>;
  currentFrame: number;
  totalDuration: number;
}

interface MCPPreviewProps {
  sessionId: string;
}

export const MCPPreview: React.FC<MCPPreviewProps> = ({ sessionId }) => {
  const [timeline, setTimeline] = useState<MCPTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const frame = useCurrentFrame();

  // MCP 서버에서 타임라인 데이터 가져오기
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3000/sessions/${sessionId}/timeline`);
        const data = await response.json();
        
        if (data.result) {
          setTimeline(data.result);
        } else {
          setError('Failed to load timeline data');
        }
      } catch (err) {
        setError(`Error fetching timeline: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
    
    // 5초마다 타임라인 업데이트 (실시간 반영)
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading) {
    return (
      <AbsoluteFill style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        color: '#fff',
        fontSize: 24
      }}>
        MCP 타임라인 로딩 중... 🎬
      </AbsoluteFill>
    );
  }

  if (error) {
    return (
      <AbsoluteFill style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        color: '#ff4444',
        fontSize: 20,
        flexDirection: 'column',
        gap: 16
      }}>
        <div>❌ 오류 발생</div>
        <div style={{ fontSize: 16 }}>{error}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          MCP 서버가 실행 중인지 확인해주세요
        </div>
      </AbsoluteFill>
    );
  }

  if (!timeline || timeline.tracks.length === 0) {
    return (
      <AbsoluteFill style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        color: '#fff',
        fontSize: 20,
        flexDirection: 'column',
        gap: 16
      }}>
        <div>📋 빈 타임라인</div>
        <div style={{ fontSize: 16, opacity: 0.7 }}>
          세션 ID: {sessionId}
        </div>
        <div style={{ fontSize: 14, opacity: 0.5 }}>
          MCP 서버에 편집 지시사항을 보내보세요
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 타임라인의 각 트랙 렌더링 */}
      {timeline.tracks.map((track) => (
        <div key={track.id}>
          {/* 트랙의 각 아이템 렌더링 */}
          {track.items.map((item) => {
            // 현재 프레임이 아이템의 재생 범위 내에 있는지 확인
            const isVisible = frame >= item.startFrame && 
                             frame < item.startFrame + item.durationInFrames;
            
            if (!isVisible) return null;

            // 아이템 내에서의 상대적 프레임
            const relativeFrame = frame - item.startFrame;
            const progress = relativeFrame / item.durationInFrames;

            // 애니메이션 효과 (페이드 인/아웃)
            const opacity = interpolate(
              progress,
              [0, 0.1, 0.9, 1],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            ) * (item.opacity || 1);

            const transform = `
              translate(${item.x || 0}px, ${item.y || 0}px)
              scale(${item.scale || 1})
              rotate(${item.rotation || 0}deg)
            `;

            return (
              <Sequence
                key={item.id}
                from={item.startFrame}
                durationInFrames={item.durationInFrames}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: item.width || 'auto',
                    height: item.height || 'auto',
                    opacity,
                    transform,
                    transformOrigin: 'center'
                  }}
                >
                  {item.type === 'text' ? (
                    // 텍스트 렌더링
                    <div style={{
                      color: '#ffffff',
                      fontSize: 36,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      padding: 16,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 8,
                      border: '2px solid rgba(255,255,255,0.3)',
                      whiteSpace: 'nowrap'
                    }}>
                      {(item as any).text || 'MCP 텍스트'}
                    </div>
                  ) : item.type === 'image' && item.src.startsWith('data:image') ? (
                    // 텍스트 오버레이 (MCP에서 생성된 텍스트 이미지)
                    <div style={{
                      color: '#fff',
                      fontSize: 24,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      padding: 16,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: 8
                    }}>
                      {/* 실제 구현에서는 텍스트 내용을 파싱해야 함 */}
                      MCP 텍스트 오버레이
                    </div>
                  ) : item.type === 'image' ? (
                    <img 
                      src={item.src} 
                      alt="MCP Media" 
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'contain'
                      }} 
                    />
                  ) : item.type === 'video' ? (
                    <video 
                      src={item.src}
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'contain'
                      }}
                      muted
                    />
                  ) : null}
                </div>
              </Sequence>
            );
          })}
        </div>
      ))}

      {/* 디버그 정보 */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        color: '#fff',
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 8,
        borderRadius: 4,
        fontFamily: 'monospace'
      }}>
        <div>Frame: {frame}</div>
        <div>Session: {sessionId}</div>
        <div>Tracks: {timeline.tracks.length}</div>
        <div>Duration: {timeline.totalDuration}f</div>
      </div>
    </AbsoluteFill>
  );
};

// 실제 편집 데이터를 시연하기 위한 데모 컴포넌트
export const MCPDemo: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      {/* 인사 텍스트 1 */}
      <Sequence from={0} durationInFrames={90}>
        <div style={{
          position: 'absolute',
          top: 100,
          left: 50,
          color: '#ffffff',
          fontSize: 36,
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          opacity: interpolate(frame, [0, 30, 60, 90], [0, 1, 1, 0])
        }}>
          안녕하세요! MCP 비디오 편집 시스템입니다 👋
        </div>
      </Sequence>

      {/* 환영 텍스트 2 */}
      <Sequence from={90} durationInFrames={90}>
        <div style={{
          position: 'absolute',
          top: 200,
          left: 50,
          color: '#00ff88',
          fontSize: 28,
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          opacity: interpolate(frame - 90, [0, 30, 60, 90], [0, 1, 1, 0])
        }}>
          환영합니다! 🎥✨
        </div>
      </Sequence>

      {/* 배경 애니메이션 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: `linear-gradient(45deg, 
          rgba(66, 165, 245, 0.1) ${Math.sin(frame * 0.02) * 50 + 50}%, 
          rgba(76, 175, 80, 0.1) ${Math.cos(frame * 0.03) * 50 + 50}%
        )`,
        opacity: 0.3
      }} />

      {/* 진행 바 */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: 50,
        right: 50,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2
      }}>
        <div style={{
          width: `${(frame / 180) * 100}%`,
          height: '100%',
          backgroundColor: '#00ff88',
          borderRadius: 2,
          transition: 'width 0.1s ease'
        }} />
      </div>
    </AbsoluteFill>
  );
}; 