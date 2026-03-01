import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

interface LaunchVideoProps {
  title: string;
  subtitle: string;
  features: string[];
  bgColor: string;
  accentColor: string;
  textColor: string;
}

export const LaunchVideo: React.FC<LaunchVideoProps> = ({
  title,
  subtitle,
  features = [],
  bgColor = "#0f172a",
  accentColor = "#3b82f6",
  textColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Scene durations
  const introEnd = Math.floor(fps * 3);
  const subtitleStart = Math.floor(fps * 1.5);
  const featuresStart = Math.floor(fps * 4);
  const featureDuration = Math.floor(fps * 2);
  const outroStart = durationInFrames - Math.floor(fps * 3);

  // Intro animations
  const titleScale = spring({ fps, frame, config: { damping: 200 } });
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Accent line
  const lineWidth = interpolate(frame, [10, 30], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStart, subtitleStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtitleY = interpolate(
    frame,
    [subtitleStart, subtitleStart + 20],
    [30, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Outro
  const outroOpacity = interpolate(
    frame,
    [outroStart, outroStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const mainOpacity = interpolate(
    frame,
    [outroStart - 15, outroStart],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Background gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}22, transparent)`,
          top: -100,
          right: -100,
          transform: `scale(${interpolate(frame, [0, durationInFrames], [0.8, 1.3])})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}15, transparent)`,
          bottom: -50,
          left: -50,
          transform: `scale(${interpolate(frame, [0, durationInFrames], [1, 1.5])})`,
        }}
      />

      {/* Main content — intro + subtitle */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: mainOpacity,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            color: textColor,
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
            letterSpacing: -2,
            textAlign: "center",
          }}
        >
          {title}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 4,
            backgroundColor: accentColor,
            marginTop: 20,
            marginBottom: 20,
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 400,
            color: `${textColor}cc`,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            textAlign: "center",
            maxWidth: width * 0.7,
          }}
        >
          {subtitle}
        </div>
      </AbsoluteFill>

      {/* Features sequence */}
      {features.map((feature, i) => {
        const featureStart = featuresStart + i * featureDuration;
        return (
          <Sequence
            key={i}
            from={featureStart}
            durationInFrames={featureDuration}
          >
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <FeatureCard
                text={feature}
                index={i}
                accentColor={accentColor}
                textColor={textColor}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Outro */}
      <Sequence from={outroStart}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: outroOpacity,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: textColor,
              textAlign: "center",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 36,
              color: accentColor,
              marginTop: 16,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const FeatureCard: React.FC<{
  text: string;
  index: number;
  accentColor: string;
  textColor: string;
}> = ({ text, index, accentColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          backgroundColor: `${accentColor}33`,
          border: `2px solid ${accentColor}`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 28,
          fontWeight: 700,
          color: accentColor,
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 600,
          color: textColor,
        }}
      >
        {text}
      </div>
    </div>
  );
};
