import { beforeEach, describe, expect, test } from 'bun:test';
import useIntelStore from './intel.store';

describe('intel store', () => {
  beforeEach(() => useIntelStore.setState({ open: false, articleId: null, area: null, tab: 'news' }));

  test('openIntel on an article opens it with every kind shown', () => {
    useIntelStore.getState().openIntel(12, 'alpha');
    expect(useIntelStore.getState()).toMatchObject({ open: true, articleId: 12, area: 'alpha', tab: 'all' });
  });

  test('openIntel without an article keeps the tab', () => {
    useIntelStore.getState().openIntel();
    expect(useIntelStore.getState()).toMatchObject({ open: true, articleId: null, area: null, tab: 'news' });
  });

  test('select clears the area', () => {
    useIntelStore.getState().openIntel(12, 'alpha');
    useIntelStore.getState().select(13);
    expect(useIntelStore.getState()).toMatchObject({ articleId: 13, area: null });
  });
});
