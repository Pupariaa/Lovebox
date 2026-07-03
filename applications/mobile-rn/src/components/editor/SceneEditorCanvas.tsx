import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Canvas,
  Image as SkiaImage,
  Rect,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
  type SkImage,
} from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import { loadEmoji } from "@/domain/bacm/emojiFrameLoader";
import { ensureFontsLoaded, fontFor } from "@/domain/bacm/font";
import type { IconFrameData } from "@/domain/bacm/frame";
import { loadSkImage } from "@/domain/bacm/imageLoader";
import {
  clampLayerPosition,
  hitTestLayer,
  layerBounds,
} from "@/domain/bacm/sceneGeometry";
import { SceneRasterizer } from "@/domain/bacm/sceneRasterizer";
import {
  composeBackground,
  makeSkImageFromFrame,
  makeSkImageFromRgb565,
} from "@/domain/bacm/scenePreview";
import type { MessageScene } from "@/domain/bacm/scene";
import { colors, radius } from "@/theme/theme";

const W = AppConfig.MSG_WIDTH;
const H = AppConfig.MSG_HEIGHT;
const HANDLE_SCREEN = 28;
const LINE_RATIO = 1.28;
const TEXT_PAD_X = 10;

type Props = {
  scene: MessageScene;
  onChange: (scene: MessageScene) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  displayWidth: number;
};

type DragState = {
  mode: "move" | "resize";
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startSize: number;
};

type LayerAssets = {
  frames: SkImage[];
  frameCount: number;
  fps: number;
};

function textWidth(font: SkFont, text: string): number {
  if (!text) return 0;
  try {
    const r = font.measureText(text) as unknown;
    if (typeof r === "number") return r;
    if (r && typeof (r as { width: number }).width === "number") {
      return (r as { width: number }).width;
    }
  } catch {
    // ignore
  }
  return text.length * font.getSize() * 0.55;
}

function bgKey(scene: MessageScene): string {
  return `${scene.bgType}|${scene.bgColor}|${scene.bgImageUri ?? ""}`;
}

function layerAssetKey(scene: MessageScene): string {
  return scene.layers
    .map((l) => `${l.id}:${l.type}:${l.ref}:${l.size}:${l.w}:${l.h}:${l.imageUri ?? ""}`)
    .join(";");
}

function framesToSkImages(frames: IconFrameData[]): SkImage[] {
  const out: SkImage[] = [];
  for (const frame of frames) {
    const img = makeSkImageFromFrame(frame);
    if (img) out.push(img);
  }
  return out;
}

