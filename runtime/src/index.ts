import { ScrollPlayer } from "./player";
import type { ScrollAnimationOptions } from "./types";

export type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangePreset,
  ScrollRangeValue,
} from "./types";

export async function registerScrollAnimation(
  options: ScrollAnimationOptions
): Promise<() => void> {
  const player = new ScrollPlayer(options);
  await player.init();
  return () => player.destroy();
}
