import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

interface Slide {
  title: string;
  body: string;
}

interface TextSlidesProps {
  slides: Slide[];
  bgColor: string;
  accentColor: string;
  textColor: string;
}

export const TextSlides: React.FC<TextSlidesProps> = ({
  slides = [],
  bgColor = "#1a1a2e",
  accentColor = "#e94560",
  textColor = "#ffffff",
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const slideDuration = Math.floor(durationInFrames / Math.max(slides.length, 1));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {slides.map((slide, i) => (
        <Sequence
          key={i}
          from={i * slideDuration}
          durationInFrames={slideDuration}
        >
          <SlideScene
            slide={slide}
            index={i}
            total={slides.length}
            accentColor={accentColor}
            textColor={textColor}
            bgColor={bgColor}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SlideScene: React.FC<{
  slide: Slide;
  index: number;
  total: number;
  accentColor: string;
  textColor: string;
  bgColor: string;
}> = ({ slide, index, total, accentColor, textColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  // Enter animation
  const enterProgress = spring({ fps, frame, config: { damping: 200 } });
  const enterOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Exit animation
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(enterOpacity, exitOpacity);

  // Slide indicator
  const slideX = interpolate(frame, [0, 20], [-50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Accent bar
  const barHeight = interpolate(frame, [5, 25], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: width * 0.12,
          top: "50%",
          transform: "translateY(-50%)",
          width: 6,
          height: barHeight,
          backgroundColor: accentColor,
          borderRadius: 3,
        }}
      />

      {/* Content */}
      <div
        style={{
          marginLeft: width * 0.08,
          maxWidth: width * 0.65,
          transform: `translateY(${interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        {/* Slide number */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: accentColor,
            marginBottom: 16,
            transform: `translateX(${slideX}px)`,
            opacity: enterOpacity,
          }}
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: textColor,
            lineHeight: 1.1,
            marginBottom: 24,
            transform: `scale(${enterProgress})`,
          }}
        >
          {slide.title}
        </div>

        {/* Body */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            color: `${textColor}aa`,
            lineHeight: 1.5,
            opacity: interpolate(frame, [15, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {slide.body}
        </div>
      </div>

      {/* Bottom progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "10%",
          width: "80%",
          height: 3,
          backgroundColor: `${textColor}22`,
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${interpolate(frame, [0, durationInFrames], [0, 100])}%`,
            height: "100%",
            backgroundColor: accentColor,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
