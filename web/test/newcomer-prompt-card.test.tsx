// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { NewcomerPromptCard } from '../src/components/conditions/NewcomerPromptCard';
import { NEWCOMER_PROMPT } from '../src/data/sitePrompt';
import { buttonNamed, mount, unmount } from './helpers/render';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(unmount);

describe('NewcomerPromptCard', () => {
  it('shows the prompt and links to the guide', async () => {
    const el = await mount(<NewcomerPromptCard />);
    expect(el.textContent).toContain(NEWCOMER_PROMPT);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/prompt');
  });

  it('copies the prompt to the clipboard and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await mount(<NewcomerPromptCard />);
    await act(async () => {
      buttonNamed(el, 'Copy prompt').click();
    });
    expect(writeText).toHaveBeenCalledWith(NEWCOMER_PROMPT);
    expect(el.textContent).toContain('✓ Copied!');
  });
});
