import type { Point, ScreenBounds } from "./movement";

export type PetMood = "idle" | "walking" | "working" | "sleeping";

export interface PetState {
  mood: PetMood;
  position: Point;
  velocity: Point;
  facing: -1 | 1;
  idleSeconds: number;
  animationSeconds: number;
  targetPosition: Point | null;
  wanderCooldown: number;
}

export interface PetStateInput {
  mouse: Point;
  deltaSeconds: number;
  isUserActive: boolean;
  isWorking: boolean;
  screenBounds: ScreenBounds;
  isSummoned: boolean;
  isDragging: boolean;
}

const SLEEP_AFTER_SECONDS = 12;

export function createInitialPetState(position: Point): PetState {
  return {
    mood: "idle",
    position,
    velocity: { x: 0, y: 0 },
    facing: 1,
    idleSeconds: 0,
    animationSeconds: 0,
    targetPosition: null,
    wanderCooldown: 10 + Math.random() * 10 // Wander after 10-20 seconds
  };
}

// The state machine decides transitions based on input events.
// Dragging and working take high priority. When idle, we count down
// to either fall asleep or pick a random wander target.
export function updatePetState(state: PetState, input: PetStateInput): PetState {
  if (input.isDragging) {
    return {
      ...state,
      mood: "walking",
      velocity: { x: 0, y: 0 },
      idleSeconds: 0,
      animationSeconds: state.animationSeconds + input.deltaSeconds,
      targetPosition: null,
      wanderCooldown: 15 + Math.random() * 15
    };
  }

  if (input.isWorking) {
    return {
      ...state,
      mood: "working",
      velocity: { x: 0, y: 0 },
      targetPosition: null,
      idleSeconds: 0,
      animationSeconds: state.mood === "working" ? state.animationSeconds + input.deltaSeconds : 0,
      wanderCooldown: 15 + Math.random() * 15
    };
  }

  let nextMood = state.mood;
  if (state.mood === "working") {
    nextMood = "idle";
  }
  let targetPosition = state.targetPosition;
  let wanderCooldown = state.wanderCooldown;

  if (input.isSummoned) {
    nextMood = "walking";
    targetPosition = input.mouse;
    wanderCooldown = 15 + Math.random() * 15;
  } else if (state.mood === "walking") {
    if (!targetPosition) {
      nextMood = "idle";
    }
  } else {
    // idle or sleeping
    if (state.mood === "sleeping" && !input.isUserActive) {
      nextMood = "sleeping";
    } else if (state.mood === "sleeping" && input.isUserActive) {
      nextMood = "idle";
    }

    if (nextMood === "idle") {
      wanderCooldown -= input.deltaSeconds;
      if (wanderCooldown <= 0) {
        nextMood = "walking";
        const padding = 80;
        const targetX =
          input.screenBounds.x +
          padding +
          Math.random() * (input.screenBounds.width - 2 * padding);
        const targetY =
          input.screenBounds.y +
          padding +
          Math.random() * (input.screenBounds.height - 2 * padding);
        targetPosition = { x: targetX, y: targetY };
        wanderCooldown = 15 + Math.random() * 15;
      } else if (state.idleSeconds + input.deltaSeconds >= SLEEP_AFTER_SECONDS) {
        nextMood = "sleeping";
      }
    }
  }

  return {
    ...state,
    mood: nextMood,
    targetPosition,
    wanderCooldown,
    idleSeconds:
      nextMood === "sleeping"
        ? state.idleSeconds
        : nextMood === "idle" && !input.isUserActive
          ? state.idleSeconds + input.deltaSeconds
          : 0,
    animationSeconds:
      nextMood === state.mood ? state.animationSeconds + input.deltaSeconds : 0
  };
}
