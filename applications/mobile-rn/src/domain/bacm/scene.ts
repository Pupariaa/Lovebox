import type { FontId } from "./font";

export type LayerType = "text" | "icon" | "photo";
export type BgType = "color" | "image";

export type MessageLayer = {
  id: string;
  type: LayerType;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fontSize: number;
  fontId: FontId;
  align: "left" | "center" | "right";
  ref: string;
  size: number;
  anim: boolean;
  fps: number;
  imageUri: string | null;
  hidden: boolean;
};

export type MessageScene = {
  bgType: BgType;
  bgColor: string;
  bgImageUri: string | null;
  layers: MessageLayer[];
};

export function createLayer(partial: Partial<MessageLayer> & { id: string; type: LayerType }): MessageLayer {
  return {
    text: "",
    x: 0,
    y: 0,
    w: 280,
    h: 36,
    color: "#e09090",
    fontSize: 22,
    fontId: "poppins",
    align: "center",
    ref: "",
    size: 64,
    anim: false,
    fps: 12,
    imageUri: null,
    hidden: false,
    ...partial,
  };
}

export function createDefaultScene(): MessageScene {
  return {
    bgType: "color",
    bgColor: "#120310",
    bgImageUri: null,
    layers: [
      createLayer({
        id: "t1",
        type: "text",
        text: "Je pense à toi",
        y: 100,
        h: 40,
        color: "#FFF5F0",
      }),
    ],
  };
}
