import type { PetMood } from "./petState";

export interface AnimationFrame {
  bodySquash: number;
  bobY: number;
  blink: boolean;
  tailAngle: number;
}

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
