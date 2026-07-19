import { View } from "react-native";
import { Image } from "expo-image";
import { fluentIconUrl } from "@/domain/bacm/fluentEmoji";

type Props = {
  refId: string;
  size: number;
  bgColor?: string;
  animate?: boolean;
};

// Renders the animated emoji directly through expo-image. Native decoding (Glide/SDWebImage)
// plays the APNG off the JS thread and caches it to disk. `animate` maps to expo-image's
// autoplay: when false the first frame is shown as a cheap static thumbnail, so the grid renders
// instantly and only the cells currently on screen actually animate.
export function EmojiThumb({ refId, size, bgColor = "#2E141C", animate = false }: Props) {
  const uri = fluentIconUrl(refId);
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          autoplay={animate}
          recyclingKey={refId}
        />
      ) : null}
    </View>
  );
}
