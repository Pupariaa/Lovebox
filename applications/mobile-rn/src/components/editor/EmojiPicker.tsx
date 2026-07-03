import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { AppText, TextField } from "@/components/ui";
import {
  EMOJI_CATEGORIES,
  emojiRef,
  fluentIconUrl,
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
const PAGE = 40;

type Props = {
  onSelect: (ref: string) => void;
};

export function EmojiPicker({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE);

  const categories = useMemo(() => ["all", ...EMOJI_CATEGORIES], []);

  const allResults = useMemo(
    () => searchEmojis(query, category, query.trim() ? 300 : 500),
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

  const renderItem = useCallback(
    ({ item }: { item: FluentManifestIcon }) => {
      const uri = fluentIconUrl(item.id);
      return (
        <Pressable style={styles.cell} onPress={() => onSelect(emojiRef(item.id))}>
          {uri ? (
            <Image source={{ uri }} style={styles.thumb} contentFit="contain" />
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}
        </Pressable>
      );
    },
    [onSelect],
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
        {allResults.length} emojis animés
      </AppText>
    </View>
  );

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={5}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
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
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  thumbPlaceholder: {
    width: THUMB,
    height: THUMB,
    backgroundColor: colors.outline,
    opacity: 0.3,
    borderRadius: radius.sm,
  },
  footer: {
    marginVertical: spacing.md,
  },
});
