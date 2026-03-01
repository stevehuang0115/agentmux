import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

interface AnnouncementProps {
  headline: string;
  body: string;
  cta: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
}

export const Announcement: React.FC<AnnouncementProps> = ({
  headline = "Big News!",
  body = "",
  cta = "",
  bgColor = "#0a0a0a",
  accentColor = "#22c55e",
  textColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const ctaStart = Math.floor(durationInFrames * 0.6);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Animated background particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const startX = ((i * 137.5) % width);
        const startY = ((i * 97.3) % height);
        const size = 4 + (i % 4) * 2;
        const speed = 0.5 + (i % 3) * 0.3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: startX,
              top: startY - frame * speed,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: `${accentColor}${(15 + (i % 20)).toString(16)}`,
            }}
          />
        );
      })}

      {/* Headline */}
      <Sequence from={0} durationInFrames={ctaStart + 30}>
        <HeadlineScene
          headline={headline}
          body={body}
          accentColor={accentColor}
          textColor={textColor}
          fadeOutAt={ctaStart - 15}
        />
      </Sequence>

      {/* CTA */}
      {cta && (
        <Sequence from={ctaStart}>
          <CTAScene
            cta={cta}
            headline={headline}
            accentColor={accentColor}
            textColor={textColor}
            bgColor={bgColor}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

const HeadlineScene: React.FC<{
  headline: string;
  body: string;
  accentColor: string;
  textColor: string;
  fadeOutAt: number;
}> = ({ headline, body, accentColor, textColor, fadeOutAt }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 100, mass: 0.8 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(
    frame,
    [fadeOutAt, fadeOutAt + 15],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Flash effect at the start
  const flashOpacity = interpolate(frame, [0, 5, 10], [0.8, 0.3, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(opacity, exitOpacity),
      }}
    >
      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: accentColor,
          opacity: flashOpacity,
        }}
      />

      <div style={{ textAlign: "center", maxWidth: width * 0.8 }}>
        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: textColor,
            transform: `scale(${scale})`,
            lineHeight: 1.1,
            marginBottom: 32,
          }}
        >
          {headline}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(frame, [15, 35], [0, 300], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 4,
            backgroundColor: accentColor,
            margin: "0 auto",
            borderRadius: 2,
          }}
        />

        {/* Body text */}
        {body && (
          <div
            style={{
              fontSize: 40,
              fontWeight: 400,
              color: `${textColor}bb`,
              marginTop: 32,
              opacity: interpolate(frame, [25, 40], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame, [25, 40], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
              lineHeight: 1.5,
            }}
          >
            {body}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC<{
  cta: string;
  headline: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
}> = ({ cta, headline, accentColor, textColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing button effect
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.05, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: `${textColor}88`,
            marginBottom: 40,
            transform: `scale(${scale})`,
          }}
        >
          {headline}
        </div>

        {/* CTA button */}
        <div
          style={{
            display: "inline-flex",
            padding: "24px 64px",
            fontSize: 48,
            fontWeight: 700,
            color: bgColor,
            backgroundColor: accentColor,
            borderRadius: 16,
            transform: `scale(${scale * pulse})`,
            boxShadow: `0 0 40px ${accentColor}66`,
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  );
};
