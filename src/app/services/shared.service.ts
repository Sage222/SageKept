import { uiText, uiPlural } from 'src/app/i18n/messages';
import { Injectable, NgZone } from '@angular/core';
import { NoteI, NoteModelI, UpdateKeyI } from '../interfaces/notes';
import { NotesService } from './notes.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { LabelsService } from './labels.service';
import { LabelI, LabelModelI } from '../interfaces/labels';
import { createDemoNotes, demoWelcomeText } from '../utils/demo-notes';
import { AuthService } from './auth.service';
import { ReminderService } from './reminder.service';
import { createPopper, type Instance, type Modifier, type Placement } from '@popperjs/core';
import { CatalogItem } from '../interfaces/workspace';
import { BindersService } from './binders.service';
import { environment } from 'src/environments/environment';
declare var Snackbar: any
export type WidgetCreateType = 'plain' | 'checklist' | 'drawing'
export type WidgetCreateRequest = { requestId: string; type: WidgetCreateType }
export interface BinderTreeNode {
  name: string;
  parentName: string | null;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  path: string[];
  memberCount?: number;
  sortOrder?: number | null;
}
@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private tooltipPositioners = new WeakMap<HTMLDivElement, Instance>();
  private tooltipOutsideListeners = new WeakMap<HTMLDivElement, (event: Event) => void>();
  private readonly binderStorageKey = 'kept_binders_v1';
  private readonly noteViewTypeStorageKey = 'kept_note_view_type';

  // PWA State
  deferredInstallPrompt?: any;
  isIos = false;
  isMobile = false;
  isStandalone = false;
  showInstallButton = new BehaviorSubject<boolean>(false);

  private creatingExamples = false;
  private serverLabels: LabelI[] = [];

  constructor(
    private Notes: NotesService,
    private Labels: LabelsService,
    private auth: AuthService,
    private reminders: ReminderService,
    private ngZone: NgZone,
    private binders: BindersService
  ) {
    // Wire the result subscriptions once. Loads happen in response to
    // currentUser$ — that way a fresh login (or a session that arrives
    // after async auth bootstrap, common on iOS Safari/PWA) triggers a
    // load. Without this, the constructor-time load runs before the
    // session is ready and the page stays blank until manual refresh.
    this.Labels.labelsList$.subscribe({
      next: (result: LabelI[]) => {
        this.serverLabels = result || [];
        this.refreshLabelList();
      },
      error: error => console.error(error)
    })
    this.Notes.notesList$.subscribe({
      next: (result: NoteI[] | null) => {
        if (result === null) return;
        this.ngZone.run(() => {
          const ordered = [...result]
          this.note.pinned = ordered.filter(x => x.pinned === true)
          this.note.unpinned = ordered.filter(x => x.pinned === false)
          this.note.all = ordered
          this.refreshLabelList();
          this.refreshBinderList();
        })
      },
      error: error => console.error(error)
    })

    this.binders.items$.subscribe(() => this.refreshBinderList());
    this.binders.sharedItems$.subscribe(items => this.sharedBinders = items);
    this.auth.accessChanges$.subscribe(async user => {
      if (this.auth.isLocal) {
        try {
          await this.auth.workspace.seedDemoNotes();
          if (!this.auth.isLocal) return;
          await this.Notes.load(); await this.Labels.load(); await this.binders.load();
        } catch (error) { console.error('Could not load the device library', error); }
        return;
      }
      if (user) {
        // If this user has never had demos seeded server-side, do that
        // *before* the first notes load. That way the user lands on a
        // populated grid on first login — they shouldn't have to refresh
        // or sign out/in to see the starter content.
        const needsDemos = !user.demoNotesCreatedAt
        if (needsDemos && navigator.onLine) {
          await this.createExampleNotes()
        }
        this.Notes.load().catch(console.error)
        if (navigator.onLine) this.Labels.load().catch(console.error)
      } else {
        // Logout: clear the in-memory mirror so the next user doesn't
        // briefly see the previous account's notes.
        this.note.pinned = []
        this.note.unpinned = []
        this.note.all = []
        this.serverLabels = []
        this.label.list = []
        this.binder.list = [];this.binder.treeList = [];this.sharedBinders = []
      }
    })
  }

  closeSideBar = new Subject<boolean>()
  closeSideBarIfOpen = new Subject<boolean>()
  sideBarCollapsed = new BehaviorSubject<boolean>(false)
  openMobileComposer = new Subject<boolean>()
  widgetCreateRequested = new Subject<WidgetCreateRequest>()
  widgetComposerOpened = new Subject<WidgetCreateRequest>()
  closeMobileComposer = new Subject<boolean>()
  openSelectedReminder = new Subject<void>()
  deleteSelectedForever = new Subject<void>()
  selectAllNotes = new Subject<void>()
  saveNote = new Subject<boolean>()
  closeModal = new Subject<boolean>()
  drawingNoteRequested = new Subject<void>()
  noteViewType = new BehaviorSubject<'list' | 'grid'>(this.initialNoteViewType())
  selectedNoteIds = new BehaviorSubject<number[]>([])
  searchScope = new BehaviorSubject<'all' | 'current'>(this.initialSearchScope())
  searchQuery = ''
  openBinderModalForParent = new Subject<string | null>()
  includeSubBinderNotes = new BehaviorSubject<boolean>(this.initialIncludeSubBinderNotes())
  // Keep an autosaved inline draft out of this tab's overview until closed.
  composerDraftSyncId?: string

  initPwa() {
    const ua = navigator.userAgent;
    this.isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isMobile = this.isIos || /android|mobile/i.test(ua);
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    this.updateInstallVisibility();

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.ngZone.run(() => this.updateInstallVisibility());
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = undefined;
      this.isStandalone = true;
      this.ngZone.run(() => this.updateInstallVisibility());
    });
  }

  private readonly installFabDismissedKey = 'gk_install_fab_dismissed';

  updateInstallVisibility() {
    this.showInstallButton.next(this.isMobile && !this.isStandalone && (this.isIos || !!this.deferredInstallPrompt));
  }

  isInstallFabDismissed(): boolean {
    try { return localStorage.getItem(this.installFabDismissedKey) === '1'; } catch { return false; }
  }

  dismissInstallFab() {
    try { localStorage.setItem(this.installFabDismissedKey, '1'); } catch {}
    // Re-emit so subscribers can hide the FAB.
    this.showInstallButton.next(this.showInstallButton.value);
  }

  setSearchQuery(query: string) {
    this.searchQuery = query
    this.Notes.setSearchQuery(query)
  }

  setSearchScope(scope: 'all' | 'current') {
    this.searchScope.next(scope)
    try { localStorage.setItem('kept_search_scope', scope); } catch {}
  }

  setNoteViewType(type: 'list' | 'grid') {
    this.noteViewType.next(type)
    try { localStorage.setItem(this.noteViewTypeStorageKey, type); } catch {}
  }

  toggleNoteViewType() {
    this.setNoteViewType(this.noteViewType.value === 'grid' ? 'list' : 'grid')
  }

  private initialNoteViewType(): 'list' | 'grid' {
    try {
      return localStorage.getItem(this.noteViewTypeStorageKey) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  }

  private initialSearchScope(): 'all' | 'current' {
    try {
      return localStorage.getItem('kept_search_scope') === 'current' ? 'current' : 'all'
    } catch {
      return 'all'
    }
  }

  private initialIncludeSubBinderNotes(): boolean {
    try {
      return localStorage.getItem('kept_include_sub_binder_notes') !== '0';
    } catch {
      return true;
    }
  }

  setIncludeSubBinderNotes(enabled: boolean) {
    this.includeSubBinderNotes.next(enabled);
    try { localStorage.setItem('kept_include_sub_binder_notes', enabled ? '1' : '0'); } catch {}
  }

  async refreshData() {
    await Promise.all([
      this.Notes.load(),
      this.Labels.load(),
      this.reminders.load()
    ])
  }

  toggleNoteSelection(noteId: number) {
    const selected = this.selectedNoteIds.value
    this.selectedNoteIds.next(selected.includes(noteId) ? selected.filter(id => id !== noteId) : [...selected, noteId])
  }

  clearNoteSelection() {
    this.selectedNoteIds.next([])
  }

  private refreshLabelList() {
    const labels: LabelI[] = [];
    const seen = new Set<string>();

    for (const label of this.serverLabels) {
      this.addLabelIfMissing(labels, seen, label);
    }

    const derivedLabels = (this.note.all || [])
      .flatMap(note => note.labels || [])
      .filter(label => label?.added === true);

    for (const label of derivedLabels) {
      this.addLabelIfMissing(labels, seen, label);
    }

    this.label.list = labels.sort((a, b) => this.compareLabels(a, b));
  }

  private addLabelIfMissing(target: LabelI[], seen: Set<string>, label?: LabelI) {
    const name = String(label?.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    // This is the available-label catalog, not a selection for any one note.
    target.push({ ...label, name, added: false });
  }

  private compareLabels(a: LabelI, b: LabelI) {
    const byOrder = (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
    const byName = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    return byOrder || byName || Number(a.id || 0) - Number(b.id || 0);
  }

  private binderStoragePartition() {
    if (this.auth.isLocal) return `${this.binderStorageKey}:local:${this.auth.workspace.local?.id}`;
    const server = environment.apiUrl || location.origin;
    const userId = this.auth.currentUser?.id || 'anon';
    return `${this.binderStorageKey}:${server}:${userId}`;
  }

  private storedBinders(): string[] {
    try {
      const raw = localStorage.getItem(this.binderStoragePartition());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private saveStoredBinders(names: string[]) {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const name of names.map(item => String(item || '').trim()).filter(Boolean)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(name);
    }
    try { localStorage.setItem(this.binderStoragePartition(), JSON.stringify(unique)); } catch {}
  }

  private storedBinderParents(): Record<string, string> {
    try {
      const raw = localStorage.getItem(`${this.binderStoragePartition()}:parents`);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveStoredBinderParents(map: Record<string, string>) {
    try { localStorage.setItem(`${this.binderStoragePartition()}:parents`, JSON.stringify(map)); } catch {}
  }

  refreshBinderList() {
    const names = [
      ...(this.binders.sync.writesLocally ? this.binders.items$.value.map(item => item.name) : this.storedBinders()),
      ...(this.note.all || []).filter(note => !note.sharedBinder || note.sharedBinder.ownerUserId === this.auth.currentUser?.id || this.auth.currentUser?.inheritSharedBinders === false).map(note => note.binder || '').filter(Boolean)
    ];
    const unique: { name: string; parentName?: string | null; sortOrder?: number | null; memberCount?: number }[] = [];
    const customLegacyOrder = !this.binders.sync.writesLocally && localStorage.getItem(`${this.binderStoragePartition()}:custom-order`) === '1';
    const legacyParents = this.binders.sync.writesLocally ? {} : this.storedBinderParents();
    const catalog = new Map(this.binders.items$.value.map(item => [item.name.toLowerCase(), item]));
    const seen = new Set<string>();
    for (const name of names) {
      const clean = String(name || '').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rawParent = this.binders.sync.writesLocally
        ? (catalog.get(key)?.parentName || null)
        : (legacyParents[key] || null);
      unique.push({
        name: clean,
        parentName: rawParent ? String(rawParent).trim() : null,
        memberCount: catalog.get(key)?.memberCount || 0,
        sortOrder: this.binders.sync.writesLocally ? catalog.get(key)?.sortOrder : customLegacyOrder ? names.indexOf(name) : null
      });
    }
    unique.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    this.binder.list = unique;
    this.binder.treeList = this.buildBinderTree(unique);
  }

  private buildBinderTree(items: { name: string; parentName?: string | null; sortOrder?: number | null; memberCount?: number }[]): BinderTreeNode[] {
    const byKey = new Map(items.map(item => [item.name.toLowerCase(), item]));
    const childrenByParent = new Map<string, typeof items>();
    const roots: typeof items = [];

    const hasCycleToSelf = (item: typeof items[number]): boolean => {
      const selfKey = item.name.toLowerCase();
      let cursor = item.parentName ? item.parentName.toLowerCase() : null;
      const visited = new Set<string>([selfKey]);
      while (cursor) {
        if (visited.has(cursor)) return true;
        visited.add(cursor);
        const parentItem = byKey.get(cursor);
        cursor = parentItem?.parentName ? parentItem.parentName.toLowerCase() : null;
      }
      return false;
    };

    for (const item of items) {
      const parentKey = item.parentName ? item.parentName.toLowerCase() : null;
      if (!parentKey || !byKey.has(parentKey) || hasCycleToSelf(item)) {
        roots.push(item);
      } else {
        const list = childrenByParent.get(parentKey) || [];
        list.push(item);
        childrenByParent.set(parentKey, list);
      }
    }

    const result: BinderTreeNode[] = [];
    const visited = new Set<string>();
    const walk = (node: typeof items[number], depth: number, ancestorPath: string[]) => {
      const key = node.name.toLowerCase();
      if (visited.has(key)) return;
      visited.add(key);
      const children = childrenByParent.get(key) || [];
      const canonicalParent = node.parentName && byKey.has(node.parentName.toLowerCase())
        ? byKey.get(node.parentName.toLowerCase())!.name
        : null;
      const path = [...ancestorPath, node.name];
      result.push({
        name: node.name,
        parentName: canonicalParent,
        depth,
        hasChildren: children.length > 0,
        childCount: children.length,
        path,
        memberCount: node.memberCount,
        sortOrder: node.sortOrder
      });
      for (const child of children) {
        walk(child, depth + 1, path);
      }
    };

    for (const root of roots) {
      walk(root, 0, []);
    }
    // Safety net for any orphaned cycles
    for (const item of items) {
      if (!visited.has(item.name.toLowerCase())) {
        walk(item, 0, []);
      }
    }
    return result;
  }

  getBinderAncestors(name: string): string[] {
    const node = this.binder.treeList.find(item => item.name.toLowerCase() === String(name || '').toLowerCase());
    if (!node) return [];
    return node.path.slice(0, -1);
  }

  getBinderChildren(name: string): BinderTreeNode[] {
    const key = String(name || '').toLowerCase();
    return this.binder.treeList.filter(item => (item.parentName || '').toLowerCase() === key);
  }

  getBinderDescendantNames(name: string): string[] {
    const key = String(name || '').toLowerCase();
    const descendants: string[] = [];
    const queue = [key];
    const visited = new Set<string>([key]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const node of this.binder.treeList) {
        if ((node.parentName || '').toLowerCase() === current) {
          const childKey = node.name.toLowerCase();
          if (!visited.has(childKey)) {
            visited.add(childKey);
            descendants.push(node.name);
            queue.push(childKey);
          }
        }
      }
    }
    return descendants;
  }

  canReparentBinder(name: string, candidateParent: string | null): boolean {
    if (!candidateParent) return true;
    const selfKey = String(name || '').toLowerCase();
    const candidateKey = candidateParent.toLowerCase();
    if (selfKey === candidateKey) return false;
    const descendants = new Set(this.getBinderDescendantNames(name).map(item => item.toLowerCase()));
    return !descendants.has(candidateKey);
  }

  isNoteSelected(noteId?: number) {
    return !!noteId && this.selectedNoteIds.value.includes(noteId)
  }

  async bulkUpdateSelected(object: UpdateKeyI) {
    for (const noteId of this.selectedNoteIds.value) {
      await this.Notes.updateKey(object, noteId)
    }
  }

  async bulkCloneSelected() {
    for (const noteId of this.selectedNoteIds.value) {
      await this.Notes.clone(noteId)
    }
    this.clearNoteSelection()
  }

  async bulkTrashSelected() {
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id))
    const leftSharedCount = await this.Notes.trashMany(selected.map(note => note.id!))
    this.clearNoteSelection()
    if (leftSharedCount) {
      Snackbar.show({
        pos: 'bottom-left',
        text: uiPlural('notes.shared_notes_removed', leftSharedCount),
        duration: 3000
      })
    }
  }

  async bulkTogglePinSelected() {
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id))
    const shouldPin = selected.some(note => !note.pinned)
    await this.bulkUpdateSelected({ pinned: shouldPin })
  }

  get selectedNotesArchived() {
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id))
    return selected.length > 0 && selected.every(note => note.archived)
  }

  async bulkArchiveSelected() {
    const archived = !this.selectedNotesArchived
    const userId = this.auth?.currentUser?.id
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id))
    // Archive state is owner-only; the server ignores it for shared notes.
    const owned = selected.filter(note => !note.ownerUserId || !userId || note.ownerUserId === userId)
    for (const note of owned) await this.Notes.updateKey({ archived, trashed: false }, note.id!)
    this.clearNoteSelection()
    if (owned.length < selected.length) {
      (globalThis as any).Snackbar?.show({ pos: 'bottom-left', text: uiText('notes.only_the_owner_can_archive_this_note'), duration: 4000 })
    }
  }

  canOrganizeNote(note: NoteI, kind: 'labels' | 'binders') {
    return !note.ownerUserId || note.ownerUserId === this.auth.currentUser?.id ||
      (kind === 'labels' ? this.auth.currentUser?.inheritSharedLabels === false : this.auth.currentUser?.inheritSharedBinders === false);
  }

  canOrganizeSelection(kind: 'labels' | 'binders') {
    return this.note.all.some(note => note.id && this.selectedNoteIds.value.includes(note.id) && this.canOrganizeNote(note, kind));
  }

  selectionOrganizationHint(kind: 'labels' | 'binders') {
    const shared = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id) && note.ownerUserId && note.ownerUserId !== this.auth.currentUser?.id);
    if (!shared.length) return '';
    return shared.some(note => !this.canOrganizeNote(note, kind))
      ? uiText(kind === 'binders' ? 'organization.selected_binder' : 'organization.selected_labels')
      : uiText('notes.only_changes_your_organization_of_shared_notes');
  }

  async bulkApplyLabel(label: LabelI) {
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id) && this.canOrganizeNote(note, 'labels'))
    const shouldAdd = selected.some(note => !note.labels.some(noteLabel => noteLabel.id === label.id && noteLabel.added))

    for (const note of selected) {
      let labels = [...note.labels]
      const existing = labels.find(noteLabel => noteLabel.id === label.id)
      if (shouldAdd) {
        if (existing) existing.added = true
        else labels = [...labels, { ...label, added: true }]
      } else {
        labels = labels.filter(noteLabel => noteLabel.id !== label.id)
      }
      await this.Notes.updateKey({ labels }, note.id!)
    }
  }

  async bulkApplyBinder(name: string) {
    const binder = String(name || '').trim();
    if (binder) await this.binder.db.add(binder);
    const selected = this.note.all.filter(note => note.id && this.selectedNoteIds.value.includes(note.id) && this.canOrganizeNote(note, 'binders'));
    for (const note of selected) {
      await this.Notes.updateKey({ binder }, note.id!);
    }
  }

  async bulkMergeSelected(orderedIds: number[]) {
    if (!orderedIds || orderedIds.length < 2) return null
    const newNoteId = await this.Notes.merge(orderedIds)
    this.clearNoteSelection()
    return newNoteId
  }

  // ? note -------------------------------------------------

  note: NoteModelI = {
    id: -1,
    pinned: [],
    unpinned: [],
    all: [],
    db: {
      add: (data: NoteI) => this.Notes.add(data),
      update: (data: NoteI) => this.Notes.update(data, this.note.id),
      updateKey: (data: UpdateKeyI) => this.Notes.updateKey(data, this.note.id),
      updateAllLabels: (labelId: number, labelValue: string) => this.Notes.updateAllLabels(labelId, labelValue),
      uploadImage: (file: File) => this.Notes.uploadImage(file),
      uploadAttachment: (noteId: number, file: File) => this.Notes.uploadAttachment(noteId, file),
      deleteAttachment: (noteId: number, attachmentId: number) => this.Notes.deleteAttachment(noteId, attachmentId),
      downloadAttachment: (attachment) => this.Notes.downloadAttachment(attachment),
      get: () => this.Notes.get(this.note.id),
      listShareUsers: () => this.Notes.listShareUsers(),
      getCollaborators: () => this.Notes.getCollaborators(this.note.id),
      updateCollaborators: (userIds: number[]) => this.Notes.updateCollaborators(this.note.id, userIds),
      reorder: (ids: number[], movedId?: number) => this.Notes.reorder(ids,movedId),
      clone: () => this.Notes.clone(this.note.id),
      moveBinder: (id: number,target: Parameters<NotesService['moveBinder']>[1]) => this.Notes.moveBinder(id,target),
      delete: () => this.Notes.delete(this.note.id),
      trash: async () => {
        const note = this.note.all.find(n => n.id === this.note.id)
        if (note?.isDemo) {
          const otherDemoNotes = this.note.all.filter(n => n.isDemo && n.id !== this.note.id)
          if (otherDemoNotes.length > 0) {
            if (confirm(uiText('notes.would_you_like_to_delete_the_rest_of_the_demo_notes_too'))) {
              const demoNotes = this.note.all.filter(n => n.isDemo)
              for (const dn of demoNotes) {
                await this.Notes.updateKey({ trashed: true, archived: false }, dn.id!)
              }
              this.snackBar({ action: 'trashed all demo notes', opposite: 'restored' }, { trashed: false }, this.note.id)
              return
            }
          }
        }
        await this.note.db.updateKey({ trashed: true, archived: false })
        this.snackBar({ action: 'trashed', opposite: 'restored' }, { trashed: false }, this.note.id)
      },
    },

  }

  private async createExampleNotes() {
    if (this.creatingExamples || !this.auth.currentUser) return;
    this.creatingExamples = true;
    // Mark before creating so re-entrant loads cannot seed duplicates.
    try { await this.auth.markDemoNotesCreated(); } catch {}
    try {
      let label: LabelI = { name: 'Sweet Thoughts' };
      try { label.id = await this.Labels.add(label); } catch {}
      for (const [index, note] of createDemoNotes(label).entries()) {
        const noteId = await this.Notes.add(note);
        if (!noteId || noteId === -1) continue;
        if (index === 5) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          await this.reminders.create({
            noteId, dueAtUtc: tomorrow.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            title: note.noteTitle,
            body: 'Kept will handle the whole "remembering-things" stuff with push notifications across all devices.'
          });
        }
        if (index === 6) {
          try {
            await this.Notes.uploadAttachment(noteId, new Blob([demoWelcomeText], { type: 'text/plain' }), 'welcome.txt');
          } catch (error) { console.warn('Could not attach demo welcome.txt', error); }
        }
      }
    } catch (error) {
      console.error('Failed to create example notes', error);
    } finally {
      this.creatingExamples = false;
    }
  }

  // ? labell -------------------------------------------------

  label: LabelModelI = {
    id: -1,
    list: [],
    db: {
      add: async (data: LabelI) => this.Labels.add(data),
      update: (data: LabelI) => this.Labels.update(data, this.label.id),
      delete: () => this.Labels.delete(this.label.id),
      noteCounts: () => this.Labels.noteCounts(),
      reorder: (labels: LabelI[]) => this.Labels.reorder(labels),
      updateAllLabels: (value: any) => this.note.db.updateAllLabels(this.label.id, value),
    }
  }

  sharedBinders: CatalogItem[] = [];
  binder = {
    list: [] as { name: string; parentName?: string | null; memberCount?: number; sortOrder?: number | null }[],
    treeList: [] as BinderTreeNode[],
    db: {
      reorder: async (names: string[]) => {
        if (this.binders.sync.writesLocally) return this.binders.reorder(names);
        this.saveStoredBinders(names);
        localStorage.setItem(`${this.binderStoragePartition()}:custom-order`, '1');
        this.refreshBinderList();
      },
      add: async (name: string, parentName?: string | null) => {
        if (this.binders.sync.writesLocally) return this.binders.save(name, undefined, parentName);
        const clean = String(name || '').trim();
        if (!clean) return;
        const names = this.storedBinders();
        if (!names.some(item => item.toLowerCase() === clean.toLowerCase())) {
          this.saveStoredBinders([...names, clean]);
        }
        if (parentName !== undefined) {
          const parents = this.storedBinderParents();
          const cleanParent = String(parentName || '').trim();
          if (cleanParent && cleanParent.toLowerCase() !== clean.toLowerCase()) {
            parents[clean.toLowerCase()] = cleanParent;
          } else {
            delete parents[clean.toLowerCase()];
          }
          this.saveStoredBinderParents(parents);
        }
        this.refreshBinderList();
      },
      update: async (oldName: string, newName: string, parentName?: string | null) => {
        if (this.binders.sync.writesLocally) return this.binders.save(newName, oldName, parentName);
        const oldClean = String(oldName || '').trim();
        const newClean = String(newName || '').trim();
        if (!oldClean || !newClean) return;
        const names = this.storedBinders().map(item => item.toLowerCase() === oldClean.toLowerCase() ? newClean : item);
        this.saveStoredBinders(names);
        const parents = this.storedBinderParents();
        const oldKey = oldClean.toLowerCase();
        const newKey = newClean.toLowerCase();
        const existingParent = parents[oldKey];
        if (oldKey !== newKey) {
          delete parents[oldKey];
          if (existingParent) parents[newKey] = existingParent;
          for (const [childKey, pName] of Object.entries(parents)) {
            if (pName.toLowerCase() === oldKey) parents[childKey] = newClean;
          }
        }
        if (parentName !== undefined) {
          const cleanParent = String(parentName || '').trim();
          if (cleanParent && this.canReparentBinder(oldClean, cleanParent)) {
            parents[newKey] = cleanParent;
          } else if (!cleanParent) {
            delete parents[newKey];
          }
        }
        this.saveStoredBinderParents(parents);
        for (const note of this.note.all.filter(note => (note.binder || '').toLowerCase() === oldKey)) {
          if (note.id) await this.Notes.updateKey({ binder: newClean }, note.id);
        }
        this.refreshBinderList();
      },
      setParent: async (name: string, parentName: string | null) => {
        if (this.binders.sync.writesLocally) return this.binders.setParent(name, parentName);
        const clean = String(name || '').trim();
        if (!clean) return;
        const cleanParent = parentName ? String(parentName).trim() : null;
        if (!this.canReparentBinder(clean, cleanParent)) {
          throw new Error('Cannot nest a binder inside itself or one of its sub-binders.');
        }
        const parents = this.storedBinderParents();
        if (cleanParent) parents[clean.toLowerCase()] = cleanParent;
        else delete parents[clean.toLowerCase()];
        this.saveStoredBinderParents(parents);
        this.refreshBinderList();
      },
      delete: async (name: string) => {
        if (this.binders.sync.writesLocally) return this.binders.delete(name);
        const clean = String(name || '').trim();
        if (!clean) return;
        const key = clean.toLowerCase();
        this.saveStoredBinders(this.storedBinders().filter(item => item.toLowerCase() !== key));
        const parents = this.storedBinderParents();
        const promotedParent = parents[key] || '';
        delete parents[key];
        for (const [childKey, pName] of Object.entries(parents)) {
          if (pName.toLowerCase() === key) {
            if (promotedParent) parents[childKey] = promotedParent;
            else delete parents[childKey];
          }
        }
        this.saveStoredBinderParents(parents);
        for (const note of this.note.all.filter(note => (note.binder || '').toLowerCase() === key)) {
          if (note.id) await this.Notes.updateKey({ binder: '' }, note.id);
        }
        this.refreshBinderList();
      }
    }
  }

  // ? snakebar (aka toast) --------------------------------------

  snackBar(text: { action: string, opposite: string }, obj: UpdateKeyI, noteId: number) {
    const messages: Record<string, string> = {
      archived: 'notes.note_archived', unarchived: 'notes.note_unarchived',
      trashed: 'notes.note_trashed', restored: 'notes.note_restored',
      'left shared note': 'notes.note_left_shared_note', rejoined: 'notes.note_rejoined',
      'trashed all demo notes': 'notes.note_trashed_all_demo_notes'
    };
    const message = (action: string) => uiText(messages[action] || `Note ${action}`);
    Snackbar.show({
      pos: 'bottom-left',
      text: message(text.action),
      actionText: uiText('common.undo'),
      duration: 4200,
      onActionClick: () => {
        const uObj = obj as any
        if (uObj['rejoin']) {
          this.Notes.rejoin(noteId, uObj['userId'] as number)
        } else {
          this.note.id = noteId
          this.note.db.updateKey(obj)
        }
        Snackbar.show({
          pos: 'bottom-left',
          text: message(text.opposite),
          duration: 3000,
        })
      }
    })
  }


  // ? Tooltip --------------------------------------

  createTooltip(button: HTMLElement, tooltipEl: HTMLDivElement, placement: Placement = 'bottom') {
    this.removeTooltipOutsideListener(tooltipEl)
    tooltipEl.dataset['isTooltipOpen'] = 'true'
    this.tooltipPositioners.get(tooltipEl)?.destroy();
    const appearancePicker = tooltipEl.classList.contains('colorMenu');
    const surface = appearancePicker ? button.closest<HTMLElement>('.note-main, .note-container, .selection-navbar') : null;
    // Keep the menu below/above its button, but align it with the note rather
    // than the button's position halfway across the toolbar.
    const appearanceSize: Partial<Modifier<'appearanceSize', Record<string, never>>> = {
      name: 'appearanceSize', enabled: true, phase: 'beforeRead',
      fn: () => {
        const rect = button.getBoundingClientRect();
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop || 0;
        const bottom = top + (viewport?.height || window.innerHeight);
        const below = bottom - rect.bottom - 20;
        const above = rect.top - top - 20;
        // Prefer a scrollable menu below the toolbar when it can show a useful
        // portion of the grids, rather than flipping it over the note's text.
        tooltipEl.style.maxHeight = `${Math.max(120, below >= 260 ? below : Math.max(above, below))}px`;
      },
      effect: ({ instance }) => {
        const updateSize = () => {
          // offsetWidth excludes the editor's opening animation scale.
          if (surface) tooltipEl.style.setProperty('--appearance-anchor-width', `${surface.offsetWidth}px`);
          void instance.update();
        };
        updateSize();
        // Sidebar changes can resize cards without a window resize.
        const observer = surface && typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(updateSize) : undefined;
        if (surface) observer?.observe(surface);
        const modal = surface?.closest('.modal');
        modal?.addEventListener('transitionend', updateSize);
        return () => {
          observer?.disconnect();
          modal?.removeEventListener('transitionend', updateSize);
          tooltipEl.style.removeProperty('--appearance-anchor-width');
          tooltipEl.style.removeProperty('max-height');
        };
      }
    };
    this.tooltipPositioners.set(tooltipEl, createPopper(button, tooltipEl, appearancePicker ? {
      placement: placement === 'bottom' ? 'bottom-start' : placement,
      strategy: 'fixed',
      modifiers: [
        appearanceSize,
        { name: 'offset', options: { offset: () => [surface ? surface.getBoundingClientRect().left - button.getBoundingClientRect().left : 0, 8] } },
        { name: 'flip', options: { padding: 12, flipVariations: false } },
        { name: 'preventOverflow', options: { padding: 12, altAxis: true, tether: false } }
      ]
    } : { placement }));
    // Defer the outside-click listener by one frame and use `click` instead
    // of `mousedown`. On iOS the first tap on a menu item arrives via the
    // synthetic mousedown → click sequence; if we listen on mousedown we
    // race the menu item's click handler and can close the tooltip before
    // it fires, which the user perceives as needing to tap twice.
    const fct = (event: Event) => {
      const target = event.target as Node
      if (!tooltipEl.contains(target) && !button.contains(target)) {
        this.closeTooltip(tooltipEl)
      }
    }
    this.tooltipOutsideListeners.set(tooltipEl, fct)
    requestAnimationFrame(() => {
      if (tooltipEl.dataset['isTooltipOpen'] !== 'true') return
      document.addEventListener('click', fct, true)
    })
  }

  closeTooltip(tooltipEl: HTMLDivElement) {
    tooltipEl.dataset['isTooltipOpen'] = 'false'
    this.tooltipPositioners.get(tooltipEl)?.destroy();
    this.tooltipPositioners.delete(tooltipEl);
    this.removeTooltipOutsideListener(tooltipEl)
  }

  updateTooltip(tooltipEl: HTMLDivElement) {
    if (tooltipEl.dataset['isTooltipOpen'] === 'true') void this.tooltipPositioners.get(tooltipEl)?.update();
  }

  private removeTooltipOutsideListener(tooltipEl: HTMLDivElement) {
    const listener = this.tooltipOutsideListeners.get(tooltipEl)
    if (!listener) return
    document.removeEventListener('click', listener, true)
    this.tooltipOutsideListeners.delete(tooltipEl)
  }

}
