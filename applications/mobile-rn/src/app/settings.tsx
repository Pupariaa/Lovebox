import { Redirect } from "expo-router";
import { useAppStore } from "@/store/appStore";

export default function SettingsScreen() {
  const myDevice = useAppStore((s) => s.myDevice);
  if (myDevice) return <Redirect href={`/device/${myDevice.id}`} />;
  return <Redirect href="/boxes" />;
}
