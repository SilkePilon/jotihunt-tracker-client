import { beforeEach, describe, expect, test } from 'bun:test';
import useChatDraftStore from './chat-draft.store';

const store = () => useChatDraftStore.getState();

describe('chat draft store', () => {
  beforeEach(() => useChatDraftStore.setState({ drafts: {} }));

  test('text and image per item; clearing removes the item', () => {
    store().setText(1, 'Waar is Alpha?');
    store().setImage(1, { url: 'data:x', name: 'a.jpg' });
    store().setText(2, 'Ander item');
    expect(store().drafts[1]).toEqual({ text: 'Waar is Alpha?', image: { url: 'data:x', name: 'a.jpg' } });
    store().clear(1);
    expect(store().drafts[1]).toBeUndefined();
    expect(store().drafts[2]?.text).toBe('Ander item');
  });

  test('restore puts an unsent question back, but never over something new', () => {
    store().restore(1, { text: 'Niet verstuurd' });
    expect(store().drafts[1]?.text).toBe('Niet verstuurd');
    store().setText(2, 'Al nieuw getypt');
    store().restore(2, { text: 'Oud' });
    expect(store().drafts[2]?.text).toBe('Al nieuw getypt');
  });

  test('emptying the text without an image drops the draft', () => {
    store().setText(3, 'x');
    store().setText(3, '');
    expect(store().drafts[3]).toBeUndefined();
  });
});
