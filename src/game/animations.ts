import type { PetMood } from "./petState";

export interface AnimationFrame {
  bodySquash: number;
  bobY: number;
  blink: boolean;
  tailAngle: number;
}

export interface SpriteAnimationDefinition {
  fps: number;
  frames: string[];
  loop: boolean;
}

const SPRITE_FRAME_ROOT = "/sprites/ryvern";

const spriteFrame = (name: string) => `${SPRITE_FRAME_ROOT}/${name}.png`;

export const petSpriteAnimations: Record<PetMood, SpriteAnimationDefinition> = {
  idle: {
    fps: 3,
    // Keep the open-eyed pose on screen and use the second seated frame as a
    // brief blink instead of alternating open/closed eyes continuously.
    frames: [
      spriteFrame("idle-1"),
      spriteFrame("idle-1"),
      spriteFrame("idle-1"),
      spriteFrame("idle-1"),
      spriteFrame("idle-1"),
      spriteFrame("idle-2")
    ],
    loop: true
  },
  walking: {
    fps: 6,
    frames: [spriteFrame("hover-1"), spriteFrame("hover-2")],
    loop: true
  },
  working: {
    fps: 6,
    frames: [
      spriteFrame("working-1"),
      spriteFrame("working-2"),
      spriteFrame("working-3"),
      spriteFrame("working-2"),
      spriteFrame("working-5"),
      spriteFrame("working-6"),
      spriteFrame("working-5"),
      spriteFrame("working-4")
    ],
    loop: true
  },
  sleeping: {
    // Both seated frames have closed eyes and make a subtle breathing cycle.
    fps: 1,
    frames: [spriteFrame("idle-2"), spriteFrame("idle-6")],
    loop: true
  }
};

// Placeholder animation data mirrors the contract a future sprite animator will
// need: mood plus elapsed time in that mood produces a display frame.
export function getPetAnimationFrame(
  mood: PetMood,
  animationSeconds: number
): AnimationFrame {
  switch (mood) {
    case "walking":
      return {
        bodySquash: 1 + Math.sin(animationSeconds * 16) * 0.06,
        bobY: Math.sin(animationSeconds * 18) * 3,
        blink: false,
        tailAngle: Math.sin(animationSeconds * 12) * 0.5
      };
    case "sleeping":
      return {
        bodySquash: 0.94 + Math.sin(animationSeconds * 2.4) * 0.03,
        bobY: Math.sin(animationSeconds * 2.4) * 1.5,
        blink: true,
        tailAngle: -0.35
      };
    case "working":
      return {
        bodySquash: 1,
        bobY: Math.sin(animationSeconds * 7) * 0.75,
        blink: false,
        tailAngle: Math.sin(animationSeconds * 5) * 0.1
      };
    case "idle":
    default:
      return {
        bodySquash: 1 + Math.sin(animationSeconds * 3) * 0.025,
        bobY: Math.sin(animationSeconds * 3) * 1.5,
        blink: Math.floor(animationSeconds * 2) % 9 === 0,
        tailAngle: Math.sin(animationSeconds * 4) * 0.2
      };
  }
}
