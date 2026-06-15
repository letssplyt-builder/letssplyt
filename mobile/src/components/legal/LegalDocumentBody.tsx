import { Linking, StyleSheet, Text, View } from 'react-native';
import type { LegalSection } from '../../content/legal/legal.types';
import { authColors } from '../../theme/colors';

function InlineText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const label = linkMatch[1];
          const url = linkMatch[2];
          return (
            <Text
              key={index}
              style={styles.link}
              onPress={() => void Linking.openURL(url)}
              accessibilityRole="link"
            >
              {label}
            </Text>
          );
        }

        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={index} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }

        return part;
      })}
    </Text>
  );
}

export function LegalDocumentBody({ sections }: { sections: LegalSection[] }) {
  return (
    <View style={styles.container}>
      {sections.map((section, index) => {
        switch (section.type) {
          case 'h1':
            return (
              <Text key={index} style={styles.h1}>
                <InlineText text={section.text} />
              </Text>
            );
          case 'h2':
            return (
              <Text key={index} style={styles.h2}>
                <InlineText text={section.text} />
              </Text>
            );
          case 'h3':
            return (
              <Text key={index} style={styles.h3}>
                <InlineText text={section.text} />
              </Text>
            );
          case 'p':
            return (
              <Text key={index} style={styles.paragraph}>
                <InlineText text={section.text} />
              </Text>
            );
          case 'blockquote':
            return (
              <View key={index} style={styles.blockquote}>
                <Text style={styles.blockquoteText}>
                  <InlineText text={section.text} />
                </Text>
              </View>
            );
          case 'ul':
            return (
              <View key={index} style={styles.list}>
                {section.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listItem}>
                      <InlineText text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'table':
            return (
              <View key={index} style={styles.table}>
                <View style={styles.tableRow}>
                  {section.headers.map((header, headerIndex) => (
                    <View key={headerIndex} style={[styles.tableCell, styles.tableHeaderCell]}>
                      <Text style={styles.tableHeaderText}>
                        <InlineText text={header} />
                      </Text>
                    </View>
                  ))}
                </View>
                {section.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {row.map((cell, cellIndex) => (
                      <View key={cellIndex} style={styles.tableCell}>
                        <Text style={styles.tableCellText}>
                          <InlineText text={cell} />
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'hr':
            return <View key={index} style={styles.hr} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 12,
  },
  h2: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: authColors.textOnDark,
    marginTop: 20,
    marginBottom: 8,
  },
  h3: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: authColors.textOnDark,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: authColors.textOnDarkMuted,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  link: {
    color: '#5eead4',
    textDecorationLine: 'underline',
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: authColors.glass,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 10,
  },
  blockquoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
    fontStyle: 'italic',
  },
  list: {
    marginBottom: 12,
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 24,
    color: authColors.textOnDarkMuted,
    width: 14,
  },
  listItem: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: authColors.textOnDarkMuted,
  },
  table: {
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 12,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: authColors.glassBorder,
  },
  tableHeaderCell: {
    backgroundColor: authColors.glassStrong,
  },
  tableHeaderText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  tableCellText: {
    fontSize: 13,
    lineHeight: 18,
    color: authColors.textOnDarkMuted,
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginVertical: 16,
  },
});
