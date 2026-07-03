import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { SceneEditorCanvas } from "@/components/editor/SceneEditorCanvas";
import { EmojiPicker } from "@/components/editor/EmojiPicker";
import { SchedulePicker } from "@/components/editor/SchedulePicker";
import { AppConfig } from "@/config/AppConfig";
import { COMPOSER_COLOR_PALETTE } from "@/domain/bacm/emojiCatalog";
import { ensureFontsLoaded, FONTS, type FontId } from "@/domain/bacm/font";
import { emojiToTwemojiRef } from "@/domain/bacm/twemoji";
import { measureTextBox } from "@/domain/bacm/sceneRasterizer";
import { createLayer, type MessageLayer, type MessageScene } from "@/domain/bacm/scene";
import { nextLayerId } from "@/domain/bacm/sceneGeometry";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";
import { targetLabel } from "@/util/formatters";

const W = AppConfig.MSG_WIDTH;
const H = AppConfig.MSG_HEIGHT;

function fitTextLayer(layer: MessageLayer): MessageLayer {
  const { w, h } = measureTextBox(layer.text, layer.fontSize, layer.fontId);
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  let x = Math.round(cx - w / 2);
  let y = Math.round(cy - h / 2);
  x = w >= W ? 0 : Math.max(0, Math.min(W - w, x));
  y = h >= H ? 0 : Math.max(0, Math.min(H - h, y));
  return { ...layer, w, h, x, y };
}

