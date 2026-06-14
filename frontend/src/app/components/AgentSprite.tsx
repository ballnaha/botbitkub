import { Box } from "@mui/material";

/**
 * Plays a horizontal-strip PNG sprite sheet with a CSS steps() animation.
 *
 * Drop a sheet into `frontend/public/sprites/` — e.g. a strip of 4 frames,
 * each 32×32, laid out left→right in one row — then describe it here:
 *
 *   <AgentSprite src="/sprites/trader_idle.png" frames={4} frameWidth={32} frameHeight={32} fps={6} />
 *
 * The whole thing is pure GPU-composited CSS (background-position + transform),
 * so it stays cheap. When `active` is false the walk/typing loop freezes on
 * frame 0 and the idle bob stops — nothing keeps the CPU busy.
 */
export interface AgentSpriteConfig {
  src: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  /** Frames per second of the loop. Default 6. */
  fps?: number;
  /** Integer upscale for the pixel art. Default 2. Ignored when fitWidth/fitHeight are set. */
  scale?: number;
  /** Scale to fit inside this width (px). Use with fitHeight for contain-scaling. */
  fitWidth?: number;
  /** Scale to fit inside this height (px). Use with fitWidth for contain-scaling. */
  fitHeight?: number;
}

interface AgentSpriteProps extends AgentSpriteConfig {
  active?: boolean;
}

export function AgentSprite({ src, frames, frameWidth, frameHeight, fps = 6, scale = 2, fitWidth, fitHeight, active = true }: AgentSpriteProps) {
  const computedScale = fitWidth && fitHeight
    ? Math.min(fitWidth / frameWidth, fitHeight / frameHeight)
    : scale;
  const w = frameWidth * computedScale;
  const h = frameHeight * computedScale;
  const duration = frames / fps;

  return (
    <Box
      sx={{
        width: w,
        height: h,
        "@keyframes spriteIdleBob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        ...(active ? { animation: "spriteIdleBob 2.6s ease-in-out infinite" } : {}),
      }}
    >
      <Box
        sx={{
          width: w,
          height: h,
          backgroundImage: `url(${src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${w * frames}px ${h}px`,
          backgroundPositionX: 0,
          imageRendering: "pixelated",
          "@keyframes spriteRun": {
            from: { backgroundPositionX: "0px" },
            to: { backgroundPositionX: `-${w * frames}px` },
          },
          ...(active && frames > 1
            ? { animation: `spriteRun ${duration}s steps(${frames}) infinite` }
            : {}),
        }}
      />
    </Box>
  );
}
