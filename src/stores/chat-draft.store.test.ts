import { beforeEach, describe, expect, test } from 'bun:test';
import useChatDraftStore, { mergeDrafts } from './chat-draft.store';

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

  test('restore puts an unsent question back', () => {
    expect(store().restore(1, { text: 'Niet verstuurd' })).toEqual({ merged: false, imageDropped: false });
    expect(store().drafts[1]?.text).toBe('Niet verstuurd');
  });

  test('restore puts the unsent question above something typed since, and keeps its image when none is attached', () => {
    store().setText(2, 'Al nieuw getypt');
    expect(store().restore(2, { text: 'Oud', image: { url: 'data:a', name: 'a.jpg' } })).toEqual({ merged: true, imageDropped: false });
    expect(store().drafts[2]).toEqual({ text: 'Oud\nAl nieuw getypt', image: { url: 'data:a', name: 'a.jpg' } });
  });

  test('restore keeps a newer image and says the old one was dropped', () => {
    store().setImage(3, { url: 'data:new', name: 'b.jpg' });
    expect(store().restore(3, { text: 'Oud', image: { url: 'data:old', name: 'a.jpg' } })).toEqual({ merged: true, imageDropped: true });
    expect(store().drafts[3]).toEqual({ text: 'Oud', image: { url: 'data:new', name: 'b.jpg' } });
  });

  test('mergeDrafts does not double a question that is already there', () => {
    expect(mergeDrafts({ text: 'Vraag' }, { text: 'Vraag\nmeer' }).draft.text).toBe('Vraag\nmeer');
  });

  test('emptying the text without an image drops the draft', () => {
    store().setText(3, 'x');
    store().setText(3, '');
    expect(store().drafts[3]).toBeUndefined();
  });
});
