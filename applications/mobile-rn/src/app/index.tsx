import { Redirect } from "expo-router";
import { useAppStore } from "@/store/appStore";

export default function Index() {
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  return <Redirect href={isLoggedIn ? "/(tabs)/home" : "/auth"} />;
}
