import { Assets, type Texture } from "pixi.js";
import type { PetMood } from "./petState";
import { petSpriteAnimations } from "./animations";

export interface PetSpriteSet {
  texturesByMood: Record<PetMood, Texture[]>;
}

// Sprite loading lives outside the Pixi scene so the renderer can stay focused
// on display objects. When real art is dropped into public/sprites/ryvern,
// this loader begins returning textures without changing movement or AI code.
export async function loadPetSpriteSet(): Promise<PetSpriteSet | null> {
  try {
    const texturesByMood = {
      idle: await loadMoodTextures("idle"),
      walking: await loadMoodTextures("walking"),
      sleeping: await loadMoodTextures("sleeping")
    } satisfies Record<PetMood, Texture[]>;

    return { texturesByMood };
  } catch {
    return null;
  }
}

async function loadMoodTextures(mood: PetMood): Promise<Texture[]> {
  const animation = petSpriteAnimations[mood];
  const textures = await Promise.all(
    animation.frames.map((framePath) =>
      Assets.load<Texture>({
        src: framePath,
        data: {
          scaleMode: "nearest"
        }
      })
    )
  );

  if (textures.some((texture) => !texture)) {
    throw new Error(`Missing sprite frames for ${mood}`);
  }

  return textures;
}
