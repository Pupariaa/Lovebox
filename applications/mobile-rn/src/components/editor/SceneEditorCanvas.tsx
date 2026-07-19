import { memo, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Rect,
  RoundedRect,
  Text as SkiaText,
  useClock,
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
import { measureTextBox, SceneRasterizer } from "@/domain/bacm/sceneRasterizer";
import {
  composeBackground,
  makeSkImageFromFrame,
  makeSkImageFromRgb565,
} from "@/domain/bacm/scenePreview";
import {
  hasEmoji,
  segmentEmojiText,
  twemojiRefToCodePoints,
  twemojiUrl,
} from "@/domain/bacm/twemoji";
import type { MessageLayer, MessageScene } from "@/domain/bacm/scene";

const EMOJI_ADVANCE_RATIO = 1.12;
import { colors, radius } from "@/theme/theme";

const W = AppConfig.MSG_WIDTH;
const H = AppConfig.MSG_HEIGHT;
const HANDLE_SCREEN = 28;
const LINE_RATIO = 1.28;
const TEXT_PAD_X = 10;

type DragMode = "move" | "resize" | null;

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

type SceneAssets = {
  photos: Map<string, SkImage>;
  icons: Map<string, LayerAssets>;
  emoji: Map<string, SkImage>;
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
    .map(
      (l) =>
        `${l.id}:${l.type}:${l.ref}:${l.size}:${l.w}:${l.h}:${l.imageUri ?? ""}:${l.type === "text" ? l.text ?? "" : ""}`,
    )
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

type LayerNodeProps = {
  layer: MessageLayer;
  scale: number;
  photo: SkImage | null;
  assets: LayerAssets | null;
  emojiImages: Map<string, SkImage>;
  clock: SharedValue<number>;
  draggingId: SharedValue<string | null>;
  dragMode: SharedValue<DragMode>;
  dragTx: SharedValue<number>;
  dragTy: SharedValue<number>;
  isSelected: boolean;
  gScale: SharedValue<number>;
  gRotate: SharedValue<number>;
  fontsTick: number;
};

const LayerNode = memo(function LayerNode({
  layer,
  scale,
  photo,
  assets,
  emojiImages,
  clock,
  draggingId,
  dragMode,
  dragTx,
  dragTy,
  isSelected,
  gScale,
  gRotate,
  fontsTick,
}: LayerNodeProps) {
  void fontsTick;

  const rotateRad = (layer.rotation * Math.PI) / 180;
  const cW = layer.type === "icon" ? layer.size : layer.w;
  const cH = layer.type === "icon" ? layer.size : layer.h;
  const originX = (layer.x + cW / 2) * scale;
  const originY = (layer.y + cH / 2) * scale;

  const transform = useDerivedValue(() => {
    const active = draggingId.value === layer.id && dragMode.value === "move";
    return [
      { translateX: active ? dragTx.value * scale : 0 },
      { translateY: active ? dragTy.value * scale : 0 },
      { scale: isSelected ? gScale.value : 1 },
      { rotate: rotateRad + (isSelected ? gRotate.value : 0) },
    ];
  });

  const frameImg = useDerivedValue(() => {
    if (!assets || assets.frameCount === 0) return null;
    if (assets.frameCount === 1) return assets.frames[0];
    const period = 1000 / Math.max(1, assets.fps || 12);
    const idx = Math.floor(clock.value / period) % assets.frameCount;
    return assets.frames[idx] ?? assets.frames[0];
  });

  const x = layer.x * scale;
  const y = layer.y * scale;

  if (layer.type === "photo") {
    if (!photo) return null;
    return (
      <Group transform={transform} origin={{ x: originX, y: originY }}>
        <SkiaImage
          image={photo}
          x={x}
          y={y}
          width={layer.w * scale}
          height={layer.h * scale}
          fit="cover"
        />
      </Group>
    );
  }

  if (layer.type === "icon") {
    if (!assets || assets.frames.length === 0) return null;
    return (
      <Group transform={transform} origin={{ x: originX, y: originY }}>
        <SkiaImage
          image={frameImg}
          x={x}
          y={y}
          width={layer.size * scale}
          height={layer.size * scale}
          fit="contain"
        />
      </Group>
    );
  }

  if (layer.type === "text" && layer.text) {
    const fontSize = layer.fontSize * scale;
    const font = fontFor(layer.fontId, fontSize);
    const m = font.getMetrics();
    const ascent = m ? -m.ascent : fontSize * 0.8;
    const descent = m ? m.descent : fontSize * 0.2;
    const lh = layer.fontSize * LINE_RATIO * scale;
    const lines = layer.text.split("\n");
    const blockTop = y + (layer.h * scale - lines.length * lh) / 2;
    const pad = TEXT_PAD_X * scale;
    const emojiSize = fontSize;
    const emojiAdvance = fontSize * EMOJI_ADVANCE_RATIO;
    const lineWidth = (line: string): number => {
      if (!hasEmoji(line)) return textWidth(font, line);
      let w = 0;
      for (const seg of segmentEmojiText(line)) {
        if (seg.kind === "text") w += textWidth(font, seg.value);
        else w += emojiAdvance;
      }
      return w;
    };
    const nodes: React.ReactNode[] = [];
    lines.forEach((line, i) => {
      if (!line) return;
      const cellTop = blockTop + i * lh;
      const baseline = cellTop + (lh - (ascent + descent)) / 2 + ascent;
      const lw = lineWidth(line);
      let tx: number;
      if (layer.align === "left") tx = x + pad;
      else if (layer.align === "right") tx = x + layer.w * scale - pad - lw;
      else tx = x + (layer.w * scale - lw) / 2;

      if (!hasEmoji(line)) {
        nodes.push(
          <SkiaText
            key={`${layer.id}-${i}`}
            x={tx}
            y={baseline}
            text={line}
            font={font}
            color={layer.color}
          />,
        );
        return;
      }

      let penX = tx;
      let segIdx = 0;
      for (const seg of segmentEmojiText(line)) {
        if (seg.kind === "text") {
          nodes.push(
            <SkiaText
              key={`${layer.id}-${i}-${segIdx}`}
              x={penX}
              y={baseline}
              text={seg.value}
              font={font}
              color={layer.color}
            />,
          );
          penX += textWidth(font, seg.value);
        } else {
          const img = emojiImages.get(seg.ref);
          if (img) {
            const top = baseline - ascent + (ascent + descent - emojiSize) / 2;
            nodes.push(
              <SkiaImage
                key={`${layer.id}-${i}-${segIdx}`}
                image={img}
                x={penX + (emojiAdvance - emojiSize) / 2}
                y={top}
                width={emojiSize}
                height={emojiSize}
                fit="contain"
              />,
            );
          }
          penX += emojiAdvance;
        }
        segIdx += 1;
      }
    });
    return (
      <Group transform={transform} origin={{ x: originX, y: originY }}>
        {nodes}
      </Group>
    );
  }

  return null;
});

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

  const dragState = useRef<DragState | null>(null);

  const clock = useClock();
  const draggingId = useSharedValue<string | null>(null);
  const dragMode = useSharedValue<DragMode>(null);
  const dragTx = useSharedValue(0);
  const dragTy = useSharedValue(0);
  const gScale = useSharedValue(1);
  const gRotate = useSharedValue(0);

  const [baseImage, setBaseImage] = useState<SkImage | null>(null);
  const [assets, setAssets] = useState<SceneAssets>({
    photos: new Map(),
    icons: new Map(),
    emoji: new Map(),
  });
  const [fontsTick, setFontsTick] = useState(0);

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
      const emojiRefs = new Set<string>();

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
          }
        } else if (layer.type === "text" && layer.text && hasEmoji(layer.text)) {
          for (const seg of segmentEmojiText(layer.text)) {
            if (seg.kind === "emoji") emojiRefs.add(seg.ref);
          }
        }
      }

      const emoji = new Map<string, SkImage>();
      await Promise.all(
        Array.from(emojiRefs).map(async (ref) => {
          const img = await loadSkImage(twemojiUrl(twemojiRefToCodePoints(ref)));
          if (img) emoji.set(ref, img);
        }),
      );

      let bgImg: SkImage | null = null;
      if (scene.bgType === "image" && scene.bgImageUri) {
        bgImg = await loadSkImage(scene.bgImageUri);
      }

      if (cancelled) return;
      const pixels = composeBackground(scene, rasterizer, bgImg);
      setBaseImage(makeSkImageFromRgb565(pixels));
      setAssets({ photos, icons, emoji });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundKey, assetsKey]);

  const beginDrag = (sx: number, sy: number) => {
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
        draggingId.value = current.id;
        dragMode.value = "resize";
        dragTx.value = 0;
        dragTy.value = 0;
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
      draggingId.value = hit.id;
      dragMode.value = "move";
      dragTx.value = 0;
      dragTy.value = 0;
    } else {
      onSelect(null);
      dragState.current = null;
      draggingId.value = null;
      dragMode.value = null;
      dragTx.value = 0;
      dragTy.value = 0;
    }
  };

  const finishDrag = (dx: number, dy: number) => {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    const currentScene = sceneRef.current;
    const layer = currentScene.layers.find((l) => l.id === drag.id);
    if (!layer) return;

    if (drag.mode === "resize") {
      if (layer.type === "icon") {
        const delta = (dx + dy) / 2;
        const size = Math.max(16, Math.min(128, Math.round(drag.startSize + delta)));
        onChange({
          ...currentScene,
          layers: currentScene.layers.map((l) => (l.id === drag.id ? { ...l, size } : l)),
        });
      } else if (layer.type === "photo") {
        const ratio = drag.startH / drag.startW;
        const w = Math.max(24, Math.min(W, Math.round(drag.startW + dx)));
        const h = Math.max(24, Math.min(H, Math.round(w * ratio)));
        onChange({
          ...currentScene,
          layers: currentScene.layers.map((l) => (l.id === drag.id ? { ...l, w, h } : l)),
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
  };

  const commitScale = (factor: number) => {
    if (!selectedId || factor === 1) return;
    const currentScene = sceneRef.current;
    const layer = currentScene.layers.find((l) => l.id === selectedId);
    if (!layer) return;
    if (layer.type === "text") {
      const fontSize = Math.max(10, Math.min(120, Math.round(layer.fontSize * factor)));
      const { w, h } = measureTextBox(layer.text, fontSize, layer.fontId);
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      const x = Math.round(cx - w / 2);
      const y = Math.round(cy - h / 2);
      onChange({
        ...currentScene,
        layers: currentScene.layers.map((l) =>
          l.id === selectedId ? { ...l, fontSize, w, h, x, y } : l,
        ),
      });
    } else if (layer.type === "icon") {
      const size = Math.max(16, Math.min(200, Math.round(layer.size * factor)));
      const cx = layer.x + layer.size / 2;
      const cy = layer.y + layer.size / 2;
      const x = Math.round(cx - size / 2);
      const y = Math.round(cy - size / 2);
      onChange({
        ...currentScene,
        layers: currentScene.layers.map((l) =>
          l.id === selectedId ? { ...l, size, x, y } : l,
        ),
      });
    } else if (layer.type === "photo") {
      const w = Math.max(24, Math.min(W, Math.round(layer.w * factor)));
      const h = Math.max(24, Math.min(H, Math.round(layer.h * factor)));
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      const x = Math.round(cx - w / 2);
      const y = Math.round(cy - h / 2);
      onChange({
        ...currentScene,
        layers: currentScene.layers.map((l) =>
          l.id === selectedId ? { ...l, w, h, x, y } : l,
        ),
      });
    }
  };

  const commitRotate = (radDelta: number) => {
    if (!selectedId || radDelta === 0) return;
    const currentScene = sceneRef.current;
    const layer = currentScene.layers.find((l) => l.id === selectedId);
    if (!layer) return;
    const deg = layer.rotation + (radDelta * 180) / Math.PI;
    const norm = ((deg % 360) + 360) % 360;
    onChange({
      ...currentScene,
      layers: currentScene.layers.map((l) =>
        l.id === selectedId ? { ...l, rotation: Math.round(norm) } : l,
      ),
    });
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          const sx = e.x / scale;
          const sy = e.y / scale;
          runOnJS(beginDrag)(sx, sy);
        })
        .onUpdate((e) => {
          if (draggingId.value === null) return;
          dragTx.value = e.translationX / scale;
          dragTy.value = e.translationY / scale;
        })
        .onFinalize(() => {
          const dx = dragTx.value;
          const dy = dragTy.value;
          const had = draggingId.value !== null;
          draggingId.value = null;
          dragMode.value = null;
          dragTx.value = 0;
          dragTy.value = 0;
          if (had) runOnJS(finishDrag)(dx, dy);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, selectedId, onChange, onSelect],
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(selectedId != null)
        .onUpdate((e) => {
          gScale.value = e.scale;
        })
        .onEnd(() => {
          runOnJS(commitScale)(gScale.value);
        })
        .onFinalize(() => {
          gScale.value = 1;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, onChange],
  );

  const rotationGesture = useMemo(
    () =>
      Gesture.Rotation()
        .enabled(selectedId != null)
        .onUpdate((e) => {
          gRotate.value = e.rotation;
        })
        .onEnd(() => {
          runOnJS(commitRotate)(gRotate.value);
        })
        .onFinalize(() => {
          gRotate.value = 0;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, onChange],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(pan, pinch, rotationGesture),
    [pan, pinch, rotationGesture],
  );

  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;
  const selBounds = selected ? layerBounds(selected) : null;
  const showHandle = selected != null && selected.type !== "text";
  const selRotateRad = selected ? (selected.rotation * Math.PI) / 180 : 0;
  const selCW = selected ? (selected.type === "icon" ? selected.size : selected.w) : 0;
  const selCH = selected ? (selected.type === "icon" ? selected.size : selected.h) : 0;
  const selOriginX = selected ? (selected.x + selCW / 2) * scale : 0;
  const selOriginY = selected ? (selected.y + selCH / 2) * scale : 0;

  const selTransform = useDerivedValue(() => {
    const active = draggingId.value === selectedId && dragMode.value === "move";
    return [
      { translateX: active ? dragTx.value * scale : 0 },
      { translateY: active ? dragTy.value * scale : 0 },
      { scale: gScale.value },
      { rotate: selRotateRad + gRotate.value },
    ];
  });

  return (
    <GestureDetector gesture={composedGesture}>
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
          {scene.layers.map((layer) =>
            layer.hidden ? null : (
              <LayerNode
                key={layer.id}
                layer={layer}
                scale={scale}
                photo={layer.type === "photo" && layer.imageUri ? assets.photos.get(layer.imageUri) ?? null : null}
                assets={layer.type === "icon" ? assets.icons.get(layer.id) ?? null : null}
                emojiImages={assets.emoji}
                clock={clock}
                draggingId={draggingId}
                dragMode={dragMode}
                dragTx={dragTx}
                dragTy={dragTy}
                isSelected={layer.id === selectedId}
                gScale={gScale}
                gRotate={gRotate}
                fontsTick={fontsTick}
              />
            ),
          )}
          {selBounds ? (
            <Group transform={selTransform} origin={{ x: selOriginX, y: selOriginY }}>
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
              {showHandle ? (
                <Rect
                  x={(selBounds.x + selBounds.w) * scale - 9}
                  y={(selBounds.y + selBounds.h) * scale - 9}
                  width={18}
                  height={18}
                  color={colors.rosePrimary}
                />
              ) : null}
            </Group>
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
