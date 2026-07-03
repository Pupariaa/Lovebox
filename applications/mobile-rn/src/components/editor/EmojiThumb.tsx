import { useEffect, useState } from "react";
import {
  AlphaType,
  Canvas,
  ColorType,
  Image as SkiaImage,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { loadThumbnail } from "@/domain/bacm/emojiFrameLoader";
import { rgb565ToRgba } from "@/domain/bacm/scenePreview";
import { compositeFrameOnBg } from "@/domain/bacm/composite";
import { hexTo565 } from "@/domain/bacm/rgb565";

type Props = {
  refId: string;
  size: number;
  bgColor?: string;
};

function makeImage(pixels: Uint16Array, side: number): SkImage | null {
  const rgba = rgb565ToRgba(pixels);
  const data = Skia.Data.fromBytes(rgba);
  return Skia.Image.MakeImage(
    { width: side, height: side, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Opaque },
    data,
    side * 4,
  );
}

export function EmojiThumb({ refId, size, bgColor = "#2E141C" }: Props) {
  const [image, setImage] = useState<SkImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const frame = await loadThumbnail(refId, size);
      if (cancelled || !frame) return;
      const bg = new Uint16Array(size * size).fill(hexTo565(bgColor));
      compositeFrameOnBg(bg, size, size, frame.pixels, frame.side, frame.side, frame.alpha, 0, 0, size, size);
      setImage(makeImage(bg, size));
    })();
    return () => {
      cancelled = true;
    };
  }, [refId, size, bgColor]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {image ? <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="fill" /> : null}
    </Canvas>
  );
}
