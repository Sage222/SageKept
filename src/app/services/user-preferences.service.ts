import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

export interface SidebarCoreMenuItemMeta {
  id: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  serverOnly?: boolean;
}

export const SIDEBAR_CORE_MENU_ITEMS: SidebarCoreMenuItemMeta[] = [
  { id: 'notes', label: 'Notes', icon: 'lightbulb' },
  { id: 'reminders', label: 'Reminders', icon: 'notifications' },
  { id: 'attachments', label: 'Attachments', icon: 'attach_file' },
  { id: 'shared', label: 'Shared', icon: 'group' },
  { id: 'binders', label: 'Binders section', icon: 'folder_open' },
  { id: 'labels', label: 'Labels section', icon: 'label' },
  { id: 'archive', label: 'Archive', icon: 'archive' },
  { id: 'trash', label: 'Trash', icon: 'delete' },
  { id: 'users', label: 'Users & Admin Settings', icon: 'admin_panel_settings', adminOnly: true },
  { id: 'logout', label: 'Sign out', icon: 'logout', serverOnly: true },
];

export interface UserPreferences {
  useTwentyFourHourTime: boolean;
  moveCompletedChecklistItemsToBottom: boolean;
  richLinkPreviews: boolean;
  notePreviewTextSize: 'compact' | 'default' | 'large';
  showPastReminders: boolean;
  defaultNoteColor: string;
  hideAllSidebarMenuItems: boolean;
  hiddenSidebarItems: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  useTwentyFourHourTime: false,
  moveCompletedChecklistItemsToBottom: true,
  richLinkPreviews: true,
  notePreviewTextSize: 'default',
  showPastReminders: false,
  defaultNoteColor: '',
  hideAllSidebarMenuItems: false,
  hiddenSidebarItems: [],
};

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly storageKey = 'kept_user_preferences';
  readonly preferences$ = new BehaviorSubject<UserPreferences>(this.load());
  private loadedServerPreferenceToken = '';

  constructor(private auth: AuthService) {
    this.auth.accessChanges$.subscribe(user => {
      if (this.auth.isLocal) { this.preferences$.next(this.load()); this.apply({ showPastReminders: this.auth.workspace.local?.preferences.showPastReminders === true, defaultNoteColor: this.auth.workspace.local?.preferences.defaultNoteColor || '' }); return; }
      if (!user) {
        this.loadedServerPreferenceToken = '';
        this.apply({ showPastReminders: false, defaultNoteColor: '' });
        return;
      }
      this.apply({ showPastReminders: user.showPastReminders === true, defaultNoteColor: user.defaultNoteColor || '' });
      if (user.token === this.loadedServerPreferenceToken) return;
      this.loadedServerPreferenceToken = user.token;
      this.auth.loadAccountPreferences().catch(() => {});
    });
  }

  get value() {
    return this.preferences$.value;
  }

  update(patch: Partial<UserPreferences>) {
    this.apply(patch);
  }

  isSidebarItemHidden(itemId: string): boolean {
    const id = String(itemId || '').trim();
    if (!id) return false;
    return (this.value.hiddenSidebarItems || []).includes(id);
  }

  isSidebarBinderHidden(name: string): boolean {
    return this.isSidebarItemHidden('binder:' + String(name || '').trim().toLowerCase());
  }

  isSidebarSharedBinderHidden(id: number): boolean {
    return this.isSidebarItemHidden('shared-binder:' + id);
  }

  isSidebarLabelHidden(name: string): boolean {
    return this.isSidebarItemHidden('label:' + String(name || '').trim().toLowerCase());
  }

  hideSidebarItem(itemId: string): void {
    const id = String(itemId || '').trim();
    if (!id) return;
    const current = this.value.hiddenSidebarItems || [];
    if (current.includes(id)) return;
    this.apply({ hiddenSidebarItems: [...current, id] });
  }

  showSidebarItem(itemId: string): void {
    const id = String(itemId || '').trim();
    if (!id) return;
    const current = this.value.hiddenSidebarItems || [];
    if (!current.includes(id)) return;
    this.apply({ hiddenSidebarItems: current.filter(x => x !== id) });
  }

  toggleSidebarItem(itemId: string): void {
    if (this.isSidebarItemHidden(itemId)) {
      this.showSidebarItem(itemId);
    } else {
      this.hideSidebarItem(itemId);
    }
  }

  renameSidebarItem(oldItemId: string, newItemId: string): void {
    const oldId = String(oldItemId || '').trim();
    const newId = String(newItemId || '').trim();
    if (!oldId || !newId || oldId === newId) return;
    const current = this.value.hiddenSidebarItems || [];
    if (!current.includes(oldId)) return;
    const updated = Array.from(new Set(current.map(x => x === oldId ? newId : x)));
    this.apply({ hiddenSidebarItems: updated });
  }

  restoreAllSidebarItems(): void {
    this.apply({ hiddenSidebarItems: [], hideAllSidebarMenuItems: false });
  }

  async updateShowPastReminders(enabled: boolean) {
    const previous = this.value.showPastReminders;
    this.apply({ showPastReminders: enabled });
    try {
      await this.auth.updateAccountPreferences({ showPastReminders: enabled });
    } catch (error) {
      this.apply({ showPastReminders: previous });
      throw error;
    }
  }

  async updateDefaultNoteColor(color: string) {
    if (color !== '' && !/^#[0-9a-f]{6}$/i.test(color)) return;
    const previous = this.value.defaultNoteColor;
    this.apply({ defaultNoteColor: color });
    try { await this.auth.updateAccountPreferences({ defaultNoteColor: color }); }
    catch (error) { this.apply({ defaultNoteColor: previous }); throw error; }
  }

  private get scopedStorageKey() { return this.auth?.isLocal ? `${this.storageKey}:${this.auth.workspace.local?.id || 'local'}` : this.storageKey; }

  private load(): UserPreferences {
    try {
      const raw = localStorage.getItem(this.scopedStorageKey);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      const hiddenSidebarItems = Array.isArray(parsed.hiddenSidebarItems)
        ? parsed.hiddenSidebarItems.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      return {
        useTwentyFourHourTime: parsed.useTwentyFourHourTime === true,
        moveCompletedChecklistItemsToBottom: parsed.moveCompletedChecklistItemsToBottom !== false,
        richLinkPreviews: parsed.richLinkPreviews !== false,
        notePreviewTextSize: this.normalizeNotePreviewTextSize(parsed.notePreviewTextSize),
        showPastReminders: parsed.showPastReminders === true,
        defaultNoteColor: '',
        hideAllSidebarMenuItems: parsed.hideAllSidebarMenuItems === true,
        hiddenSidebarItems,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private normalizeNotePreviewTextSize(value: unknown): UserPreferences['notePreviewTextSize'] {
    return value === 'compact' || value === 'large' ? value : 'default';
  }

  private apply(patch: Partial<UserPreferences>) {
    const next = { ...this.value, ...patch };
    this.preferences$.next(next);
    this.save(next);
  }

  private save(value: UserPreferences) {
    try {
      localStorage.setItem(this.scopedStorageKey, JSON.stringify(value));
    } catch {}
  }
}
