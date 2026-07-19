import { useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";

function toApiFormat(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function SchedulePicker() {
  const scheduledSendAt = useAppStore((s) => s.scheduledSendAt);
  const setScheduledSendAt = useAppStore((s) => s.setScheduledSendAt);
  const [date, setDate] = useState<Date>(() => new Date(Date.now() + 3600 * 1000));
  const [iosVisible, setIosVisible] = useState(false);

  const enabled = scheduledSendAt != null;

  const toggle = (value: boolean) => {
    if (value) {
      const next = new Date(Date.now() + 3600 * 1000);
      setDate(next);
      setScheduledSendAt(toApiFormat(next));
    } else {
      setScheduledSendAt(null);
      setIosVisible(false);
    }
  };

  const applyDate = (next: Date) => {
    setDate(next);
    setScheduledSendAt(toApiFormat(next));
  };

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      onChange: (_e, selectedDate) => {
        if (!selectedDate) return;
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: "time",
          onChange: (_e2, selectedTime) => {
            if (!selectedTime) return;
            const combined = new Date(selectedDate);
            combined.setHours(selectedTime.getHours(), selectedTime.getMinutes());
            applyDate(combined);
          },
        });
      },
    });
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="titleMedium">Programmer l&apos;envoi</AppText>
          <AppText variant="caption" muted>
            {enabled ? "Le message partira à la date choisie." : "Envoi immédiat."}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ true: colors.rosePrimary, false: colors.outline }}
          thumbColor={colors.creamHighlight}
        />
      </View>

      {enabled ? (
        <Pressable
          style={styles.dateButton}
          onPress={() => (Platform.OS === "android" ? openAndroid() : setIosVisible((v) => !v))}
        >
          <Ionicons name="calendar" size={18} color={colors.rosePrimary} />
          <AppText variant="bodyMedium">{date.toLocaleString("fr-FR")}</AppText>
        </Pressable>
      ) : null}

      {enabled && Platform.OS === "ios" && iosVisible ? (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="spinner"
          themeVariant="dark"
          onChange={(_e, selectedDate) => {
            if (selectedDate) applyDate(selectedDate);
          }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flex: { flex: 1 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
});
