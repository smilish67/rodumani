import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { EditorDemo } from "./demo/EditorDemo";
import { MCPDemo, MCPPreview } from './MCPPreview';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 기본 비디오 컴포지션 */}
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          mediaItems: [],
          timelineControls: {}
        }}
      />
      
      {/* 편집 데모 컴포지션 (개발/테스트용) */}
      <Composition
        id="EditorDemo"
        component={EditorDemo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          width: 1280,
          height: 720,
          fps: 30
        }}
      />

      <Composition
        id="MCPDemo"
        component={MCPDemo}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
      />

      <Composition
        id="MCPPreview"
        component={() => <MCPPreview sessionId="session_simple_1749086294601_1" />}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
