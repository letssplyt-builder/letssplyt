import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { LegalDocumentBody } from '../../components/legal/LegalDocumentBody';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../../content/legal';
import type { LegalSection } from '../../content/legal/legal.types';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { LegalDocumentScreenParams } from '../../navigation/types';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<{ LegalDocument: LegalDocumentScreenParams }, 'LegalDocument'>;

type LegalDocumentId = LegalDocumentScreenParams['document'];

const TITLES: Record<LegalDocumentId, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
};

const SECTIONS: Record<LegalDocumentId, LegalSection[]> = {
  terms: TERMS_SECTIONS,
  privacy: PRIVACY_SECTIONS,
};

export function LegalDocumentScreen({ navigation, route }: Props) {
  const { screenScrollBottomPadding } = useAppInsets();
  const document = route.params.document;

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <FadeSlideIn delay={0}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{TITLES[document]}</Text>
      </FadeSlideIn>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
      >
        <LegalDocumentBody sections={SECTIONS[document]} />
      </ScrollView>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 28,
  },
  back: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 16,
  },
});
