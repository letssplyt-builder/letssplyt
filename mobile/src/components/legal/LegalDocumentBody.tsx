import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { LegalSection } from '../../content/legal/legal.types';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type DocStyles = ReturnType<typeof makeStyles>;

function InlineText({
  text,
  style,
  inlineStyles,
}: {
  text: string;
  style?: object;
  inlineStyles: Pick<DocStyles, 'link' | 'bold'>;
}) {
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
              style={inlineStyles.link}
              onPress={() => void Linking.openURL(url)}
              accessibilityRole="link"
            >
              {label}
            </Text>
          );
        }

        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={index} style={inlineStyles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }

        return part;
      })}
    </Text>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: 2,
    },
    h1: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 12,
      fontFamily: theme.fontDisplay,
    },
    h2: {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '700',
      color: theme.ink,
      marginTop: 20,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    h3: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '700',
      color: theme.ink,
      marginTop: 14,
      marginBottom: 6,
      fontFamily: theme.fontBody,
    },
    paragraph: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.ink2,
      marginBottom: 10,
      fontFamily: theme.fontBody,
    },
    bold: {
      fontWeight: '700',
      color: theme.ink,
    },
    link: {
      color: theme.accent,
      textDecorationLine: 'underline',
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: theme.line,
      backgroundColor: theme.surface,
      borderRadius: theme.radiusSm,
      borderTopLeftRadius: 0,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginVertical: 10,
    },
    blockquoteText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.ink2,
      fontStyle: 'italic',
      fontFamily: theme.fontBody,
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
      color: theme.ink2,
      width: 14,
      fontFamily: theme.fontBody,
    },
    listItem: {
      flex: 1,
      fontSize: 15,
      lineHeight: 24,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    table: {
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: theme.radiusSm,
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
      borderColor: theme.line,
    },
    tableHeaderCell: {
      backgroundColor: theme.surfaceStrong,
    },
    tableHeaderText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    tableCellText: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    hr: {
      height: 1,
      backgroundColor: theme.line,
      marginVertical: 16,
    },
  });
}

export function LegalDocumentBody({ sections }: { sections: LegalSection[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const inlineStyles = useMemo(
    () => ({ link: styles.link, bold: styles.bold }),
    [styles.bold, styles.link],
  );

  return (
    <View style={styles.container}>
      {sections.map((section, index) => {
        switch (section.type) {
          case 'h1':
            return (
              <Text key={index} style={styles.h1}>
                <InlineText text={section.text} inlineStyles={inlineStyles} />
              </Text>
            );
          case 'h2':
            return (
              <Text key={index} style={styles.h2}>
                <InlineText text={section.text} inlineStyles={inlineStyles} />
              </Text>
            );
          case 'h3':
            return (
              <Text key={index} style={styles.h3}>
                <InlineText text={section.text} inlineStyles={inlineStyles} />
              </Text>
            );
          case 'p':
            return (
              <Text key={index} style={styles.paragraph}>
                <InlineText text={section.text} inlineStyles={inlineStyles} />
              </Text>
            );
          case 'blockquote':
            return (
              <View key={index} style={styles.blockquote}>
                <Text style={styles.blockquoteText}>
                  <InlineText text={section.text} inlineStyles={inlineStyles} />
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
                      <InlineText text={item} inlineStyles={inlineStyles} />
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
                        <InlineText text={header} inlineStyles={inlineStyles} />
                      </Text>
                    </View>
                  ))}
                </View>
                {section.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {row.map((cell, cellIndex) => (
                      <View key={cellIndex} style={styles.tableCell}>
                        <Text style={styles.tableCellText}>
                          <InlineText text={cell} inlineStyles={inlineStyles} />
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
