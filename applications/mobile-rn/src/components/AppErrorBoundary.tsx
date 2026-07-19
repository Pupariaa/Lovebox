import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button } from "@/components/ui";
import { mapApiError } from "@/data/api/errors";
import { colors, spacing } from "@/theme/theme";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  resetKey: number;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("app error boundary caught", error, info.componentStack);
  }

  private reset = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
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
            {__DEV__ && this.state.error.stack ? (
              <AppText variant="caption" muted style={styles.stack}>
                {this.state.error.stack}
              </AppText>
            ) : null}
            <Button label="Réessayer" onPress={this.reset} />
          </ScrollView>
        </View>
      );
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
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
