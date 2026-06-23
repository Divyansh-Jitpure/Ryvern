import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, currentMonitor } from "@tauri-apps/api/window";
import {
  AnimatedSprite,
  Application,
  Container,
  Graphics
} from "pixi.js";
import {
  createInitialPetState,
  updatePetState,
  type PetMood,
  type PetState
} from "../game/petState";
import {
  updatePetPosition,
  distanceBetween,
  type Point,
  type ScreenBounds
} from "../game/movement";
import {
  getPetAnimationFrame,
  petSpriteAnimations
} from "../game/animations";
import { loadPetSpriteSet, type PetSpriteSet } from "../game/spriteAssets";

const PET_CANVAS_WIDTH = 320;
const PET_CANVAS_HEIGHT = 320;
const SPRITE_SCALE = 3;
const HOVER_OFFSET_Y = -14;

type PetRenderer =
  | ReturnType<typeof createPlaceholderRenderer>
  | ReturnType<typeof createSpriteRenderer>;

export function PetCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let app: Application | undefined;
    let windowMoveAccumulator = 0;
    let petState: PetState = createInitialPetState({
      x: PET_CANVAS_WIDTH / 2,
      y: PET_CANVAS_HEIGHT / 2
    });
    const mouse: Point = { ...petState.position };
    let stationaryCursorSeconds = 0;
    let isUserActive = false;
    let isWorking = false;
    const tauriWindow = getCurrentWindow();

    let isDragging = false;
    let currentlyCapturing = false;
    let isSummoned = false;
    let mouseHistory: Point[] = [];
    let screenBounds: ScreenBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    let unlistenMoved: (() => void) | undefined;

    let lastWindowX = 0;
    let lastWindowY = 0;

    async function mountPixi() {
      let monitor = null;
      try {
        monitor = await currentMonitor();
      } catch (err) {}

      if (monitor) {
        screenBounds = {
          x: monitor.position.x,
          y: monitor.position.y,
          width: monitor.size.width,
          height: monitor.size.height
        };
      } else {
        const dpr = window.devicePixelRatio || 1;
        screenBounds = {
          x: 0,
          y: 0,
          width: window.screen.width * dpr,
          height: window.screen.height * dpr
        };
      }

      const initialWindowPosition = await tauriWindow.outerPosition();
      petState = createInitialPetState({
        x: initialWindowPosition.x + PET_CANVAS_WIDTH / 2,
        y: initialWindowPosition.y + PET_CANVAS_HEIGHT / 2
      });
      mouse.x = petState.position.x;
      mouse.y = petState.position.y;
      lastWindowX = initialWindowPosition.x;
      lastWindowY = initialWindowPosition.y;

      app = new Application();
      await app.init({
        width: PET_CANVAS_WIDTH,
        height: PET_CANVAS_HEIGHT,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        roundPixels: true
      });

      if (disposed || !hostRef.current) {
        app.destroy();
        return;
      }

      const stage = app.stage;
      const spriteSet = await loadPetSpriteSet();
      const renderer = spriteSet
        ? createSpriteRenderer(spriteSet)
        : createPlaceholderRenderer();

      stage.addChild(renderer.pet);
      hostRef.current.appendChild(app.canvas);

      let lastMouseX = mouse.x;

      // State, motion, and rendering stay intentionally separated here.
      // The ticker drives game updates first, then asks the active renderer
      // to draw the current mood. That keeps sprite swaps independent from AI.
      app.ticker.add((ticker) => {
        const mouseDx = mouse.x - lastMouseX;
        if (isDragging) {
          if (mouseDx < -1) {
            petState.facing = -1;
          } else if (mouseDx > 1) {
            petState.facing = 1;
          }
        }
        lastMouseX = mouse.x;

        const deltaSeconds = ticker.deltaMS / 1000;
        petState = updatePetState(petState, {
          mouse,
          deltaSeconds,
          isUserActive,
          isWorking,
          screenBounds,
          isSummoned,
          isDragging
        });
        isSummoned = false; // Reset one-shot summon input

        petState = updatePetPosition(petState, deltaSeconds, screenBounds);

        if (!isDragging) {
          windowMoveAccumulator += deltaSeconds;
          if (windowMoveAccumulator >= 1 / 30) {
            windowMoveAccumulator = 0;
            void tauriWindow.setPosition(
              new PhysicalPosition(
                Math.round(petState.position.x - PET_CANVAS_WIDTH / 2),
                Math.round(petState.position.y - PET_CANVAS_HEIGHT / 2)
              )
            ).catch(() => {});
          }
        }

        // Manage hover click-through state
        const distanceToPet = distanceBetween(mouse, petState.position);
        const shouldCapture = distanceToPet < 45 || isDragging;

        if (shouldCapture !== currentlyCapturing) {
          currentlyCapturing = shouldCapture;
          void tauriWindow.setIgnoreCursorEvents(!shouldCapture).catch(() => {});
          if (hostRef.current) {
            hostRef.current.style.pointerEvents = shouldCapture ? "auto" : "none";
          }
        }

        if (app && app.canvas) {
          app.canvas.style.cursor = isDragging ? "grabbing" : shouldCapture ? "grab" : "default";
        }

        renderer.render(petState);
      });
    }

    void mountPixi();

    const cursorTimer = window.setInterval(() => {
      void currentMonitor()
        .then((monitor: any) => {
          if (monitor) {
            screenBounds = {
              x: monitor.position.x,
              y: monitor.position.y,
              width: monitor.size.width,
              height: monitor.size.height
            };
          } else {
            const dpr = window.devicePixelRatio || 1;
            screenBounds = {
              x: 0,
              y: 0,
              width: window.screen.width * dpr,
              height: window.screen.height * dpr
            };
          }
        })
        .catch(() => {
          const dpr = window.devicePixelRatio || 1;
          screenBounds = {
            x: 0,
            y: 0,
            width: window.screen.width * dpr,
            height: window.screen.height * dpr
          };
        });

      void tauriWindow.outerPosition()
        .then((pos) => {
          const dx = pos.x - lastWindowX;
          const dy = pos.y - lastWindowY;
          const moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;

          if (moved) {
            if (dx < -1) {
              petState.facing = -1;
            } else if (dx > 1) {
              petState.facing = 1;
            }
            petState.position = {
              x: pos.x + PET_CANVAS_WIDTH / 2,
              y: pos.y + PET_CANVAS_HEIGHT / 2
            };
          }
          lastWindowX = pos.x;
          lastWindowY = pos.y;
        })
        .catch(() => {});

      void invoke<[number, number, number, number]>("input_snapshot")
        .then(([x, y, lastInputAgeMs, keyboardInputAgeMs]) => {
          const cursorMoved = Math.hypot(x - mouse.x, y - mouse.y) >= 1;
          stationaryCursorSeconds = cursorMoved
            ? 0
            : stationaryCursorSeconds + 0.033;
          isUserActive = lastInputAgeMs <= 1200;
          isWorking =
            keyboardInputAgeMs <= 1200 && stationaryCursorSeconds >= 0.15;
          mouse.x = x;
          mouse.y = y;

          // Check mouse shaking/wiggling to summon pet (only when NOT dragging)
          if (!isDragging) {
            mouseHistory.push({ x, y });
            if (mouseHistory.length > 30) {
              mouseHistory.shift();
            }

            let totalDistance = 0;
            for (let i = 1; i < mouseHistory.length; i++) {
              totalDistance += distanceBetween(mouseHistory[i], mouseHistory[i - 1]);
            }
            const netDistance = mouseHistory.length > 1
              ? distanceBetween(mouseHistory[0], mouseHistory[mouseHistory.length - 1])
              : 0;

            // If the mouse has moved a lot overall (totalDistance) but hasn't traveled far linearly (netDistance), it's shaking.
            // Requires shaking for at least 0.8s (>= 25 frames) and longer distance to prevent accidental triggers.
            if (mouseHistory.length >= 25 && totalDistance > 650 && totalDistance > 4.0 * netDistance) {
              isSummoned = true;
              mouseHistory = []; // Reset history so we don't trigger summon repeatedly
            }
          } else {
            // Keep mouse history clear while dragging so we don't trigger a summon right after dropping
            mouseHistory = [];
          }
        })
        .catch(() => {
          // Cursor tracking for this MVP comes from the Tauri command so the pet can stay click-through.
        });
    }, 33);

    const handlePointerDown = (e: PointerEvent) => {
      console.log("PetCanvas: pointerdown - button:", e.button, "capturing:", currentlyCapturing);
      if (e.button === 0 && currentlyCapturing) {
        console.log("PetCanvas: startDragging native OS window drag");
        isDragging = true;
        void tauriWindow.startDragging().catch((err) => {
          console.error("Tauri: startDragging failed:", err);
        });
      }
    };

    const handlePointerUp = () => {
      console.log("PetCanvas: pointerup - isDragging:", isDragging);
      if (isDragging) {
        isDragging = false;
        console.log("PetCanvas: isDragging set to false (up)");
      }
    };

    const handlePointerCancel = () => {
      console.log("PetCanvas: pointercancel - isDragging:", isDragging);
      if (isDragging) {
        isDragging = false;
        console.log("PetCanvas: isDragging set to false (cancel)");
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging && (e.buttons & 1) === 0) {
        console.log("PetCanvas: pointermove (no left button) - resetting isDragging");
        isDragging = false;
      }
    };

    const el = hostRef.current;
    if (el) {
      el.addEventListener("pointerdown", handlePointerDown as EventListener);
    }
    window.addEventListener("pointerup", handlePointerUp as EventListener);
    window.addEventListener("pointercancel", handlePointerCancel as EventListener);
    window.addEventListener("pointermove", handlePointerMove as EventListener);

    return () => {
      disposed = true;
      window.clearInterval(cursorTimer);
      if (unlistenMoved) {
        unlistenMoved();
      }
      if (el) {
        el.removeEventListener("pointerdown", handlePointerDown as EventListener);
      }
      window.removeEventListener("pointerup", handlePointerUp as EventListener);
      window.removeEventListener("pointercancel", handlePointerCancel as EventListener);
      window.removeEventListener("pointermove", handlePointerMove as EventListener);
      app?.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="petCanvas"
      style={{ pointerEvents: "none" }}
      aria-label="Ryvern dragon companion"
    />
  );
}