export function SceneEditorCanvas({
  scene,
  onChange,
  selectedId,
  onSelect,
  displayWidth,
}: Props) {
  const rasterizer = useMemo(() => new SceneRasterizer(), []);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const photosRef = useRef<Map<string, SkImage>>(new Map());
  const iconsRef = useRef<Map<string, LayerAssets>>(new Map());
  const dragState = useRef<DragState | null>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  const [baseImage, setBaseImage] = useState<SkImage | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [assetsTick, setAssetsTick] = useState(0);
  const [fontsTick, setFontsTick] = useState(0);
  const [animFps, setAnimFps] = useState(0);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

  const scale = displayWidth / W;
  const displayHeight = displayWidth * (H / W);
  const backgroundKey = bgKey(scene);
  const assetsKey = layerAssetKey(scene);

  useEffect(() => {
    let cancelled = false;
    ensureFontsLoaded().then(() => {
      if (!cancelled) setFontsTick((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const photos = new Map<string, SkImage>();
      const icons = new Map<string, LayerAssets>();
      let maxFps = 0;

      for (const layer of scene.layers) {
        if (layer.type === "photo" && layer.imageUri) {
          const img = await loadSkImage(layer.imageUri);
          if (img) photos.set(layer.imageUri, img);
        } else if (layer.type === "icon" && layer.ref) {
          const emoji = await loadEmoji(layer.ref, layer.size);
          if (emoji && emoji.frames.length > 0) {
            icons.set(layer.id, {
              frames: framesToSkImages(emoji.frames),
              frameCount: emoji.frames.length,
              fps: emoji.fps,
            });
            if (emoji.animated && emoji.frames.length > 1) {
              maxFps = Math.max(maxFps, emoji.fps);
            }
          }
        }
      }

      let bgImg: SkImage | null = null;
      if (scene.bgType === "image" && scene.bgImageUri) {
        bgImg = await loadSkImage(scene.bgImageUri);
      }

      if (cancelled) return;
      photosRef.current = photos;
      iconsRef.current = icons;
      setAnimFps(maxFps);

      const pixels = composeBackground(scene, rasterizer, bgImg);
      setBaseImage(makeSkImageFromRgb565(pixels));
      setAssetsTick((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundKey, assetsKey]);

  useEffect(() => {
    if (animFps <= 0) return;
    const interval = Math.max(66, Math.round(1000 / animFps));
    const timer = setInterval(() => setFrameIndex((i) => i + 1), interval);
    return () => clearInterval(timer);
  }, [animFps]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin((e) => {
          const sx = e.x / scale;
          const sy = e.y / scale;
          const currentScene = sceneRef.current;
          const current = selectedId
            ? currentScene.layers.find((l) => l.id === selectedId) ?? null
            : null;
          const handleSize = HANDLE_SCREEN / scale;

          if (current) {
            const b = layerBounds(current);
            const hx = b.x + b.w;
            const hy = b.y + b.h;
            const resizable = current.type !== "text";
            if (
              resizable &&
              sx >= hx - handleSize &&
              sx <= hx + handleSize &&
              sy >= hy - handleSize &&
              sy <= hy + handleSize
            ) {
              dragState.current = {
                mode: "resize",
                id: current.id,
                startX: current.x,
                startY: current.y,
                startW: current.w,
                startH: current.h,
                startSize: current.size,
              };
              setDragOffset({ dx: 0, dy: 0 });
              dragOffsetRef.current = { dx: 0, dy: 0 };
              return;
            }
          }

          const hit = hitTestLayer(currentScene.layers, Math.round(sx), Math.round(sy));
          if (hit) {
            onSelect(hit.id);
            dragState.current = {
              mode: "move",
              id: hit.id,
              startX: hit.x,
              startY: hit.y,
              startW: hit.w,
              startH: hit.h,
              startSize: hit.size,
            };
            dragOffsetRef.current = { dx: 0, dy: 0 };
            setDragOffset({ dx: 0, dy: 0 });
          } else {
            onSelect(null);
            dragState.current = null;
            dragOffsetRef.current = { dx: 0, dy: 0 };
            setDragOffset(null);
          }
        })
        .onUpdate((e) => {
          const drag = dragState.current;
          if (!drag) return;
          const dx = e.translationX / scale;
          const dy = e.translationY / scale;
          dragOffsetRef.current = { dx, dy };
          setDragOffset({ dx, dy });
        })
        .onFinalize(() => {
          const drag = dragState.current;
          const currentScene = sceneRef.current;
          if (!drag) return;

          const { dx, dy } = dragOffsetRef.current;
          dragState.current = null;
          dragOffsetRef.current = { dx: 0, dy: 0 };
          setDragOffset(null);

          const layer = currentScene.layers.find((l) => l.id === drag.id);
          if (!layer) return;

          if (drag.mode === "resize") {
            if (layer.type === "icon") {
              const delta = (dx + dy) / 2;
              const size = Math.max(16, Math.min(128, Math.round(drag.startSize + delta)));
              onChange({
                ...currentScene,
                layers: currentScene.layers.map((l) =>
                  l.id === drag.id ? { ...l, size } : l,
                ),
              });
            } else if (layer.type === "photo") {
              const ratio = drag.startH / drag.startW;
              const w = Math.max(24, Math.min(W, Math.round(drag.startW + dx)));
              const h = Math.max(24, Math.min(H, Math.round(w * ratio)));
              onChange({
                ...currentScene,
                layers: currentScene.layers.map((l) =>
                  l.id === drag.id ? { ...l, w, h } : l,
                ),
              });
            }
            return;
          }

          const nx = Math.round(drag.startX + dx);
          const ny = Math.round(drag.startY + dy);
          const clamped = clampLayerPosition(nx, ny, layer);
          onChange({
            ...currentScene,
            layers: currentScene.layers.map((l) =>
              l.id === drag.id ? { ...l, x: clamped.x, y: clamped.y } : l,
            ),
          });
        }),
    [scale, selectedId, onChange, onSelect],
  );

  const dragLayerId = dragOffset ? dragState.current?.id ?? null : null;
  const dragDx = dragOffset?.dx ?? 0;
  const dragDy = dragOffset?.dy ?? 0;

  const layerNodes = useMemo(() => {
    void assetsTick;
    void frameIndex;
    void fontsTick;
    const nodes: React.ReactNode[] = [];

    for (const layer of scene.layers) {
      if (layer.hidden) continue;
      const isDragging = layer.id === dragLayerId;
      const ox = (layer.x + (isDragging ? dragDx : 0)) * scale;
      const oy = (layer.y + (isDragging ? dragDy : 0)) * scale;

      if (layer.type === "photo" && layer.imageUri) {
        const img = photosRef.current.get(layer.imageUri);
        if (!img) continue;
        nodes.push(
          <SkiaImage
            key={layer.id}
            image={img}
            x={ox}
            y={oy}
            width={layer.w * scale}
            height={layer.h * scale}
            fit="cover"
          />,
        );
      } else if (layer.type === "icon") {
        const assets = iconsRef.current.get(layer.id);
        if (!assets || assets.frames.length === 0) continue;
        const idx = frameIndex % assets.frameCount;
        const frameImg = assets.frames[idx] ?? assets.frames[0];
        if (!frameImg) continue;
        nodes.push(
          <SkiaImage
            key={layer.id}
            image={frameImg}
            x={ox}
            y={oy}
            width={layer.size * scale}
            height={layer.size * scale}
            fit="contain"
          />,
        );
      } else if (layer.type === "text" && layer.text) {
        const fontSize = layer.fontSize * scale;
        const font = fontFor(layer.fontId, fontSize);
        const m = font.getMetrics();
        const ascent = m ? -m.ascent : fontSize * 0.8;
        const descent = m ? m.descent : fontSize * 0.2;
        const lh = layer.fontSize * LINE_RATIO * scale;
        const lines = layer.text.split("\n");
        const blockTop = oy + (layer.h * scale - lines.length * lh) / 2;
        const pad = TEXT_PAD_X * scale;
        lines.forEach((line, i) => {
          if (!line) return;
          const cellTop = blockTop + i * lh;
          const baseline = cellTop + (lh - (ascent + descent)) / 2 + ascent;
          const lw = textWidth(font, line);
          let x: number;
          if (layer.align === "left") x = ox + pad;
          else if (layer.align === "right") x = ox + layer.w * scale - pad - lw;
          else x = ox + (layer.w * scale - lw) / 2;
          nodes.push(
            <SkiaText
              key={`${layer.id}-${i}`}
              x={x}
              y={baseline}
              text={line}
              font={font}
              color={layer.color}
            />,
          );
        });
      }
    }
    return nodes;
  }, [scene.layers, scale, assetsTick, frameIndex, fontsTick, dragLayerId, dragDx, dragDy]);

  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;
  let selBounds = selected ? layerBounds(selected) : null;
  if (selBounds && selected?.id === dragLayerId) {
    selBounds = {
      ...selBounds,
      x: selBounds.x + dragDx,
      y: selBounds.y + dragDy,
    };
  }
  const showHandle = selected != null && selected.type !== "text";

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrap, { width: displayWidth, height: displayHeight }]}>
        <Canvas style={{ width: displayWidth, height: displayHeight }}>
          {baseImage ? (
            <SkiaImage
              image={baseImage}
              x={0}
              y={0}
              width={displayWidth}
              height={displayHeight}
              fit="fill"
            />
          ) : null}
          {layerNodes}
          {selBounds ? (
            <RoundedRect
              x={selBounds.x * scale - 1}
              y={selBounds.y * scale - 1}
              width={selBounds.w * scale + 2}
              height={selBounds.h * scale + 2}
              r={6}
              color={colors.rosePrimary}
              style="stroke"
              strokeWidth={2}
            />
          ) : null}
          {selBounds && showHandle ? (
            <Rect
              x={(selBounds.x + selBounds.w) * scale - 9}
              y={(selBounds.y + selBounds.h) * scale - 9}
              width={18}
              height={18}
              color={colors.rosePrimary}
            />
          ) : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "#000",
  },
});
