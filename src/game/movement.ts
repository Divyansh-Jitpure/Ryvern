import type { PetMood, PetState } from "./petState";

export interface Point {
  x: number;
  y: number;
}

const WALK_SPEED_PIXELS_PER_SECOND = 95;
const EASE_STOP = 0.78;

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function movePetTowardMouse(
  state: PetState,
  mouse: Point,
  deltaSeconds: number,
  bounds?: { width: number; height: number }
): PetState {
  if (state.mood !== "walking") {
    return {
      ...state,
      velocity: {
        x: state.velocity.x * EASE_STOP,
        y: state.velocity.y * EASE_STOP
      }
    };
  }

  const dx = mouse.x - state.position.x;
  const dy = mouse.y - state.position.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const step = Math.min(WALK_SPEED_PIXELS_PER_SECOND * deltaSeconds, distance);
  const velocity = {
    x: (dx / distance) * step,
    y: (dy / distance) * step
  };

  return {
    ...state,
    position: bounds
      ? clampToBounds(
          {
            x: state.position.x + velocity.x,
            y: state.position.y + velocity.y
          },
          bounds
        )
      : {
          x: state.position.x + velocity.x,
          y: state.position.y + velocity.y
        },
    velocity,
    facing: dx < 0 ? -1 : 1
  };
}

export function shouldAnimateWalk(mood: PetMood): boolean {
  return mood === "walking";
}

function clampToBounds(point: Point, bounds: { width: number; height: number }) {
  const padding = 24;

  return {
    x: Math.min(Math.max(point.x, padding), bounds.width - padding),
    y: Math.min(Math.max(point.y, padding), bounds.height - padding)
  };
}
