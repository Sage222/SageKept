import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CatalogItem } from '../interfaces/workspace';
import { createUuid } from '../utils/uuid';
import { OfflineStoreService } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ShareUserI } from '../interfaces/users';

export interface BinderSharingInfo {
  binder: { id: number; name: string; ownerDisplayName?: string; ownerUsername?: string };
  members: ShareUserI[];
  canManage: boolean;
}

@Injectable({ providedIn: 'root' })
export class BindersService {
  private migratingLegacy = false;
  private loadRevision = 0;
  private loadedPartition = '';
  readonly items$ = new BehaviorSubject<CatalogItem[]>([]);
  readonly sharedItems$ = new BehaviorSubject<CatalogItem[]>([]);
  constructor(private store: OfflineStoreService, public sync: OfflineSyncService,private auth: AuthService, private http: HttpClient) {
    this.sync.cacheChanged$.subscribe(change => { if (!change?.positionsOnly) this.load().catch(console.error); });
  }
  async load() {
    const revision = ++this.loadRevision;
    if (!this.sync.partition) {
      this.loadedPartition = '';
      this.items$.next([]);
      this.sharedItems$.next([]);
      return;
    }
    const partition = this.sync.partition;
    let items = await this.store.listResources<CatalogItem>('binder', partition);
    if (partition !== this.sync.partition || revision !== this.loadRevision) return;
    if (!this.auth.isLocal && this.sync.writesLocally && this.auth.currentUser) {
      const legacyKey = `kept_binders_v1:${environment.apiUrl || location.origin}:${this.auth.currentUser.id}`;
      const marker = `${legacyKey}:workspace-migrated`;
      if (localStorage.getItem(marker) !== 'done' && !this.migratingLegacy) {
        // Mark before emitting committed changes to avoid recursive migration.
        this.migratingLegacy = true;
        try {
          const names = JSON.parse(localStorage.getItem(legacyKey) || '[]');
          let legacyParents: Record<string, string> = {};
          try {
            const parsedParents = JSON.parse(localStorage.getItem(`${legacyKey}:parents`) || '{}');
            if (parsedParents && typeof parsedParents === 'object') legacyParents = parsedParents;
          } catch {}
          for (const [index, name] of names.entries()) if (typeof name === 'string' && name.trim() && !items.some(item=>item.name.toLowerCase() === name.trim().toLowerCase())) {
            if (partition !== this.sync.partition) return;
            const cleanLegacyName = name.trim().slice(0, 80);
            const legacyParent = legacyParents[cleanLegacyName.toLowerCase()];
            await this.sync.commit('binder.upsert',`binder-${createUuid()}`,{
              name: cleanLegacyName,
              ...(legacyParent ? { parentName: String(legacyParent).trim().slice(0, 80) } : {}),
              ...(localStorage.getItem(`${legacyKey}:custom-order`) === '1' ? { sortOrder: index } : {})
            });
          }
          localStorage.setItem(marker,'done');
          items = await this.store.listResources<CatalogItem>('binder', this.sync.partition);
        } catch(error) {localStorage.removeItem(marker);throw error;} finally {this.migratingLegacy = false;}
      }
    }
    if (partition !== this.sync.partition || revision !== this.loadRevision) return;
    this.loadedPartition = partition;
    this.sharedItems$.next(items.filter(item => item.shared).sort((a,b) => a.name.localeCompare(b.name) || a.id-b.id));
    items = [...new Map(items.filter(item=>!item.shared).map(item=>[item.name.toLowerCase(),item])).values()];
    this.items$.next(items.sort((a, b) =>
      (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
  }
  private async ensureLoaded() {
    if (this.loadedPartition !== this.sync.partition) {
      await this.load();
    }
  }
  private validateParent(name: string, oldName: string | undefined, parentName: string | null) {
    if (!parentName) return null;
    const targetKeys = new Set([name.toLowerCase(), ...(oldName ? [oldName.toLowerCase()] : [])]);
    if (targetKeys.has(parentName.toLowerCase())) {
      throw new Error('A binder cannot be placed inside itself.');
    }
    const byKey = new Map(this.items$.value.map(item => [item.name.toLowerCase(), item]));
    let cursor: string | null | undefined = parentName;
    const visited = new Set<string>();
    while (cursor) {
      const key = cursor.toLowerCase();
      if (targetKeys.has(key)) {
        throw new Error('Cannot nest a binder inside one of its sub-binders.');
      }
      if (visited.has(key)) break;
      visited.add(key);
      cursor = byKey.get(key)?.parentName || null;
    }
    const existingParent = byKey.get(parentName.toLowerCase());
    return existingParent ? existingParent.name : parentName;
  }

  async save(name: string, oldName?: string, parentName?: string | null) {
    await this.ensureLoaded();
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new Error('Binder name is required.');
    const previous = this.items$.value.find(item => item.name.toLowerCase() === (oldName || name).toLowerCase());
    const ordered = this.items$.value.filter(item => item.sortOrder != null);
    const sortOrder = previous?.sortOrder ?? (ordered.length ? Math.max(...ordered.map(item => item.sortOrder!)) + 1 : null);
    const rawParent = parentName === undefined ? (previous?.parentName ?? null) : (String(parentName || '').trim().slice(0, 80) || null);
    const resolvedParent = this.validateParent(clean, oldName || previous?.name, rawParent);
    if (resolvedParent && !this.items$.value.some(item => item.name.toLowerCase() === resolvedParent.toLowerCase())) {
      await this.sync.commit('binder.upsert', `binder-${createUuid()}`, {
        name: resolvedParent,
        parentName: null,
        sortOrder: null
      });
    }
    await this.sync.commit('binder.upsert', previous?.syncId || `binder-${createUuid()}`, {
      ...previous,
      name: clean,
      parentName: resolvedParent,
      sortOrder
    });
    if (previous && previous.name.toLowerCase() !== clean.toLowerCase()) {
      const children = this.items$.value.filter(
        item => item.parentName && item.parentName.toLowerCase() === previous.name.toLowerCase()
      );
      for (const child of children) {
        await this.sync.commit('binder.upsert', child.syncId, { ...child, parentName: clean });
      }
    }
    await this.load();
  }
  async setParent(name: string, parentName: string | null) {
    await this.save(name, name, parentName);
  }
  async reorder(names: string[]) {
    await this.ensureLoaded();
    const partition = this.sync.partition;
    for (const [sortOrder, name] of names.entries()) {
      if (partition !== this.sync.partition) throw new Error('The active workspace changed.');
      const previous = this.items$.value.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (previous?.sortOrder === sortOrder) continue;
      await this.sync.commit('binder.upsert', previous?.syncId || `binder-${createUuid()}`, { ...previous, name, sortOrder });
    }
    await this.load();
  }
  async delete(name: string) {
    await this.ensureLoaded();
    const previous = this.items$.value.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (previous) {
      const promotedParent = previous.parentName || null;
      const children = this.items$.value.filter(
        item => item.parentName && item.parentName.toLowerCase() === previous.name.toLowerCase()
      );
      for (const child of children) {
        await this.sync.commit('binder.upsert', child.syncId, { ...child, parentName: promotedParent });
      }
      await this.sync.commit('binder.delete', previous.syncId, previous);
    }
    await this.load();
  }

  async sharingPreviews(): Promise<Map<string, ShareUserI[]>> {
    const response=await firstValueFrom(this.http.get<{
      binders:CatalogItem[]; memberships?:Array<{binderId:number;userId:number}>; users?:ShareUserI[];
    }>(`${environment.apiUrl}/binders?includeSharing=1`,{headers:this.auth.authHeaders()}));
    if (!response.memberships || !response.users) return new Map();
    const users=new Map(response.users.map(user=>[user.id,user]));
    const previews=new Map<string,ShareUserI[]>();
    for (const binder of response.binders.filter(binder=>!binder.shared)) {
      const ids=new Set((response.memberships || []).filter(member=>member.binderId===binder.id).map(member=>member.userId));
      previews.set(binder.name.toLowerCase(),[...users.values()].filter(user=>ids.has(user.id)));
    }
    return previews;
  }

  async sharingForName(name: string): Promise<BinderSharingInfo> {
    await this.sync.syncNow();
    const response = await firstValueFrom(this.http.get<{binders:CatalogItem[]}>(`${environment.apiUrl}/binders`,{headers:this.auth.authHeaders()}));
    const binder = response.binders.find(item => !item.shared && item.name.toLowerCase()===name.toLowerCase());
    if (!binder) throw new Error('Sync this binder before sharing it.');
    return this.sharing(binder.id);
  }
  async sharing(id: number): Promise<BinderSharingInfo> {
    return firstValueFrom(this.http.get<BinderSharingInfo>(`${environment.apiUrl}/binders/${id}/members`,{headers:this.auth.authHeaders()}));
  }
  async share(id: number,userIds: number[]): Promise<BinderSharingInfo> {
    const result = await firstValueFrom(this.http.put<BinderSharingInfo>(`${environment.apiUrl}/binders/${id}/members`,{userIds},{headers:this.auth.authHeaders()}));
    await this.sync.syncNow();await this.load();return result;
  }
  async leave(id: number) {
    await firstValueFrom(this.http.delete(`${environment.apiUrl}/binders/${id}/membership`,{headers:this.auth.authHeaders()}));
    await this.sync.syncNow();await this.load();
  }
}
