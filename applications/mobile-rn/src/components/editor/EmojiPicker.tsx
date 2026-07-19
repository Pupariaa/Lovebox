import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewToken,
} from "react-native";
import { AppText, TextField } from "@/components/ui";
import { EmojiThumb } from "@/components/editor/EmojiThumb";
import {
  EMOJI_CATEGORIES,
  emojiRef,
  searchEmojis,
  type FluentManifestIcon,
} from "@/domain/bacm/fluentEmoji";
import { colors, radius, spacing } from "@/theme/theme";

const CATEGORY_LABELS: Record<string, string> = {
  all: "Tout",
  "smileys-&-emotion": "Smileys",
  "people-&-body": "Personnes",
  "animals-&-nature": "Animaux",
  "food-&-drink": "Nourriture",
  activities: "Activités",
  "travel-&-places": "Voyages",
  objects: "Objets",
  flags: "Drapeaux",
  other: "Autres",
};

const COLUMNS = 5;
const THUMB = 46;
const PAGE = 60;

type Props = {
  onSelect: (ref: string) => void;
};

type CellProps = {
  item: FluentManifestIcon;
  onSelect: (ref: string) => void;
  animate: boolean;
};

// Memoized so a scroll that only flips which cells are on screen re-renders just the cells whose
// `animate` flag actually changed, not the whole visible window.
const EmojiCell = memo(
  function EmojiCell({ item, onSelect, animate }: CellProps) {
    return (
      <Pressable style={styles.cell} onPress={() => onSelect(emojiRef(item.id))}>
        <EmojiThumb
          refId={emojiRef(item.id)}
          size={THUMB}
          bgColor={colors.surfaceDark}
          animate={animate}
        />
      </Pressable>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.animate === next.animate &&
    prev.onSelect === next.onSelect,
);

export function EmojiPicker({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => ["all", ...EMOJI_CATEGORIES], []);

  const allResults = useMemo(
    () => searchEmojis(query, category, query.trim() ? 400 : 800),
    [query, category],
  );

  const results = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount],
  );

  const loadMore = useCallback(() => {
    if (visibleCount < allResults.length) {
      setVisibleCount((c) => Math.min(c + PAGE, allResults.length));
    }
  }, [visibleCount, allResults.length]);

  const onQueryChange = (text: string) => {
    setQuery(text);
    setVisibleCount(PAGE);
  };

  const onCategoryChange = (cat: string) => {
    setCategory(cat);
    setVisibleCount(PAGE);
  };

  // Stable refs: React Native forbids changing these props across renders.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 40,
    minimumViewTime: 80,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ids = new Set<string>();
      for (const token of viewableItems) {
        if (token.isViewable && token.item) ids.add((token.item as FluentManifestIcon).id);
      }
      setVisibleIds(ids);
    },
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: FluentManifestIcon }) => (
      <EmojiCell item={item} onSelect={onSelect} animate={visibleIds.has(item.id)} />
    ),
    [onSelect, visibleIds],
  );

  const header = (
    <View style={styles.header}>
      <TextField
        placeholder="Rechercher un emoji"
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((item) => (
          <Pressable
            key={item}
            onPress={() => onCategoryChange(item)}
            style={[styles.chip, category === item && styles.chipActive]}
          >
            <AppText
              variant="caption"
              color={category === item ? colors.onPrimary : colors.textMuted}
            >
              {CATEGORY_LABELS[item] ?? item}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
      <AppText variant="caption" muted>
        {allResults.length} emojis animés.
      </AppText>
    </View>
  );

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      extraData={visibleIds}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={30}
      maxToRenderPerBatch={30}
      windowSize={7}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      renderItem={renderItem}
      ListFooterComponent={
        visibleCount < allResults.length ? (
          <ActivityIndicator color={colors.rosePrimary} style={styles.footer} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  chipActive: {
    backgroundColor: colors.rosePrimary,
    borderColor: colors.rosePrimary,
  },
  gridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cell: {
    flex: 1,
    maxWidth: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginVertical: spacing.md,
  },
});