function createSpriteRenderer(spriteSet: PetSpriteSet) {
  const pet = new Container();
  const shadow = new Graphics();
  const zBubble = new Graphics();
  const sprite = new AnimatedSprite(spriteSet.texturesByMood.idle);
  let activeMood: PetMood = "idle";

  sprite.anchor.set(0.5, 0.7);
  sprite.roundPixels = true;
  sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE);
  sprite.animationSpeed = petSpriteAnimations.idle.fps / 60;
  sprite.loop = petSpriteAnimations.idle.loop;
  sprite.play();

  pet.addChild(shadow, sprite, zBubble);

  function render(state: PetState) {
    const frame = getPetAnimationFrame(state.mood, state.animationSeconds);

    if (state.mood !== activeMood) {
      applyMoodToSprite(sprite, spriteSet, state.mood);
      activeMood = state.mood;
    }

    pet.position.set(PET_CANVAS_WIDTH / 2, PET_CANVAS_HEIGHT / 2 + frame.bobY);
    // The source artwork faces left, while PetState.facing uses +1 for right.
    sprite.scale.set(-state.facing * SPRITE_SCALE, SPRITE_SCALE);
    sprite.y = (state.mood === "walking" ? HOVER_OFFSET_Y : 0) + frame.bodySquash * 2;

    drawSharedOverlays({
      shadow,
      zBubble,
      state,
      bobY: frame.bobY,
      zPosition: { x: -66, y: -104 }
    });
  }

  return { pet, render };
}

