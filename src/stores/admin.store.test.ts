import { beforeEach, describe, expect, test } from 'bun:test';
import useAdminStore from './admin.store';

beforeEach(() => useAdminStore.setState({ dialog: null, dirty: false, pendingLeave: null }));

describe('admin store leave guard', () => {
  test('closes and switches right away without unsaved changes', () => {
    useAdminStore.getState().openDialog('algemeen');
    useAdminStore.getState().openDialog('users');
    expect(useAdminStore.getState().dialog).toBe('users');
    useAdminStore.getState().requestClose();
    expect(useAdminStore.getState().dialog).toBeNull();
  });

  test('asks before closing with unsaved changes; cancel keeps the window', () => {
    useAdminStore.getState().openDialog('algemeen');
    useAdminStore.getState().setDirty(true);
    useAdminStore.getState().requestClose();
    expect(useAdminStore.getState().dialog).toBe('algemeen');
    expect(useAdminStore.getState().pendingLeave).not.toBeNull();
    useAdminStore.getState().cancelLeave();
    expect(useAdminStore.getState().pendingLeave).toBeNull();
    expect(useAdminStore.getState().dialog).toBe('algemeen');
    expect(useAdminStore.getState().dirty).toBe(true);
  });

  test('confirming throws the changes away and runs the pending close / switch', () => {
    useAdminStore.getState().openDialog('algemeen');
    useAdminStore.getState().setDirty(true);
    useAdminStore.getState().openDialog('ai');
    expect(useAdminStore.getState().dialog).toBe('algemeen');
    useAdminStore.getState().confirmLeave();
    expect(useAdminStore.getState()).toMatchObject({ dialog: 'ai', dirty: false, pendingLeave: null });
  });

  test('reopening the same section is no leave; close() is never guarded', () => {
    useAdminStore.getState().openDialog('algemeen');
    useAdminStore.getState().setDirty(true);
    useAdminStore.getState().openDialog('algemeen');
    expect(useAdminStore.getState().pendingLeave).toBeNull();
    useAdminStore.getState().close();
    expect(useAdminStore.getState().dialog).toBeNull();
  });
});
