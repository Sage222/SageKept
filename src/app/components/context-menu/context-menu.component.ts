import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LabelI } from 'src/app/interfaces/labels';
import { NoteI } from 'src/app/interfaces/notes';
import { AuthService } from 'src/app/services/auth.service';
import { NotesService } from 'src/app/services/notes.service';
import { BinderTreeNode, SharedService } from 'src/app/services/shared.service';
import { UserPreferencesService } from 'src/app/services/user-preferences.service';

declare var Snackbar: any;

export interface ContextMenuActionItem {
  id: string;
  label: string;
  icon: string;
  danger?: boolean;
  dividerBefore?: boolean;
  badge?: string;
  run: () => void | Promise<void>;
}

export type ContextDialogMode =
  | null
  | 'rename-binder'
  | 'create-binder'
  | 'delete-binder'
  | 'rename-label'
  | 'create-label'
  | 'delete-label'
  | 'rename-note'
  | 'note-binder'
  | 'note-labels';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  standalone: false
})
export class ContextMenuComponent implements OnInit, OnDestroy {
  @ViewChild('menuEl') menuEl?: ElementRef<HTMLDivElement>;
  @ViewChild('dialogInput') dialogInput?: ElementRef<HTMLInputElement>;

  isOpen = false;
  x = 0;
  y = 0;
  contextTitle = '';
  contextIcon = 'tune';
  actions: ContextMenuActionItem[] = [];

  // In-app dialog state (avoids browser prompt/confirm)
  dialogMode: ContextDialogMode = null;
  dialogTitle = '';
  dialogSubtitle = '';
  dialogValue = '';
  dialogParentBinder = '';
  dialogTargetName = '';
  dialogTargetId = 0;
  dialogError = '';
  dialogBusy = false;
  dialogNote?: NoteI;
  dialogNoteLabels: { id?: number; name: string; added: boolean }[] = [];
  newDialogLabelName = '';

  private touchTimer: any = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchTarget: HTMLElement | null = null;
  private openedViaTouchAt = 0;