function applyMoodToSprite(
  sprite: AnimatedSprite,
  spriteSet: PetSpriteSet,
  mood: PetMood
) {
  const animation = petSpriteAnimations[mood];

  sprite.textures = spriteSet.texturesByMood[mood];
  sprite.animationSpeed = animation.fps / 60;
  sprite.loop = animation.loop;
  sprite.gotoAndPlay(0);
}

function createPlaceholderRenderer() {
  const pet = new Container();
  const body = new Graphics();
  const face = new Graphics();
  const shadow = new Graphics();
  const tail = new Graphics();
  const wings = new Graphics();
  const horns = new Graphics();
  const zBubble = new Graphics();

  pet.addChild(shadow, wings, tail, body, horns, face, zBubble);

  function render(state: PetState) {
    const frame = getPetAnimationFrame(state.mood, state.animationSeconds);
    const pixel = 4;

    pet.position.set(PET_CANVAS_WIDTH / 2, PET_CANVAS_HEIGHT / 2 + frame.bobY);
    pet.scale.set(state.facing, 1);

    shadow.clear();
    shadow
      .ellipse(0, 27, 30, 8)
      .fill({ color: 0x000000, alpha: state.mood === "sleeping" ? 0.12 : 0.18 });

    wings.clear();
    wings
      .poly([-20, -9, -50, -25, -36, 8])
      .fill(0x657e5b)
      .stroke({ color: 0x2c4b3e, width: pixel });
    wings
      .poly([20, -9, 50, -25, 36, 8])
      .fill(0x657e5b)
      .stroke({ color: 0x2c4b3e, width: pixel });

    tail.clear();
    tail
      .roundRect(-42, -3, 34, 9, 3)
      .fill(0x3c8b69)
      .stroke({ color: 0x2c4b3e, width: pixel });
    tail.rotation = frame.tailAngle;

    body.clear();
    body
      .roundRect(-24, -26 * frame.bodySquash, 48, 52 * frame.bodySquash, 6)
      .fill(0x498b69)
      .stroke({ color: 0x2c4b3e, width: pixel });
    body.rect(-9, 2, 18, 20).fill(0xf0d986);

    horns.clear();
    horns
      .poly([
        -14,
        -25 * frame.bodySquash,
        -9,
        -43 * frame.bodySquash,
        -4,
        -25 * frame.bodySquash
      ])
      .fill(0xf6db92)
      .stroke({ color: 0x5c4a2d, width: pixel });
    horns
      .poly([
        4,
        -25 * frame.bodySquash,
        9,
        -43 * frame.bodySquash,
        14,
        -25 * frame.bodySquash
      ])
      .fill(0xf6db92)
      .stroke({ color: 0x5c4a2d, width: pixel });

    face.clear();
    if (frame.blink) {
      face.rect(-12, -8, 8, 3).fill(0x3a2419);
      face.rect(6, -8, 8, 3).fill(0x3a2419);
    } else {
      face.rect(-12, -12, 7, 9).fill(0x3a2419);
      face.rect(7, -12, 7, 9).fill(0x3a2419);
    }
    face.rect(-3, 0, 6, 4).fill(0x3a2419);

    drawSharedOverlays({
      shadow,
      zBubble,
      state,
      bobY: frame.bobY
    });
  }

  return { pet, render };
}

