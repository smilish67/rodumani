// 비디오 편집 데모 컴포넌트

import React, { useState, useEffect } from 'react';
import { MyComposition, MediaItem } from '../Composition';
import { MediaFileManager, MediaFile } from '../utils/mediaUtils';
import { TimelineManager, Track } from '../utils/timelineUtils';
import { MCPVideoEditingServer, MCPClient } from '../api/mcpInterface';

interface EditorDemoProps {
  width?: number;
  height?: number;
  fps?: number;
}

export const EditorDemo: React.FC<EditorDemoProps> = ({
  width = 1280,
  height = 720,
  fps = 30
}) => {
  // 상태 관리
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [mediaManager] = useState(() => new MediaFileManager());
  const [timelineManager] = useState(() => new TimelineManager(fps));
  const [mcpServer] = useState(() => new MCPVideoEditingServer());
  const [sessionId, setSessionId] = useState<string>('');

  // 컴포지션 데이터
  const [compositionData, setCompositionData] = useState<{
    mediaItems: MediaItem[];
    timelineControls: { [key: string]: any };
  }>({
    mediaItems: [],
    timelineControls: {}
  });

  // 초기화
  useEffect(() => {
    // 기본 트랙 생성
    const videoTrack = timelineManager.createTrack('Video Track', 'video');
    const audioTrack = timelineManager.createTrack('Audio Track', 'audio');
    
    setTracks([videoTrack, audioTrack]);

    // MCP 세션 생성
    const newSessionId = mcpServer.createSession();
    setSessionId(newSessionId);

    console.log('Editor initialized with session:', newSessionId);
  }, []);

  // 미디어 파일 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const mediaFile = await mediaManager.uploadFile(file);
        setMediaFiles(prev => [...prev, mediaFile]);
        console.log('Uploaded:', mediaFile.name);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  // 트랙에 미디어 추가
  const addToTrack = (mediaFile: MediaFile, trackId: string) => {
    const mediaItem: MediaItem = {
      id: Date.now().toString(),
      type: mediaFile.type,
      src: mediaFile.url,
      startFrame: currentFrame,
      durationInFrames: Math.floor((mediaFile.metadata.duration || 3) * fps),
      x: 0,
      y: 0,
      width: mediaFile.metadata.width || width,
      height: mediaFile.metadata.height || height,
      opacity: 1,
      scale: 1,
      rotation: 0
    };

    const success = timelineManager.addItemToTrack(trackId, mediaItem);
    if (success) {
      updateCompositionData();
      setTotalDuration(timelineManager.getTotalDuration());
      console.log('Added to track:', mediaFile.name);
    }
  };

  // 아이템 이동
  const moveItem = (trackId: string, itemId: string, newStartFrame: number) => {
    const success = timelineManager.moveItem(trackId, itemId, newStartFrame);
    if (success) {
      updateCompositionData();
      setTotalDuration(timelineManager.getTotalDuration());
    }
  };

  // 아이템 트림
  const trimItem = (trackId: string, itemId: string, trimStart?: number, trimEnd?: number) => {
    const success = timelineManager.trimItem(trackId, itemId, trimStart, trimEnd);
    if (success) {
      updateCompositionData();
      setTotalDuration(timelineManager.getTotalDuration());
    }
  };

  // 아이템 분할
  const splitItem = (trackId: string, itemId: string, splitFrame: number) => {
    const success = timelineManager.splitItem(trackId, itemId, splitFrame);
    if (success) {
      updateCompositionData();
      setTracks(timelineManager.getTracks());
    }
  };

  // 컴포지션 데이터 업데이트
  const updateCompositionData = () => {
    const allItems: MediaItem[] = [];
    const controls: { [key: string]: any } = {};

    timelineManager.getTracks().forEach(track => {
      track.items.forEach(item => {
        allItems.push(item);
        // 기본 컨트롤 설정
        controls[item.id] = {
          trimStart: 0,
          trimEnd: item.durationInFrames,
          playbackRate: 1,
          volume: track.volume || 1
        };
      });
    });

    setCompositionData({
      mediaItems: allItems,
      timelineControls: controls
    });
  };

  // 프레임 변경
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame);
    timelineManager.setCurrentFrame(frame);
  };

  // 실행 취소/다시 실행
  const handleUndo = () => {
    if (timelineManager.undo()) {
      updateCompositionData();
      setTracks(timelineManager.getTracks());
    }
  };

  const handleRedo = () => {
    if (timelineManager.redo()) {
      updateCompositionData();
      setTracks(timelineManager.getTracks());
    }
  };

  // MCP API 데모
  const testMCPAPI = async () => {
    try {
      // 세션 상태 조회
      const request = {
        id: 'test-' + Date.now(),
        method: 'timeline.get_state',
        params: { sessionId }
      };

      const response = await mcpServer.handleRequest(request);
      console.log('MCP Response:', response);
    } catch (error) {
      console.error('MCP API Error:', error);
    }
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h1>Remotion 영상편집 MCP 서버 데모</h1>
      
      {/* 컨트롤 패널 */}
      <div style={{ 
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2>편집 도구</h2>
        
        {/* 파일 업로드 */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="file-upload" style={{ 
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-block'
          }}>
            미디어 파일 업로드
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        {/* 편집 버튼들 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button onClick={handleUndo} style={buttonStyle}>
            실행 취소
          </button>
          <button onClick={handleRedo} style={buttonStyle}>
            다시 실행
          </button>
          <button onClick={testMCPAPI} style={buttonStyle}>
            MCP API 테스트
          </button>
        </div>

        {/* 타임라인 컨트롤 */}
        <div style={{ marginBottom: '15px' }}>
          <label>현재 프레임: {currentFrame} / {totalDuration}</label>
          <input
            type="range"
            min="0"
            max={totalDuration}
            value={currentFrame}
            onChange={(e) => handleFrameChange(parseInt(e.target.value))}
            style={{ width: '100%', marginTop: '5px' }}
          />
        </div>

        {/* 세션 정보 */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          Session ID: {sessionId}
        </div>
      </div>

      {/* 미디어 라이브러리 */}
      <div style={{ 
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3>미디어 라이브러리</h3>
        {mediaFiles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '2px dashed #ddd'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>
              📁 No media files uploaded yet
            </div>
            <div style={{ fontSize: '14px' }}>
              Click "미디어 파일 업로드" above to add video, audio, or image files
            </div>
            <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
              Supported formats: MP4, MOV, AVI, MP3, WAV, JPG, PNG
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px'
          }}>
            {mediaFiles.map(mediaFile => (
              <div key={mediaFile.id} style={{
                border: '1px solid #eee',
                borderRadius: '4px',
                padding: '10px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                  {mediaFile.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                  {mediaFile.type} | {(mediaFile.metadata.fileSize / 1024 / 1024).toFixed(2)}MB
                  {mediaFile.metadata.duration && ` | ${mediaFile.metadata.duration.toFixed(1)}s`}
                </div>
                {mediaFile.thumbnail && (
                  <img 
                    src={mediaFile.thumbnail} 
                    alt={mediaFile.name}
                    style={{ 
                      width: '100%', 
                      height: '80px', 
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}
                  />
                )}
                <div style={{ display: 'flex', gap: '5px' }}>
                  {tracks.map(track => (
                    <button
                      key={track.id}
                      onClick={() => addToTrack(mediaFile, track.id)}
                      style={{
                        ...buttonStyle,
                        fontSize: '11px',
                        padding: '5px 8px'
                      }}
                    >
                      {track.name}에 추가
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 타임라인 */}
      <div style={{ 
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3>타임라인</h3>
        {tracks.map(track => (
          <div key={track.id} style={{
            border: '1px solid #eee',
            marginBottom: '10px',
            borderRadius: '4px'
          }}>
            <div style={{
              backgroundColor: '#f8f8f8',
              padding: '10px',
              fontWeight: 'bold',
              borderBottom: '1px solid #eee'
            }}>
              {track.name} ({track.type})
            </div>
            <div style={{
              padding: '10px',
              minHeight: '60px',
              position: 'relative',
              backgroundColor: track.isVisible ? '#fff' : '#f0f0f0'
            }}>
              {track.items.map(item => {
                const left = (item.startFrame / totalDuration) * 100;
                const width = (item.durationInFrames / totalDuration) * 100;
                
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '40px',
                      backgroundColor: getItemColor(item.type),
                      border: '1px solid #333',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'white',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                    onClick={() => console.log('Selected item:', item.id)}
                  >
                    {item.src.split('/').pop()?.substring(0, 10)}...
                  </div>
                );
              })}
              {/* 현재 프레임 인디케이터 */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(currentFrame / totalDuration) * 100}%`,
                  width: '2px',
                  height: '60px',
                  backgroundColor: 'red',
                  zIndex: 10,
                  top: '0'
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 프리뷰 */}
      <div style={{ 
        backgroundColor: '#000',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: 'white' }}>미리보기</h3>
        <div style={{
          width: width / 2,
          height: height / 2,
          margin: '0 auto',
          backgroundColor: '#222',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          {/* 실제 구현에서는 여기에 Remotion Player 컴포넌트 배치 */}
          <MyComposition 
            mediaItems={compositionData.mediaItems}
            timelineControls={compositionData.timelineControls}
          />
        </div>
      </div>
    </div>
  );
};

// 유틸리티 함수들
const buttonStyle: React.CSSProperties = {
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px'
};

const getItemColor = (type: string): string => {
  switch (type) {
    case 'video': return '#007bff';
    case 'audio': return '#28a745';
    case 'image': return '#ffc107';
    default: return '#6c757d';
  }
}; 