  constructor(
    public Shared: SharedService,
    public preferences: UserPreferencesService,
    public auth: AuthService,
    private notesService: NotesService,
    private router: Router,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('contextmenu', this.onContextMenu, true);
      document.addEventListener('touchstart', this.onTouchStart, { capture: true, passive: true });
      document.addEventListener('touchmove', this.onTouchMove, { capture: true, passive: true });
      document.addEventListener('touchend', this.onTouchEnd, { capture: true, passive: false });
      document.addEventListener('touchcancel', this.onTouchCancel, { capture: true, passive: true });
      document.addEventListener('mousedown', this.onGlobalPointerDown, true);
      document.addEventListener('click', this.onGlobalClick, true);
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('resize', this.onWindowResize, true);
      window.addEventListener('scroll', this.onWindowScroll, true);
    });
  }

  ngOnDestroy(): void {
    this.clearTouchTimer();
    document.removeEventListener('contextmenu', this.onContextMenu, true);
    document.removeEventListener('touchstart', this.onTouchStart, true);
    document.removeEventListener('touchmove', this.onTouchMove, true);
    document.removeEventListener('touchend', this.onTouchEnd, true);
    document.removeEventListener('touchcancel', this.onTouchCancel, true);
    document.removeEventListener('mousedown', this.onGlobalPointerDown, true);
    document.removeEventListener('click', this.onGlobalClick, true);
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('resize', this.onWindowResize, true);
    window.removeEventListener('scroll', this.onWindowScroll, true);
  }

  private onContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Allow interaction inside our own context menu or dialog without re-triggering
    if (target.closest('.sage-ctx-menu, .sage-ctx-dialog-backdrop')) {
      event.preventDefault();
      return;
    }

    // If user right-clicks inside an editable text field with an active text selection, allow native copy/paste
    if (this.isEditableWithSelection(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.zone.run(() => {
      this.openMenuForTarget(target, event.clientX, event.clientY, false);
    });
  };

  private onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      this.clearTouchTimer();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.sage-ctx-menu, .sage-ctx-dialog-backdrop')) {
      return;
    }
    // Don't hijack long-press inside active text inputs or drawing canvas
    if (target.closest('input, textarea, select, [contenteditable="true"], canvas')) {
      return;
    }

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchTarget = target;
    this.clearTouchTimer();

    this.touchTimer = setTimeout(() => {
      this.touchTimer = null;
      if (!this.touchTarget) return;
      const openTarget = this.touchTarget;
      const clientX = this.touchStartX;
      const clientY = this.touchStartY;
      this.zone.run(() => {
        this.openedViaTouchAt = Date.now();
        try {
          if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
        } catch {}
        this.openMenuForTarget(openTarget, clientX, clientY, true);
      });
    }, 430);
  };

  private onTouchMove = (event: TouchEvent) => {
    if (!this.touchTimer || !event.touches.length) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - this.touchStartX) > 12 || Math.abs(touch.clientY - this.touchStartY) > 12) {
      this.clearTouchTimer();
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    this.clearTouchTimer();
    // If the context menu just opened from this touch hold, prevent the synthetic click from firing
    if (this.isOpen && Date.now() - this.openedViaTouchAt < 650) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.sage-ctx-menu, .sage-ctx-dialog-backdrop')) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  private onTouchCancel = () => {
    this.clearTouchTimer();
  };

  private onGlobalPointerDown = (event: MouseEvent) => {
    if (!this.isOpen) return;
    if (Date.now() - this.openedViaTouchAt < 500) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.sage-ctx-menu, .sage-ctx-dialog-backdrop')) return;
    this.zone.run(() => this.closeMenu());
  };

  private onGlobalClick = (event: MouseEvent) => {
    if (Date.now() - this.openedViaTouchAt < 550) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.sage-ctx-menu, .sage-ctx-dialog-backdrop')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (this.dialogMode) {
        this.zone.run(() => this.closeDialog());
        event.stopPropagation();
      } else if (this.isOpen) {
        this.zone.run(() => this.closeMenu());
        event.stopPropagation();
      }
    }
  };

  private onWindowResize = () => {
    if (this.isOpen) this.zone.run(() => this.closeMenu());
  };

  private onWindowScroll = (event: Event) => {
    if (!this.isOpen) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest?.('.sage-ctx-menu')) return;
    this.zone.run(() => this.closeMenu());
  };

  private clearTouchTimer() {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  private isEditableWithSelection(target: HTMLElement): boolean {
    const editable = target.closest('input, textarea, [contenteditable="true"]');
    if (!editable) return false;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return true;
    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      return (editable.selectionEnd || 0) > (editable.selectionStart || 0);
    }
    return false;
  }

  closeMenu() {
    this.isOpen = false;
  }

  private openMenuForTarget(target: HTMLElement, clientX: number, clientY: number, isTouch: boolean) {
    if (isTouch) {
      this.openedViaTouchAt = Date.now();
    }
    const built = this.buildActionsForTarget(target);
    if (!built.actions.length) return;

    this.contextTitle = built.title;
    this.contextIcon = built.icon;
    this.actions = built.actions;
    this.isOpen = true;

    // Initial coordinates before measuring actual menu dimensions
    const menuWidth = 256;
    const estimatedHeight = Math.min(440, 56 + this.actions.length * 38);
    this.x = Math.max(10, Math.min(clientX, window.innerWidth - menuWidth - 10));
    this.y = Math.max(10, Math.min(clientY, window.innerHeight - estimatedHeight - 10));

    setTimeout(() => {
      const el = this.menuEl?.nativeElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      this.x = Math.max(10, Math.min(clientX, window.innerWidth - rect.width - 10));
      this.y = Math.max(10, Math.min(clientY, window.innerHeight - rect.height - 10));
    }, 0);
  }

  runAction(item: ContextMenuActionItem, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.closeMenu();
    void item.run();
  }

  private buildActionsForTarget(target: HTMLElement): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    // 1. Check if target is a Label chip on a note or a Label row in the sidebar
    const labelEl = target.closest<HTMLElement>('[data-ctx-label-name]');
    const noteEl = target.closest<HTMLElement>('[data-note-id]');
    const binderEl = target.closest<HTMLElement>('[data-ctx-binder]');
    const sharedBinderEl = target.closest<HTMLElement>('[data-ctx-shared-binder-id]');
    const sidebarItemEl = target.closest<HTMLElement>('[data-ctx-sidebar-item]');

    // If user right-clicked a label chip inside a note card or in sidebar
    if (labelEl) {
      const labelName = (labelEl.getAttribute('data-ctx-label-name') || '').trim();
      const labelObj = this.Shared.label.list.find(l => l.name.toLowerCase() === labelName.toLowerCase());
      if (labelName) {
        return this.buildLabelActions(labelName, labelObj, noteEl);
      }
    }

    // 2. If user right-clicked a Binder (in sidebar, breadcrumb, or sub-binder strip)
    if (binderEl) {
      const binderName = (binderEl.getAttribute('data-ctx-binder') || '').trim();
      if (binderName) {
        return this.buildBinderActions(binderName);
      }
    }

    // 3. If user right-clicked a Shared Binder in the sidebar
    if (sharedBinderEl) {
      const sharedId = Number(sharedBinderEl.getAttribute('data-ctx-shared-binder-id') || 0);
      const sharedName = (sharedBinderEl.getAttribute('data-ctx-shared-binder-name') || 'Shared binder').trim();
      if (sharedId) {
        return this.buildSharedBinderActions(sharedId, sharedName);
      }
    }

    // 4. If user right-clicked a Left-Hand Column Menu Item
    if (sidebarItemEl) {
      const itemId = (sidebarItemEl.getAttribute('data-ctx-sidebar-item') || '').trim();
      const itemLabel = (sidebarItemEl.getAttribute('data-ctx-sidebar-label') || itemId).trim();
      if (itemId) {
        return this.buildSidebarItemActions(itemId, itemLabel);
      }
    }

    // 5. If user right-clicked a Note Card
    if (noteEl) {
      const noteId = Number(noteEl.getAttribute('data-note-id') || 0);
      const note = this.Shared.note.all.find(n => n.id === noteId);
      if (note) {
        return this.buildNoteActions(note);
      }
    }

    // 6. General area (workspace background, navbar, settings, empty sidebar area, etc.)
    return this.buildGeneralActions(target);
  }

  private buildSidebarItemActions(itemId: string, itemLabel: string): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const actions: ContextMenuActionItem[] = [];
    const routeMap: Record<string, string> = {
      notes: '/',
      reminders: '/reminders',
      attachments: '/attachments',
      shared: '/shared',
      archive: '/archive',
      trash: '/trash',
      users: '/users'
    };

    if (routeMap[itemId]) {
      actions.push({
        id: 'open-route',
        label: `Open ${itemLabel}`,
        icon: 'open_in_new',
        run: () => { void this.router.navigateByUrl(routeMap[itemId]); }
      });
    }

    if (itemId === 'binders') {
      actions.push({
        id: 'create-binder',
        label: 'New binder...',
        icon: 'create_new_folder',
        run: () => this.openCreateBinderDialog('')
      });
      actions.push({
        id: 'manage-binders',
        label: 'Edit binders...',
        icon: 'folder_open',
        run: () => this.Shared.openBinderModalForParent.next(null)
      });
    }

    if (itemId === 'labels') {
      actions.push({
        id: 'create-label',
        label: 'New label...',
        icon: 'new_label',
        run: () => this.openCreateLabelDialog()
      });
      actions.push({
        id: 'manage-labels',
        label: 'Edit labels...',
        icon: 'label',
        run: () => this.Shared.openEditLabelsModal.next()
      });
    }

    actions.push({
      id: 'hide-item',
      label: `Hide "${itemLabel}" from left menu`,
      icon: 'visibility_off',
      dividerBefore: actions.length > 0,
      run: () => this.hideSidebarItemWithUndo(itemId, itemLabel)
    });

    actions.push({
      id: 'hide-all-menu',
      label: 'Hide all left-hand menu items',
      icon: 'menu_open',
      run: () => {
        this.preferences.update({ hideAllSidebarMenuItems: true });
        this.showUndoToast('All left-hand menu items hidden', () => {
          this.preferences.update({ hideAllSidebarMenuItems: false });
        });
      }
    });

    actions.push({
      id: 'open-settings-menu',
      label: 'Manage menu items in Settings',
      icon: 'settings',
      dividerBefore: true,
      run: () => { void this.router.navigateByUrl('/settings'); }
    });

    return {
      title: itemLabel,
      icon: 'menu',
      actions
    };
  }

  private buildBinderActions(binderName: string): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const itemId = 'binder:' + binderName.toLowerCase();
    const isHidden = this.preferences.isSidebarBinderHidden(binderName);
    const actions: ContextMenuActionItem[] = [
      {
        id: 'open-binder',
        label: `Open "${binderName}"`,
        icon: 'folder_open',
        run: () => { void this.router.navigate(['/binder', binderName]); }
      },
      {
        id: 'rename-binder',
        label: 'Rename binder...',
        icon: 'drive_file_rename_outline',
        run: () => this.openRenameBinderDialog(binderName)
      },
      {
        id: 'add-sub-binder',
        label: `New sub-binder inside "${binderName}"...`,
        icon: 'create_new_folder',
        run: () => this.openCreateBinderDialog(binderName)
      },
      {
        id: 'toggle-hide-binder',
        label: isHidden ? `Put "${binderName}" back in left menu` : `Hide "${binderName}" from left menu`,
        icon: isHidden ? 'visibility' : 'visibility_off',
        dividerBefore: true,
        run: () => {
          if (isHidden) {
            this.preferences.showSidebarItem(itemId);
            this.showToast(`"${binderName}" restored to left menu`);
          } else {
            this.hideSidebarItemWithUndo(itemId, `Binder: ${binderName}`);
          }
        }
      },
      {
        id: 'delete-binder',
        label: 'Delete binder...',
        icon: 'delete_outline',
        danger: true,
        dividerBefore: true,
        run: () => this.openDeleteBinderDialog(binderName)
      }
    ];

    return {
      title: `Binder: ${binderName}`,
      icon: 'folder',
      actions
    };
  }

  private buildSharedBinderActions(sharedId: number, sharedName: string): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const itemId = 'shared-binder:' + sharedId;
    const isHidden = this.preferences.isSidebarSharedBinderHidden(sharedId);
    return {
      title: `Shared binder: ${sharedName}`,
      icon: 'folder_shared',
      actions: [
        {
          id: 'open-shared-binder',
          label: `Open "${sharedName}"`,
          icon: 'folder_shared',
          run: () => { void this.router.navigate(['/shared-binder', sharedId]); }
        },
        {
          id: 'hide-shared-binder',
          label: isHidden ? `Put "${sharedName}" back in left menu` : `Hide "${sharedName}" from left menu`,
          icon: isHidden ? 'visibility' : 'visibility_off',
          dividerBefore: true,
          run: () => {
            if (isHidden) {
              this.preferences.showSidebarItem(itemId);
            } else {
              this.hideSidebarItemWithUndo(itemId, `Shared binder: ${sharedName}`);
            }
          }
        }
      ]
    };
  }

  private buildLabelActions(
    labelName: string,
    labelObj: LabelI | undefined,
    noteEl: HTMLElement | null
  ): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const itemId = 'label:' + labelName.toLowerCase();
    const isHidden = this.preferences.isSidebarLabelHidden(labelName);
    const actions: ContextMenuActionItem[] = [
      {
        id: 'open-label',
        label: `View notes with "${labelName}"`,
        icon: 'label',
        run: () => { void this.router.navigate(['/label', labelName]); }
      },
      {
        id: 'rename-label',
        label: 'Rename label...',
        icon: 'drive_file_rename_outline',
        run: () => this.openRenameLabelDialog(labelName, labelObj?.id)
      },
      {
        id: 'create-label',
        label: 'Create new label...',
        icon: 'new_label',
        run: () => this.openCreateLabelDialog()
      }
    ];

    if (noteEl) {
      const noteId = Number(noteEl.getAttribute('data-note-id') || 0);
      const note = this.Shared.note.all.find(n => n.id === noteId);
      if (note) {
        actions.push({
          id: 'remove-label-from-note',
          label: `Remove "${labelName}" from this note`,
          icon: 'label_off',
          dividerBefore: true,
          run: () => {
            const targetLabel = (note.labels || []).find(l => l.name.toLowerCase() === labelName.toLowerCase());
            if (targetLabel && note.id) {
              targetLabel.added = false;
              this.Shared.note.id = note.id;
              this.Shared.note.db.updateKey({ labels: note.labels });
            }
          }
        });
      }
    }

    actions.push({
      id: 'toggle-hide-label',
      label: isHidden ? `Put "${labelName}" back in left menu` : `Hide "${labelName}" from left menu`,
      icon: isHidden ? 'visibility' : 'visibility_off',
      dividerBefore: true,
      run: () => {
        if (isHidden) {
          this.preferences.showSidebarItem(itemId);
          this.showToast(`"${labelName}" restored to left menu`);
        } else {
          this.hideSidebarItemWithUndo(itemId, `Label: ${labelName}`);
        }
      }
    });

    actions.push({
      id: 'delete-label',
      label: 'Delete label...',
      icon: 'delete_outline',
      danger: true,
      dividerBefore: true,
      run: () => this.openDeleteLabelDialog(labelName, labelObj?.id)
    });

    return {
      title: `Label: ${labelName}`,
      icon: 'label',
      actions
    };
  }

  private buildNoteActions(note: NoteI): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const plainTitle = this.extractPlainText(note.noteTitle) || this.extractPlainText(note.noteBody) || 'Untitled note';
    const shortTitle = plainTitle.length > 30 ? plainTitle.slice(0, 30) + '…' : plainTitle;
    const isSelected = note.id ? this.Shared.isNoteSelected(note.id) : false;
    const actions: ContextMenuActionItem[] = [];

    if (note.trashed) {
      actions.push(
        {
          id: 'open-note',
          label: 'View note',
          icon: 'open_in_new',
          run: () => { if (note.id) this.Shared.openNoteById.next(note.id); }
        },
        {
          id: 'restore-note',
          label: 'Restore from Trash',
          icon: 'restore_from_trash',
          run: () => {
            if (!note.id) return;
            this.Shared.note.id = note.id;
            void this.Shared.note.db.updateKey({ trashed: false });
          }
        },
        {
          id: 'delete-forever',
          label: 'Delete forever',
          icon: 'delete_forever',
          danger: true,
          dividerBefore: true,
          run: () => {
            if (!note.id) return;
            this.Shared.note.id = note.id;
            void this.Shared.note.db.delete();
          }
        }
      );
      return { title: shortTitle, icon: 'description', actions };
    }

    actions.push(
      {
        id: 'open-note',
        label: 'Open note',
        icon: 'edit_note',
        run: () => { if (note.id) this.Shared.openNoteById.next(note.id); }
      },
      {
        id: 'rename-note',
        label: 'Rename note title...',
        icon: 'title',
        run: () => this.openRenameNoteDialog(note)
      },
      {
        id: 'pin-note',
        label: note.pinned ? 'Unpin note' : 'Pin note',
        icon: 'push_pin',
        run: () => {
          if (!note.id) return;
          this.Shared.note.id = note.id;
          void this.Shared.note.db.updateKey({ pinned: !note.pinned, archived: false });
        }
      },
      {
        id: 'select-note',
        label: isSelected ? 'Deselect note' : 'Select note',
        icon: isSelected ? 'check_box' : 'check_box_outline_blank',
        run: () => {
          if (note.id) this.Shared.toggleNoteSelection(note.id);
        }
      },
      {
        id: 'move-to-binder',
        label: note.binder ? `Binder: ${note.binder} (Change...)` : 'Move to binder...',
        icon: 'folder_open',
        dividerBefore: true,
        run: () => this.openNoteBinderDialog(note)
      },
      {
        id: 'manage-note-labels',
        label: 'Manage note labels...',
        icon: 'label',
        run: () => this.openNoteLabelsDialog(note)
      },
      {
        id: 'duplicate-note',
        label: 'Make a copy',
        icon: 'content_copy',
        dividerBefore: true,
        run: () => {
          if (!note.id) return;
          this.Shared.note.id = note.id;
          this.Shared.note.db.clone();
        }
      },
      {
        id: 'archive-note',
        label: note.archived ? 'Unarchive note' : 'Archive note',
        icon: note.archived ? 'unarchive' : 'archive',
        run: () => {
          if (!note.id) return;
          this.Shared.note.id = note.id;
          void this.Shared.note.db.updateKey({ archived: !note.archived, pinned: false });
        }
      },
      {
        id: 'delete-note',
        label: 'Delete note',
        icon: 'delete_outline',
        danger: true,
        dividerBefore: true,
        run: () => {
          if (!note.id) return;
          this.Shared.note.id = note.id;
          this.Shared.note.db.trash();
        }
      }
    );

    return {
      title: shortTitle,
      icon: 'sticky_note_2',
      actions
    };
  }

  private buildGeneralActions(target: HTMLElement): { title: string; icon: string; actions: ContextMenuActionItem[] } {
    const actions: ContextMenuActionItem[] = [];
    const inSidebar = !!target.closest('app-sidenav, [sideBar]');
    const hiddenCount = (this.preferences.value.hiddenSidebarItems || []).length;
    const allHidden = this.preferences.value.hideAllSidebarMenuItems;

    // Context-specific active binder or label route actions
    const url = this.router.url;
    if (url.startsWith('/binder/')) {
      const currentBinder = decodeURIComponent(url.slice('/binder/'.length).split('?')[0]);
      if (currentBinder) {
        actions.push(
          {
            id: 'rename-current-binder',
            label: `Rename binder "${currentBinder}"...`,
            icon: 'drive_file_rename_outline',
            run: () => this.openRenameBinderDialog(currentBinder)
          },
          {
            id: 'sub-current-binder',
            label: `New sub-binder in "${currentBinder}"...`,
            icon: 'create_new_folder',
            run: () => this.openCreateBinderDialog(currentBinder)
          }
        );
      }
    } else if (url.startsWith('/label/')) {
      const currentLabel = decodeURIComponent(url.slice('/label/'.length).split('?')[0]);
      const labelObj = this.Shared.label.list.find(l => l.name.toLowerCase() === currentLabel.toLowerCase());
      if (currentLabel) {
        actions.push({
          id: 'rename-current-label',
          label: `Rename label "${currentLabel}"...`,
          icon: 'drive_file_rename_outline',
          run: () => this.openRenameLabelDialog(currentLabel, labelObj?.id)
        });
      }
    }

    actions.push(
      {
        id: 'new-binder',
        label: 'Create new binder...',
        icon: 'create_new_folder',
        dividerBefore: actions.length > 0,
        run: () => this.openCreateBinderDialog('')
      },
      {
        id: 'edit-binders',
        label: 'Manage & rename binders...',
        icon: 'folder_open',
        run: () => this.Shared.openBinderModalForParent.next(null)
      },
      {
        id: 'new-label',
        label: 'Create new label...',
        icon: 'new_label',
        run: () => this.openCreateLabelDialog()
      },
      {
        id: 'edit-labels',
        label: 'Manage & rename labels...',
        icon: 'label',
        run: () => this.Shared.openEditLabelsModal.next()
      },
      {
        id: 'toggle-view',
        label: this.Shared.noteViewType.value === 'grid' ? 'Switch to List view' : 'Switch to Grid view',
        icon: this.Shared.noteViewType.value === 'grid' ? 'view_agenda' : 'grid_view',
        dividerBefore: true,
        run: () => this.Shared.toggleNoteViewType()
      }
    );

    if (this.Shared.selectedNoteIds.value.length > 0) {
      actions.push(
        {
          id: 'delete-selected-notes',
          label: `Delete selected notes (${this.Shared.selectedNoteIds.value.length})`,
          icon: 'delete_outline',
          danger: true,
          dividerBefore: true,
          run: () => this.Shared.bulkTrashSelected()
        },
        {
          id: 'clear-selection',
          label: 'Clear note selection',
          icon: 'deselect',
          run: () => this.Shared.clearNoteSelection()
        }
      );
    }

    actions.push({
      id: 'toggle-hide-all-menu',
      label: allHidden ? 'Show all left-hand menu items' : 'Hide all left-hand menu items',
      icon: allHidden ? 'visibility' : 'visibility_off',
      dividerBefore: true,
      run: () => {
        this.preferences.update({ hideAllSidebarMenuItems: !allHidden });
      }
    });

    if (hiddenCount > 0) {
      actions.push({
        id: 'restore-hidden-items',
        label: `Put back ${hiddenCount} hidden menu ${hiddenCount === 1 ? 'item' : 'items'}`,
        icon: 'restore',
        run: () => {
          this.preferences.restoreAllSidebarItems();
          this.showToast('All hidden menu items restored');
        }
      });
    }

    actions.push({
      id: 'open-settings',
      label: 'Settings & Themes',
      icon: 'palette',
      dividerBefore: true,
      run: () => { void this.router.navigateByUrl('/settings'); }
    });

    return {
      title: inSidebar ? 'Left Menu Options' : 'SageKept Workspace',
      icon: inSidebar ? 'menu' : 'grid_view',
      actions
    };
  }

  // --- Dialog helpers ---

  openRenameBinderDialog(binderName: string) {
    this.dialogMode = 'rename-binder';
    this.dialogTitle = 'Rename binder';
    this.dialogSubtitle = `Enter a new name for "${binderName}".`;
    this.dialogTargetName = binderName;
    this.dialogValue = binderName;
    this.dialogError = '';
    this.focusDialogInput();
  }

  openCreateBinderDialog(parentName: string) {
    this.dialogMode = 'create-binder';
    this.dialogTitle = parentName ? `New sub-binder inside "${parentName}"` : 'Create new binder';
    this.dialogSubtitle = 'Organize notes and sub-binders into a hierarchical project folder.';
    this.dialogParentBinder = parentName || '';
    this.dialogValue = '';
    this.dialogError = '';
    this.focusDialogInput();
  }

  openDeleteBinderDialog(binderName: string) {
    this.dialogMode = 'delete-binder';
    this.dialogTitle = `Delete binder "${binderName}"?`;
    this.dialogSubtitle = 'Notes inside this binder will be kept, and any sub-binders will move up one level.';
    this.dialogTargetName = binderName;
    this.dialogError = '';
  }

  openRenameLabelDialog(labelName: string, labelId?: number) {
    this.dialogMode = 'rename-label';
    this.dialogTitle = 'Rename label';
    this.dialogSubtitle = `Update "${labelName}" across all tagged notes.`;
    this.dialogTargetName = labelName;
    this.dialogTargetId = labelId || this.Shared.label.list.find(l => l.name.toLowerCase() === labelName.toLowerCase())?.id || 0;
    this.dialogValue = labelName;
    this.dialogError = '';
    this.focusDialogInput();
  }

  openCreateLabelDialog() {
    this.dialogMode = 'create-label';
    this.dialogTitle = 'Create new label';
    this.dialogSubtitle = 'Add a label to categorize and filter your notes.';
    this.dialogValue = '';
    this.dialogError = '';
    this.focusDialogInput();
  }

  openDeleteLabelDialog(labelName: string, labelId?: number) {
    this.dialogMode = 'delete-label';
    this.dialogTitle = `Delete label "${labelName}"?`;
    this.dialogSubtitle = 'This removes the label from all notes. Your notes themselves will not be deleted.';
    this.dialogTargetName = labelName;
    this.dialogTargetId = labelId || this.Shared.label.list.find(l => l.name.toLowerCase() === labelName.toLowerCase())?.id || 0;
    this.dialogError = '';
  }

  openRenameNoteDialog(note: NoteI) {
    this.dialogMode = 'rename-note';
    this.dialogTitle = 'Rename note title';
    this.dialogSubtitle = 'Update the title of this note.';
    this.dialogNote = note;
    this.dialogValue = this.extractPlainText(note.noteTitle);
    this.dialogError = '';
    this.focusDialogInput();
  }

  openNoteBinderDialog(note: NoteI) {
    this.dialogMode = 'note-binder';
    this.dialogTitle = 'Move note to binder';
    this.dialogSubtitle = 'Choose an existing binder or create a new one below.';
    this.dialogNote = note;
    this.dialogValue = '';
    this.dialogError = '';
  }

  openNoteLabelsDialog(note: NoteI) {
    this.dialogMode = 'note-labels';
    this.dialogTitle = 'Manage note labels';
    this.dialogSubtitle = 'Toggle labels on this note or create a new label.';
    this.dialogNote = note;
    this.newDialogLabelName = '';
    this.dialogError = '';
    const existingMap = new Map<string, boolean>();
    for (const l of note.labels || []) {
      if (l?.name) existingMap.set(l.name.toLowerCase(), l.added === true);
    }
    this.dialogNoteLabels = this.Shared.label.list.map(l => ({
      id: l.id,
      name: l.name,
      added: existingMap.get(l.name.toLowerCase()) === true
    }));
  }

  closeDialog() {
    if (this.dialogBusy) return;
    this.dialogMode = null;
    this.dialogNote = undefined;
    this.dialogError = '';
  }

  formatIndentedBinder(node: BinderTreeNode): string {
    return `${'— '.repeat(node.depth)}${node.name}`;
  }

  async submitDialog() {
    if (this.dialogBusy || !this.dialogMode) return;
    this.dialogError = '';

    if (this.dialogMode === 'rename-binder') {
      const nextName = this.dialogValue.trim();
      const oldName = this.dialogTargetName;
      if (!nextName) {
        this.dialogError = 'Please enter a binder name.';
        return;
      }
      if (nextName === oldName) {
        this.closeDialog();
        return;
      }
      const conflict = this.Shared.binder.list.some(
        b => b.name.toLowerCase() === nextName.toLowerCase() && b.name.toLowerCase() !== oldName.toLowerCase()
      );
      if (conflict) {
        this.dialogError = 'A binder with that name already exists.';
        return;
      }
      this.dialogBusy = true;
      try {
        await this.Shared.binder.db.update(oldName, nextName);
        this.preferences.renameSidebarItem('binder:' + oldName.toLowerCase(), 'binder:' + nextName.toLowerCase());
        if (this.router.url === `/binder/${encodeURIComponent(oldName)}`) {
          void this.router.navigate(['/binder', nextName]);
        }
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Binder renamed to "${nextName}"`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not rename binder. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'create-binder') {
      const name = this.dialogValue.trim();
      if (!name) {
        this.dialogError = 'Please enter a binder name.';
        return;
      }
      const exists = this.Shared.binder.list.some(b => b.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        this.dialogError = 'A binder with that name already exists.';
        return;
      }
      this.dialogBusy = true;
      try {
        const parent = this.dialogParentBinder.trim() || null;
        await this.Shared.binder.db.add(name, parent);
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Binder "${name}" created`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not create binder. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'delete-binder') {
      const name = this.dialogTargetName;
      this.dialogBusy = true;
      try {
        await this.Shared.binder.db.delete(name);
        this.preferences.showSidebarItem('binder:' + name.toLowerCase());
        if (this.router.url === `/binder/${encodeURIComponent(name)}`) {
          void this.router.navigateByUrl('/');
        }
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Binder "${name}" deleted`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not delete binder. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'rename-label') {
      const nextName = this.dialogValue.trim();
      const oldName = this.dialogTargetName;
      if (!nextName) {
        this.dialogError = 'Please enter a label name.';
        return;
      }
      if (nextName === oldName) {
        this.closeDialog();
        return;
      }
      const conflict = this.Shared.label.list.some(
        l => l.name.toLowerCase() === nextName.toLowerCase() && l.name.toLowerCase() !== oldName.toLowerCase()
      );
      if (conflict) {
        this.dialogError = 'A label with that name already exists.';
        return;
      }
      this.dialogBusy = true;
      try {
        let labelId = this.dialogTargetId;
        if (!labelId) {
          const found = this.Shared.label.list.find(l => l.name.toLowerCase() === oldName.toLowerCase());
          labelId = found?.id || 0;
        }
        if (labelId) {
          this.Shared.label.id = labelId;
          await this.Shared.label.db.update({ name: nextName });
          await this.Shared.label.db.updateAllLabels(nextName);
        }
        this.preferences.renameSidebarItem('label:' + oldName.toLowerCase(), 'label:' + nextName.toLowerCase());
        if (this.router.url === `/label/${encodeURIComponent(oldName)}`) {
          void this.router.navigate(['/label', nextName]);
        }
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Label renamed to "${nextName}"`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not rename label. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'create-label') {
      const name = this.dialogValue.trim();
      if (!name) {
        this.dialogError = 'Please enter a label name.';
        return;
      }
      const exists = this.Shared.label.list.some(l => l.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        this.dialogError = 'A label with that name already exists.';
        return;
      }
      this.dialogBusy = true;
      try {
        await this.Shared.label.db.add({ name });
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Label "${name}" created`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not create label. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'delete-label') {
      const name = this.dialogTargetName;
      this.dialogBusy = true;
      try {
        let labelId = this.dialogTargetId;
        if (!labelId) {
          labelId = this.Shared.label.list.find(l => l.name.toLowerCase() === name.toLowerCase())?.id || 0;
        }
        if (labelId) {
          this.Shared.label.id = labelId;
          await this.Shared.label.db.delete();
          await this.Shared.label.db.updateAllLabels('');
        }
        this.preferences.showSidebarItem('label:' + name.toLowerCase());
        if (this.router.url === `/label/${encodeURIComponent(name)}`) {
          void this.router.navigateByUrl('/');
        }
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast(`Label "${name}" deleted`);
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not delete label. Please try again.';
      }
      return;
    }

    if (this.dialogMode === 'rename-note' && this.dialogNote?.id) {
      const nextTitle = this.escapeHtml(this.dialogValue.trim());
      this.dialogBusy = true;
      try {
        this.Shared.note.id = this.dialogNote.id;
        await this.notesService.updateKey({ noteTitle: nextTitle }, this.dialogNote.id);
        this.dialogNote.noteTitle = nextTitle;
        this.dialogBusy = false;
        this.closeDialog();
        this.showToast('Note title updated');
      } catch {
        this.dialogBusy = false;
        this.dialogError = 'Could not update note title.';
      }
      return;
    }
  }

  async assignNoteToBinder(binderName: string) {
    if (!this.dialogNote?.id || this.dialogBusy) return;
    this.dialogBusy = true;
    try {
      await this.notesService.updateKey({ binder: binderName }, this.dialogNote.id);
      this.dialogNote.binder = binderName;
      this.dialogBusy = false;
      this.closeDialog();
      this.showToast(binderName ? `Moved note to "${binderName}"` : 'Removed note from binder');
    } catch {
      this.dialogBusy = false;
      this.dialogError = 'Could not move note to binder.';
    }
  }

  async createAndAssignNoteBinder() {
    const name = this.dialogValue.trim();
    if (!name || !this.dialogNote?.id || this.dialogBusy) return;
    this.dialogBusy = true;
    try {
      const exists = this.Shared.binder.list.some(b => b.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        await this.Shared.binder.db.add(name, null);
      }
      await this.notesService.updateKey({ binder: name }, this.dialogNote.id);
      this.dialogNote.binder = name;
      this.dialogBusy = false;
      this.closeDialog();
      this.showToast(`Moved note to "${name}"`);
    } catch {
      this.dialogBusy = false;
      this.dialogError = 'Could not create and assign binder.';
    }
  }

  async toggleDialogNoteLabel(item: { id?: number; name: string; added: boolean }) {
    if (!this.dialogNote?.id || this.dialogBusy) return;
    item.added = !item.added;
    const updatedLabels: LabelI[] = this.dialogNoteLabels
      .filter(l => l.added)
      .map(l => ({ id: l.id, name: l.name, added: true }));
    this.Shared.note.id = this.dialogNote.id;
    await this.notesService.updateKey({ labels: updatedLabels }, this.dialogNote.id);
    this.dialogNote.labels = updatedLabels;
  }

  async createAndAddDialogNoteLabel() {
    const name = this.newDialogLabelName.trim();
    if (!name || !this.dialogNote?.id || this.dialogBusy) return;
    this.dialogBusy = true;
    try {
      let existing = this.dialogNoteLabels.find(l => l.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.added = true;
      } else {
        const id = await this.Shared.label.db.add({ name });
        this.dialogNoteLabels.unshift({ id, name, added: true });
      }
      this.newDialogLabelName = '';
      const updatedLabels: LabelI[] = this.dialogNoteLabels
        .filter(l => l.added)
        .map(l => ({ id: l.id, name: l.name, added: true }));
      this.Shared.note.id = this.dialogNote.id;
      await this.notesService.updateKey({ labels: updatedLabels }, this.dialogNote.id);
      this.dialogNote.labels = updatedLabels;
    } catch {
      this.dialogError = 'Could not add label.';
    } finally {
      this.dialogBusy = false;
    }
  }

  private focusDialogInput() {
    setTimeout(() => {
      const input = this.dialogInput?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 20);
  }

  private hideSidebarItemWithUndo(itemId: string, itemLabel: string) {
    this.preferences.hideSidebarItem(itemId);
    this.showUndoToast(`Hidden "${itemLabel}" from left menu`, () => {
      this.preferences.showSidebarItem(itemId);
    });
  }

  private showToast(text: string) {
    try {
      Snackbar?.show({
        pos: 'bottom-left',
        text,
        duration: 3200
      });
    } catch {}
  }

  private showUndoToast(text: string, onUndo: () => void) {
    try {
      Snackbar?.show({
        pos: 'bottom-left',
        text,
        actionText: 'Undo',
        actionTextColor: '#8ab4f8',
        duration: 4800,
        onActionClick: (el: HTMLElement) => {
          if (el) el.style.opacity = '0';
          this.zone.run(() => onUndo());
        }
      });
    } catch {}
  }

  private extractPlainText(html: string | undefined): string {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
