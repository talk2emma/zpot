import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../../i18n';
import { palette } from '../../theme';
import { ZpotButton } from './ZpotButton';

interface State { error: Error | null }

/** Catches render errors so one broken screen never kills the app; offers a reset. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { if (__DEV__) console.warn('[ErrorBoundary]', error); }
  reset = () => { this.setState({ error: null }); this.props.onReset?.(); };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.box} testID="error-boundary">
        <Text style={styles.title}>{i18n.t('errors.boundary')}</Text>
        <Text style={styles.body}>{i18n.t('errors.boundaryBody')}</Text>
        <ZpotButton label={i18n.t('common.tryAgain')} onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: palette.white },
  title: { fontSize: 20, fontWeight: '700', color: palette.navy900 },
  body: { fontSize: 15, color: palette.navy700 },
});