function drawSharedOverlays({
  shadow,
  zBubble,
  state,
  bobY,
  zPosition = { x: -50, y: -58 }
}: {
  shadow: Graphics;
  zBubble: Graphics;
  state: PetState;
  bobY: number;
  zPosition?: Point;
}) {
  // The pet bobs inside its container, but its ground shadow should not.
  shadow.y = -bobY;
  shadow.clear();
  shadow
    .ellipse(0, 27, 30, 8)
    .fill({
      color: 0x000000,
      alpha: state.mood === "idle" ? 0.18 : 0.12
    });

  zBubble.clear();
  if (state.mood === "sleeping") {
    const floatY = Math.sin(state.animationSeconds * 2) * 4;
    drawPixelZ(zBubble, zPosition.x, zPosition.y + floatY);
  }
}

function drawPixelZ(graphics: Graphics, x: number, y: number) {
  const size = 4;
  const color = 0x5c3827;

  graphics.rect(x, y, size * 5, size).fill(color);
  graphics.rect(x + size * 3, y + size, size, size).fill(color);
  graphics.rect(x + size * 2, y + size * 2, size, size).fill(color);
  graphics.rect(x + size, y + size * 3, size, size).fill(color);
  graphics.rect(x, y + size * 4, size * 5, size).fill(color);
}
