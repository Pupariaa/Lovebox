import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/components/ui";
import { parseWifiQr } from "@/domain/wifi/wifiQr";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (payload: { ssid: string; password: string }) => void;
};

type CameraModule = typeof import("expo-camera");

function WifiQrScannerCamera({
  onClose,
  onScanned,
  camera,
}: {
  onClose: () => void;
  onScanned: (payload: { ssid: string; password: string }) => void;
  camera: CameraModule;
}) {
  const { CameraView, useCameraPermissions } = camera;
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handleBarcode = useCallback(
    (raw: string) => {
      if (locked) return;
      const payload = parseWifiQr(raw);
      if (!payload) return;
      setLocked(true);
      onScanned({ ssid: payload.ssid, password: payload.password });
      onClose();
      setTimeout(() => setLocked(false), 800);
    },
    [locked, onClose, onScanned],
  );

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <AppText variant="bodyMedium" muted center style={styles.hint}>
          Autorise la caméra pour lire le QR code affiché sur ta box ou sur l'étiquette du routeur.
        </AppText>
        <Button label="Autoriser la caméra" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => handleBarcode(data)}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <AppText variant="caption" muted center style={styles.overlayHint}>
          Cadre le QR code WiFi (format WIFI:...).
        </AppText>
      </View>
    </View>
  );
}

export function WifiQrScanner({ visible, onClose, onScanned }: Props) {
  const [camera, setCamera] = useState<CameraModule | null>(null);
  const [nativeMissing, setNativeMissing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setNativeMissing(false);
    import("expo-camera")
      .then((mod) => {
        if (active) setCamera(mod);
      })
      .catch(() => {
        if (active) setNativeMissing(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </Pressable>
          <AppText variant="titleMedium">Scanner le QR WiFi</AppText>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.rosePrimary} />
          </View>
        ) : null}

        {nativeMissing ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" muted center style={styles.hint}>
              Le scan QR nécessite un dev client recompilé avec expo-camera. Installe le dernier build EAS iOS, puis relance l'app.
            </AppText>
            <Button label="Fermer" onPress={onClose} />
          </View>
        ) : null}

        {camera && !nativeMissing && !loading ? (
          <WifiQrScannerCamera camera={camera} onClose={onClose} onScanned={onScanned} />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.plumBackground,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  headerSpacer: {
    width: 28,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  hint: {
    marginBottom: spacing.md,
  },
  cameraWrap: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: colors.rosePrimary,
    borderRadius: radius.md,
    backgroundColor: "transparent",
  },
  overlayHint: {
    paddingHorizontal: spacing.xl,
  },
});
