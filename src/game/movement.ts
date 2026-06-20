import type { PetMood, PetState } from "./petState";

export interface Point {
  x: number;
  y: number;
}

const MAX_WALK_SPEED_PIXELS_PER_SECOND = 170;
const MIN_WALK_SPEED_PIXELS_PER_SECOND = 30;
const ARRIVE_DISTANCE = 200;
const SNAP_DISTANCE = 6;
const ACCELERATION_PIXELS_PER_SECOND = 700;
const IDLE_DAMPING_PER_SECOND = 0.0001;
const MIN_VELOCITY = 4;

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function movePetTowardMouse(
  state: PetState,
  mouse: Point,
  deltaSeconds: number,
  bounds?: { width: number; height: number }
): PetState {
  const dx = mouse.x - state.position.x;
  const dy = mouse.y - state.position.y;
  const distance = Math.hypot(dx, dy);

  if (state.mood !== "walking") {
    const velocity = dampVelocity(state.velocity, deltaSeconds);

    return {
      ...state,
      velocity,
      facing: velocity.x < -MIN_VELOCITY ? -1 : velocity.x > MIN_VELOCITY ? 1 : state.facing
    };
  }

  if (distance <= SNAP_DISTANCE) {
    return {
      ...state,
      position: bounds ? clampToBounds(mouse, bounds) : mouse,
      velocity: { x: 0, y: 0 },
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
    position: bounds ? clampToBounds(position, bounds) : position,
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

function clampToBounds(point: Point, bounds: { width: number; height: number }) {
  const padding = 24;

  return {
    x: Math.min(Math.max(point.x, padding), bounds.width - padding),
    y: Math.min(Math.max(point.y, padding), bounds.height - padding)
  };
}
