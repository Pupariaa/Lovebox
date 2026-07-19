import { Redirect } from "expo-router";
import { useAppStore } from "@/store/appStore";

export default function Index() {
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const userProfile = useAppStore((s) => s.userProfile);

  if (!isLoggedIn) {
    return <Redirect href="/auth" />;
  }

  if (userProfile && userProfile.profile_complete === false) {
    return <Redirect href="/onboarding/profile" />;
  }
  if (userProfile && !userProfile.first_name?.trim() && userProfile.profile_complete !== true) {
    return <Redirect href="/onboarding/profile" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
