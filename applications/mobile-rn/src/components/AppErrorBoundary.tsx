import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button } from "@/components/ui";
import { mapApiError } from "@/data/api/errors";
import { colors, spacing } from "@/theme/theme";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="headlineMedium">Erreur application</AppText>
            <AppText variant="bodyMedium" muted style={styles.message}>
              Une erreur inattendue s'est produite. Tu peux réessayer ou relancer l'application.
            </AppText>
            <AppText variant="caption" muted style={styles.message}>
              {mapApiError(this.state.error.message)}
            </AppText>
            {this.state.error.stack ? (
              <AppText variant="caption" muted style={styles.stack}>
                {this.state.error.stack}
              </AppText>
            ) : null}
            <Button label="Réessayer" onPress={this.reset} />
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.plumBackground,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    marginTop: spacing.sm,
  },
  stack: {
    fontFamily: "Courier",
  },
});
