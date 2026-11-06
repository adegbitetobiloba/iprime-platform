import { StyleSheet, Text, View } from 'react-native';
import { getConfig } from '@/core/config';
import { brand } from '@/design/tokens';

// F0 placeholder only. The real splash, wake-up probe and login arrive in M1a.
export default function Index() {
  const { env, origin } = getConfig();
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>iPrime</Text>
      <Text style={styles.body}>Foundation build (F0). Nothing to use yet.</Text>
      <Text style={styles.meta}>{env} · {origin}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: brand.light.bg },
  title: { fontSize: 36, fontWeight: '700', color: brand.light.ink },
  body: { marginTop: 8, fontSize: 16, color: brand.light.text },
  meta: { marginTop: 16, fontSize: 12, color: brand.light.muted },
});
