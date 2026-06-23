import type { PetMood, PetState } from "./petState";

export interface Point {
  x: number;
  y: number;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_WALK_SPEED_PIXELS_PER_SECOND = 200;
const MIN_WALK_SPEED_PIXELS_PER_SECOND = 50;
const ARRIVE_DISTANCE = 200;
const SNAP_DISTANCE = 6;
const ACCELERATION_PIXELS_PER_SECOND = 700;
const IDLE_DAMPING_PER_SECOND = 0.0001;
const MIN_VELOCITY = 4;

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function updatePetPosition(
  state: PetState,
  deltaSeconds: number,
  bounds: ScreenBounds
): PetState {
  // If we aren't walking or don't have a destination target, slow down to a stop.
  if (state.mood !== "walking" || !state.targetPosition) {
    const velocity = dampVelocity(state.velocity, deltaSeconds);
    return {
      ...state,
      velocity,
      facing: velocity.x < -MIN_VELOCITY ? -1 : velocity.x > MIN_VELOCITY ? 1 : state.facing
    };
  }

  const target = state.targetPosition;
  const dx = target.x - state.position.x;
  const dy = target.y - state.position.y;
  const distance = Math.hypot(dx, dy);

  // If close enough to target, snap to it and reset target to stop walking.
  if (distance <= SNAP_DISTANCE) {
    return {
      ...state,
      position: clampToScreen(target, bounds),
      velocity: { x: 0, y: 0 },
      targetPosition: null,
      mood: "idle",
      facing: dx < 0 ? -1 : 1
    };
  }

  const direction = {
    x: dx / distance,
    y: dy / distance
  };
  const desiredSpeed = getDesiredSpeed(distance);
  const desiredVelocity = {
    x: direction.x * desiredSpeed,
    y: direction.y * desiredSpeed
  };
  const velocity = approachVelocity(
    state.velocity,
    desiredVelocity,
    ACCELERATION_PIXELS_PER_SECOND * deltaSeconds
  );
  const position = {
    x: state.position.x + velocity.x * deltaSeconds,
    y: state.position.y + velocity.y * deltaSeconds
  };

  return {
    ...state,
    position: clampToScreen(position, bounds),
    velocity,
    facing: velocity.x < 0 ? -1 : 1
  };
}

export function shouldAnimateWalk(mood: PetMood): boolean {
  return mood === "walking";
}

function getDesiredSpeed(distance: number): number {
  if (distance >= ARRIVE_DISTANCE) {
    return MAX_WALK_SPEED_PIXELS_PER_SECOND;
  }

  const ratio = distance / ARRIVE_DISTANCE;
  const easedRatio = ratio * ratio * (3 - 2 * ratio);

  return (
    MIN_WALK_SPEED_PIXELS_PER_SECOND +
    (MAX_WALK_SPEED_PIXELS_PER_SECOND - MIN_WALK_SPEED_PIXELS_PER_SECOND) * easedRatio
  );
}

function approachVelocity(current: Point, target: Point, maxDelta: number): Point {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const deltaLength = Math.hypot(deltaX, deltaY);

  if (deltaLength <= maxDelta || deltaLength === 0) {
    return target;
  }

  return {
    x: current.x + (deltaX / deltaLength) * maxDelta,
    y: current.y + (deltaY / deltaLength) * maxDelta
  };
}

function dampVelocity(velocity: Point, deltaSeconds: number): Point {
  const damping = Math.pow(IDLE_DAMPING_PER_SECOND, deltaSeconds);
  const nextVelocity = {
    x: velocity.x * damping,
    y: velocity.y * damping
  };

  if (Math.hypot(nextVelocity.x, nextVelocity.y) < MIN_VELOCITY) {
    return { x: 0, y: 0 };
  }

  return nextVelocity;
}

export function clampToScreen(point: Point, bounds: ScreenBounds): Point {
  const padding = 80; // Keep the companion safely on the active screen
  return {
    x: Math.min(Math.max(point.x, bounds.x + padding), bounds.x + bounds.width - padding),
    y: Math.min(Math.max(point.y, bounds.y + padding), bounds.y + bounds.height - padding)
  };
}
