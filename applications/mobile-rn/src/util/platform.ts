import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function openUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
