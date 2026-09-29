import { useState, type CSSProperties } from 'react';
import { MessageCircleQuestionMark } from 'lucide-react';
import { Button, Card, CardHeader, IconBadge } from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';
import { NEWCOMER_PROMPT, SITE_GUIDE_PATH } from '../../data/sitePrompt';

const PROMPT_BOX: CSSProperties = {
  margin: `${SPACE[3]} 0`,
  padding: SPACE[3],
  background: COLOR.surfaceMuted,
  border: `1px solid ${COLOR.borderSubtle}`,
  borderRadius: RADIUS.control,
  fontSize: 14,
  lineHeight: 1.5,
  color: COLOR.textSecondary,
  overflowWrap: 'anywhere',
};

export function NewcomerPromptCard({ style }: Readonly<{ style?: CSSProperties }>) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(NEWCOMER_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Card style={{ maxWidth: 960, ...style }}>
      <CardHeader
        icon={<IconBadge icon={MessageCircleQuestionMark} />}
        title="New here? Ask your chatbot"
        description="Paste this into ChatGPT, Claude, Gemini or any chatbot that can open web pages — it will read our guide and walk you through the site."
      />
      <p style={PROMPT_BOX}>{NEWCOMER_PROMPT}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[3], alignItems: 'center' }}>
        <Button size="sm" variant="primary" onClick={() => void handleCopy()}>
          {copied ? '✓ Copied!' : 'Copy prompt'}
        </Button>
        <a href={SITE_GUIDE_PATH} target="_blank" rel="noopener" style={{ fontSize: 13, color: COLOR.textSecondary }}>
          Read the guide yourself
        </a>
      </div>
    </Card>
  );
}
