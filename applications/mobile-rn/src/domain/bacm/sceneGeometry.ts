import { AppConfig } from "@/config/AppConfig";
import type { MessageLayer, MessageScene } from "./scene";

export type LayerRect = { x: number; y: number; w: number; h: number };

export function layerBounds(layer: MessageLayer): LayerRect {
  switch (layer.type) {
    case "text":
    case "photo":
      return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    case "icon":
      return { x: layer.x, y: layer.y, w: layer.size, h: layer.size };
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

export function hitTestLayer(
  layers: MessageLayer[],
  px: number,
  py: number,
): MessageLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.hidden) continue;
    const b = layerBounds(layer);
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return layer;
  }
  return null;
}

export function clampLayerPosition(
  x: number,
  y: number,
  layer: MessageLayer,
): { x: number; y: number } {
  const b = layerBounds(layer);
  const maxX = Math.max(0, AppConfig.MSG_WIDTH - b.w);
  const maxY = Math.max(0, AppConfig.MSG_HEIGHT - b.h);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

export function nextLayerId(layers: MessageLayer[], prefix: string): string {
  const nums = layers
    .filter((l) => l.id.startsWith(prefix))
    .map((l) => parseInt(l.id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${max + 1}`;
}

export function sceneVisualKey(scene: MessageScene): string {
  let out = `${scene.bgColor}|${scene.bgType}|${scene.bgImageUri ?? ""}|`;
  for (const l of scene.layers) {
    out += `${l.id}:${l.type}:${l.hidden}:${l.text}:${l.ref}:${l.w}:${l.h}:${l.size}:${l.color}:${l.fontSize}:${l.fontId}:${l.align}:${l.anim}:${l.imageUri ?? ""};`;
  }
  return out;
}

export function scenePositionKey(scene: MessageScene): string {
  return scene.layers.map((l) => `${l.id}:${l.x},${l.y}`).join(";");
}
