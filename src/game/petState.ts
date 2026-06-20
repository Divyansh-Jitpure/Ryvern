import { distanceBetween, type Point } from "./movement";

export type PetMood = "idle" | "walking" | "working" | "sleeping";

export interface PetState {
  mood: PetMood;
  position: Point;
  velocity: Point;
  facing: -1 | 1;
  idleSeconds: number;
  animationSeconds: number;
}

export interface PetStateInput {
  mouse: Point;
  deltaSeconds: number;
  isUserActive: boolean;
  isWorking: boolean;
}

const WALK_START_DISTANCE = 92;
const IDLE_DISTANCE = 36;
const SLEEP_AFTER_SECONDS = 12;

export function createInitialPetState(position: Point): PetState {
  return {
    mood: "idle",
    position,
    velocity: { x: 0, y: 0 },
    facing: 1,
    idleSeconds: 0,
    animationSeconds: 0
  };
}

// The state machine owns behavior decisions only. Rendering and movement stay
// separate so sprite sheets, sounds, or richer AI can be added without mixing
// those concerns into React.
export function updatePetState(state: PetState, input: PetStateInput): PetState {
  const distanceToMouse = distanceBetween(state.position, input.mouse);
  const nextMood = chooseMood(state, input, distanceToMouse);

  return {
    ...state,
    mood: nextMood,
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

function chooseMood(
  state: PetState,
  input: PetStateInput,
  distanceToMouse: number
): PetMood {
  if (distanceToMouse > WALK_START_DISTANCE) {
    return "walking";
  }

  if (state.mood === "walking" && distanceToMouse > IDLE_DISTANCE) {
    return "walking";
  }

  if (state.mood === "sleeping" && !input.isUserActive) {
    return "sleeping";
  }

  if (input.isWorking) {
    return "working";
  }

  if (input.isUserActive) {
    return "idle";
  }

  const idleSeconds = state.mood === "idle"
    ? state.idleSeconds + input.deltaSeconds
    : 0;

  if (idleSeconds >= SLEEP_AFTER_SECONDS) {
    return "sleeping";
  }

  return "idle";
}