export default function ComposeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scene = useAppStore((s) => s.composerScene);
  const setScene = useAppStore((s) => s.setComposerScene);
  const selectedTarget = useAppStore((s) => s.selectedTarget);
  const linkedTargets = useAppStore((s) => s.linkedTargets);
  const loading = useAppStore((s) => s.loading);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const showSnackbar = useAppStore((s) => s.showSnackbar);
  const composerEphemeral = useAppStore((s) => s.composerEphemeral);
  const setComposerEphemeral = useAppStore((s) => s.setComposerEphemeral);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emojiModal, setEmojiModal] = useState(false);
  const [customEmojiModal, setCustomEmojiModal] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");

  const target = selectedTarget ?? linkedTargets[0] ?? null;
  const displayWidth = Math.min(width - spacing.lg * 2, 340);
  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;

  const update = (next: MessageScene) => setScene(next);

  useEffect(() => {
    let cancelled = false;
    ensureFontsLoaded().then(() => {
      if (cancelled) return;
      const current = useAppStore.getState().composerScene;
      const layers = current.layers.map((l) =>
        l.type === "text" ? fitTextLayer(l) : l,
      );
      useAppStore.getState().setComposerScene({ ...current, layers });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSelected = (patch: Partial<MessageLayer>) => {
    if (!selected) return;
    update({
      ...scene,
      layers: scene.layers.map((l) => {
        if (l.id !== selected.id) return l;
        const next = { ...l, ...patch };
        return next.type === "text" ? fitTextLayer(next) : next;
      }),
    });
  };

  const addText = () => {
    const id = nextLayerId(scene.layers, "t");
    const base = createLayer({
      id,
      type: "text",
      text: "Ton petit mot",
      x: W / 2,
      y: H / 2,
      w: 0,
      h: 0,
      color: "#FFF5F0",
    });
    update({ ...scene, layers: [...scene.layers, fitTextLayer(base)] });
    setSelectedId(id);
  };

  const addIcon = (ref: string, anim: boolean) => {
    const id = nextLayerId(scene.layers, "i");
    const layer = createLayer({
      id,
      type: "icon",
      ref,
      anim,
      x: (W - 72) / 2,
      y: (H - 72) / 2,
      size: 72,
    });
    update({ ...scene, layers: [...scene.layers, layer] });
    setSelectedId(id);
  };

  const addFluentEmoji = (ref: string) => {
    addIcon(ref, true);
    setEmojiModal(false);
  };

  const addCustomEmoji = () => {
    const ref = emojiToTwemojiRef(customEmoji);
    if (!ref) {
      showSnackbar("Aucun emoji détecté");
      return;
    }
    addIcon(ref, false);
    setCustomEmoji("");
    setCustomEmojiModal(false);
  };

  const addPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const id = nextLayerId(scene.layers, "p");
    const layer = createLayer({
      id,
      type: "photo",
      imageUri: result.assets[0].uri,
      x: 40,
      y: 40,
      w: 200,
      h: 160,
    });
    update({ ...scene, layers: [...scene.layers, layer] });
    setSelectedId(id);
  };

  const addGif = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isGif =
      asset.mimeType?.includes("gif") ||
      asset.fileName?.toLowerCase().endsWith(".gif") ||
      asset.uri.toLowerCase().includes(".gif");
    if (!isGif) {
      showSnackbar("Choisissez un fichier GIF");
      return;
    }
    addIcon(`gif:${asset.uri}`, true);
  };

  const pickBackgroundImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    update({ ...scene, bgType: "image", bgImageUri: result.assets[0].uri });
  };

  const removeBackgroundImage = () => {
    update({ ...scene, bgType: "color", bgImageUri: null });
  };

  const deleteSelected = () => {
    if (!selected) return;
    update({ ...scene, layers: scene.layers.filter((l) => l.id !== selected.id) });
    setSelectedId(null);
  };

  const onSend = async () => {
    if (!target) {
      showSnackbar("Aucune boîte liée pour recevoir ton message");
      return;
    }
    const ok = await sendMessage();
    if (ok) router.push("/(tabs)/home");
  };

  return (
    <Screen title="Écrire">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.recipientRow}>
          <Ionicons name="heart" size={16} color={target ? colors.rosePrimary : colors.danger} />
          <AppText variant="bodyMedium" color={target ? colors.textMuted : colors.danger}>
            {target ? `Pour la boîte de ${targetLabel(target)}` : "Aucune boîte liée"}
          </AppText>
        </View>

        <View style={styles.canvasWrap}>
          <SceneEditorCanvas
            scene={scene}
            onChange={update}
            selectedId={selectedId}
            onSelect={setSelectedId}
            displayWidth={displayWidth}
          />
          <AppText variant="caption" muted center style={styles.canvasHint}>
            Touchez un élément pour le modifier, glissez pour le déplacer.
          </AppText>
        </View>

        <Card>
          <AppText variant="labelLarge" muted>
            Ajouter
          </AppText>
          <View style={styles.addRow}>
            <AddButton icon="text" label="Texte" onPress={addText} />
            <AddButton icon="happy" label="Emoji" onPress={() => setEmojiModal(true)} />
            <AddButton icon="chatbubble-ellipses" label="Emoji perso" onPress={() => setCustomEmojiModal(true)} />
            <AddButton icon="image" label="Photo" onPress={addPhoto} />
            <AddButton icon="film" label="GIF" onPress={addGif} />
          </View>
        </Card>

        {selected ? (
          <Card>
            <View style={styles.inspectorHeader}>
              <AppText variant="titleMedium">
                {selected.type === "text"
                  ? "Texte"
                  : selected.type === "photo"
                    ? "Photo"
                    : "Emoji / GIF"}
              </AppText>
              <Pressable onPress={deleteSelected} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="trash" size={18} color={colors.danger} />
                <AppText variant="caption" color={colors.danger}>
                  Supprimer
                </AppText>
              </Pressable>
            </View>

            {selected.type === "text" ? (
              <View style={styles.panel}>
                <TextField
                  label="Texte"
                  value={selected.text}
                  onChangeText={(v) => updateSelected({ text: v })}
                  multiline
                />
                <AppText variant="labelLarge" muted>
                  Police
                </AppText>
                <FontRow value={selected.fontId} onSelect={(f) => updateSelected({ fontId: f })} />
                <AppText variant="labelLarge" muted>
                  Couleur
                </AppText>
                <ColorRow value={selected.color} onSelect={(c) => updateSelected({ color: c })} />
                <Stepper
                  label="Taille"
                  value={selected.fontSize}
                  onDec={() => updateSelected({ fontSize: Math.max(12, selected.fontSize - 2) })}
                  onInc={() => updateSelected({ fontSize: Math.min(64, selected.fontSize + 2) })}
                />
                <AlignRow value={selected.align} onSelect={(a) => updateSelected({ align: a })} />
              </View>
            ) : null}

            {selected.type === "icon" ? (
              <View style={styles.panel}>
                <Stepper
                  label="Taille"
                  value={selected.size}
                  onDec={() => updateSelected({ size: Math.max(16, selected.size - 8) })}
                  onInc={() => updateSelected({ size: Math.min(128, selected.size + 8) })}
                />
                <AppText variant="caption" muted>
                  Astuce : glissez le carré rose en bas à droite pour redimensionner.
                </AppText>
              </View>
            ) : null}

            {selected.type === "photo" ? (
              <View style={styles.panel}>
                <Stepper
                  label="Largeur"
                  value={selected.w}
                  onDec={() =>
                    updateSelected({
                      w: Math.max(24, selected.w - 12),
                      h: Math.max(24, Math.round((selected.w - 12) * (selected.h / selected.w))),
                    })
                  }
                  onInc={() =>
                    updateSelected({
                      w: Math.min(W, selected.w + 12),
                      h: Math.min(H, Math.round((selected.w + 12) * (selected.h / selected.w))),
                    })
                  }
                />
                <AppText variant="caption" muted>
                  Astuce : glissez le carré rose en bas à droite pour redimensionner.
                </AppText>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <AppText variant="labelLarge" muted>
            Fond
          </AppText>
          <ColorRow
            value={scene.bgType === "color" ? scene.bgColor : ""}
            onSelect={(c) => update({ ...scene, bgType: "color", bgColor: c, bgImageUri: null })}
          />
          {scene.bgType === "image" && scene.bgImageUri ? (
            <Button
              label="Retirer l'image de fond"
              variant="secondary"
              onPress={removeBackgroundImage}
              icon={<Ionicons name="close-circle" size={16} color={colors.textPrimary} />}
            />
          ) : (
            <Button
              label="Image de fond"
              variant="secondary"
              onPress={pickBackgroundImage}
              icon={<Ionicons name="image" size={16} color={colors.textPrimary} />}
            />
          )}
        </Card>

        <SchedulePicker />

        <Card>
          <View style={styles.optionRow}>
            <View style={styles.optionFlex}>
              <AppText variant="titleMedium">Message éphémère</AppText>
              <AppText variant="caption" muted>
                {composerEphemeral
                  ? "Disparaît 10 secondes après ouverture, sans historique"
                  : "Message classique, visible dans l'historique"}
              </AppText>
            </View>
            <Switch
              value={composerEphemeral}
              onValueChange={setComposerEphemeral}
              trackColor={{ true: colors.rosePrimary, false: colors.outline }}
              thumbColor={colors.creamHighlight}
            />
          </View>
        </Card>

        <Button
          label="Envoyer"
          onPress={onSend}
          loading={loading}
          disabled={!target || loading}
          icon={<Ionicons name="send" size={18} color={colors.onPrimary} />}
        />
      </ScrollView>

      <Modal
        visible={emojiModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEmojiModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEmojiModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <AppText variant="titleMedium">Emojis animés</AppText>
              <Pressable onPress={() => setEmojiModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <EmojiPicker onSelect={addFluentEmoji} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={customEmojiModal}
        animationType="fade"
        transparent
        onRequestClose={() => setCustomEmojiModal(false)}
      >
        <View style={styles.centerBackdrop}>
          <View style={styles.customSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="titleMedium">Emoji du clavier</AppText>
              <Pressable onPress={() => setCustomEmojiModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <AppText variant="bodyMedium" muted>
              Tapez ou collez un emoji depuis le clavier de votre téléphone.
            </AppText>
            <TextField
              value={customEmoji}
              onChangeText={setCustomEmoji}
              placeholder="😍"
              autoCapitalize="none"
            />
            <Button label="Ajouter" onPress={addCustomEmoji} disabled={!customEmoji.trim()} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function AddButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.addBtn}>
      <Ionicons name={icon} size={20} color={colors.rosePrimary} />
      <AppText variant="caption" color={colors.textMuted} center>
        {label}
      </AppText>
    </Pressable>
  );
}

function FontRow({ value, onSelect }: { value: FontId; onSelect: (f: FontId) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fontRow}
    >
      {FONTS.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => onSelect(f.id)}
          style={[styles.fontChip, value === f.id && styles.fontChipActive]}
        >
          <AppText
            variant="titleMedium"
            color={value === f.id ? colors.onPrimary : colors.textPrimary}
            style={{ fontFamily: f.family }}
          >
            {f.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ColorRow({ value, onSelect }: { value: string; onSelect: (c: string) => void }) {
  return (
    <View style={styles.colorRow}>
      {COMPOSER_COLOR_PALETTE.map((c) => (
        <Pressable
          key={c}
          onPress={() => onSelect(c)}
          style={[
            styles.swatch,
            { backgroundColor: c },
            value.toLowerCase() === c.toLowerCase() && styles.swatchActive,
          ]}
        />
      ))}
    </View>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <AppText variant="labelLarge" muted>
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepButton} onPress={onDec}>
          <Ionicons name="remove" size={18} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="titleMedium" style={styles.stepValue}>
          {value}
        </AppText>
        <Pressable style={styles.stepButton} onPress={onInc}>
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function AlignRow({
  value,
  onSelect,
}: {
  value: MessageLayer["align"];
  onSelect: (a: MessageLayer["align"]) => void;
}) {
  const options: { value: MessageLayer["align"]; label: string }[] = [
    { value: "left", label: "Gauche" },
    { value: "center", label: "Centre" },
    { value: "right", label: "Droite" },
  ];
  return (
    <View style={styles.alignRow}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onSelect(o.value)}
          style={[styles.alignButton, value === o.value && styles.alignActive]}
        >
          <AppText
            variant="caption"
            color={value === o.value ? colors.onPrimary : colors.textMuted}
          >
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    alignItems: "stretch",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionFlex: {
    flex: 1,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  canvasWrap: {
    alignItems: "center",
    gap: spacing.sm,
  },
  canvasHint: {
    maxWidth: 260,
  },
  addRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addBtn: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  inspectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  panel: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  fontRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fontChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  fontChipActive: {
    backgroundColor: colors.rosePrimary,
    borderColor: colors.rosePrimary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalSheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    height: "82%",
  },
  centerBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  customSheet: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: {
    borderColor: colors.creamHighlight,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outline,
  },
  stepValue: {
    minWidth: 36,
    textAlign: "center",
  },
  alignRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  alignButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  alignActive: {
    backgroundColor: colors.rosePrimary,
    borderColor: colors.rosePrimary,
  },
});
