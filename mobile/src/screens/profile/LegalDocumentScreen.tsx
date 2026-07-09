import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedScreenLayout } from '../../components/layout/ThemedScreenLayout';
import { LegalDocumentBody } from '../../components/legal/LegalDocumentBody';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../../content/legal';
import type { LegalSection } from '../../content/legal/legal.types';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { LegalDocumentScreenParams } from '../../navigation/types';

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
    <ThemedScreenLayout
      topBar={{
        title: TITLES[document],
        onBack: () => navigation.goBack(),
      }}
      scrollContentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
    >
      <LegalDocumentBody sections={SECTIONS[document]} />
    </ThemedScreenLayout>
  );
}
