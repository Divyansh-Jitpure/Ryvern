import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
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
import { movePetTowardMouse, type Point } from "../game/movement";
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
    const tauriWindow = getCurrentWindow();

    async function mountPixi() {
      const initialWindowPosition = await tauriWindow.outerPosition();
      petState = createInitialPetState({
        x: initialWindowPosition.x + PET_CANVAS_WIDTH / 2,
        y: initialWindowPosition.y + PET_CANVAS_HEIGHT / 2
      });
      mouse.x = petState.position.x;
      mouse.y = petState.position.y;

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

      // State, motion, and rendering stay intentionally separated here.
      // The ticker drives game updates first, then asks the active renderer
      // to draw the current mood. That keeps sprite swaps independent from AI.
      app.ticker.add((ticker) => {
        const deltaSeconds = ticker.deltaMS / 1000;
        petState = updatePetState(petState, { mouse, deltaSeconds });
        petState = movePetTowardMouse(petState, mouse, deltaSeconds);

        windowMoveAccumulator += deltaSeconds;
        if (windowMoveAccumulator >= 1 / 30) {
          windowMoveAccumulator = 0;
          void tauriWindow.setPosition(
            new PhysicalPosition(
              Math.round(petState.position.x - PET_CANVAS_WIDTH / 2),
              Math.round(petState.position.y - PET_CANVAS_HEIGHT / 2)
            )
          );
        }

        renderer.render(petState);
      });
    }

    void mountPixi();
    const cursorTimer = window.setInterval(() => {
      void invoke<[number, number]>("cursor_position")
        .then(([x, y]) => {
          mouse.x = x;
          mouse.y = y;
        })
        .catch(() => {
          // Cursor tracking for this MVP comes from the Tauri command so the pet can stay click-through.
        });
    }, 33);

    return () => {
      disposed = true;
      window.clearInterval(cursorTimer);
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
