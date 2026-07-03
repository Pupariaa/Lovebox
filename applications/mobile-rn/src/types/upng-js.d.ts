declare module "upng-js" {
  export interface UPNGFrame {
    rect: { x: number; y: number; width: number; height: number };
    delay: number;
    dispose: number;
    blend: number;
    data?: Uint8Array;
  }

  export interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UPNGFrame[];
    tabs: { acTL?: { num_frames: number; num_plays: number } } & Record<string, unknown>;
    data: Uint8Array;
  }

  export function decode(buffer: ArrayBuffer): UPNGImage;
  export function toRGBA8(image: UPNGImage): ArrayBuffer[];

  const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default UPNG;
}
