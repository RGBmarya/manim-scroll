import { ScrollPlayer } from "./player";
import { NativeTextPlayer, registerNativeAnimation } from "./native-player";
import type { ScrollAnimationOptions, NativeAnimationOptions } from "./types";

export type {
  RenderManifest,
  ScrollAnimationOptions,
  ScrollRange,
  ScrollRangePreset,
  ScrollRangeValue,
  NativeAnimationOptions,
} from "./types";

export { NativeTextPlayer, registerNativeAnimation };

export async function registerScrollAnimation(
  options: ScrollAnimationOptions
): Promise<() => void> {
  const player = new ScrollPlayer(options);
  await player.init();
  return () => player.destroy();
}
