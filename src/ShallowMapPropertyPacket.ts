import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players } from "@rbxts/services";
import AbstractPropertyPacket from "./AbstractPropertyPacket";
import Environment from "./Environment";
import SignalPacket from "./SignalPacket";

export type ShallowObject = Record<string, unknown>;

const enum EntryChangeType {
    Replace = "replace",
    Patch = "patch",
    Delete = "delete",
}

type ReplaceChange<K, V> = {
    type: EntryChangeType.Replace;
    key: K;
    value: V;
};

type PatchChange<K, V> = {
    type: EntryChangeType.Patch;
    key: K;
    sets: Partial<V>;
    deletes: Array<keyof V & string>;
};

type DeleteChange<K> = {
    type: EntryChangeType.Delete;
    key: K;
};

type DiffChange<K, V extends ShallowObject> = ReplaceChange<K, V> | PatchChange<K, V> | DeleteChange<K>;

type DiffPayload<K, V extends ShallowObject> = {
    full: boolean;
    changes: Array<DiffChange<K, V>>;
};

export type ShallowObjectMapDiffChange<K, V extends ShallowObject> = DiffChange<K, V>;
export type ShallowObjectMapDiffPayload<K, V extends ShallowObject> = DiffPayload<K, V>;

function cloneObject<V extends ShallowObject>(value: V): V {
    const cloned = {} as V;
    for (const [field, fieldValue] of pairs(value as unknown as Record<string, object>)) {
        cloned[field as keyof V] = fieldValue as V[keyof V];
    }
    return cloned;
}

function cloneDiff<K, V extends ShallowObject>(diff: DiffPayload<K, V>): DiffPayload<K, V> {
    const clonedChanges = new Array<DiffChange<K, V>>();
    for (const change of diff.changes) {
        if (change.type === EntryChangeType.Replace) {
            clonedChanges.push({ type: change.type, key: change.key, value: cloneObject(change.value) });
        } else if (change.type === EntryChangeType.Patch) {
            const sets = {} as Partial<V>;
            for (const [field, fieldValue] of pairs(change.sets as unknown as Record<string, object>)) {
                sets[field as keyof V] = fieldValue as V[keyof V];
            }
            const deletes = new Array<keyof V & string>();
            for (const field of change.deletes) {
                deletes.push(field);
            }
            clonedChanges.push({ type: change.type, key: change.key, sets, deletes });
        } else {
            clonedChanges.push({ type: change.type, key: change.key });
        }
    }
    return { full: diff.full, changes: clonedChanges };
}

function cloneMap<K, V extends ShallowObject>(map: Map<K, V>): Map<K, V> {
    const cloned = new Map<K, V>();
    for (const [key, value] of map) {
        cloned.set(key, cloneObject(value));
    }
    return cloned;
}

/**
 * ShallowMapPropertyPacket synchronizes a map of primitive keys to shallow object values using diff-based updates.
 */
export default class ShallowMapPropertyPacket<K, V extends ShallowObject> extends AbstractPropertyPacket<Map<K, V>> {
    readonly className = "ShallowMapPropertyPacket";
    readonly signalPacket: SignalPacket<(payload: DiffPayload<K, V>) => void>;

    private state: Map<K, V>;
    private changed?: Signal<(snapshot: Map<K, V>, diff: DiffPayload<K, V>) => void>;
    private perPlayer?: Map<Player, Map<K, V> | undefined>;
    private playerRemoving?: RBXScriptConnection;

    constructor(
        id: string,
        initialEntries?: Map<K, V>,
        isUnreliable?: boolean,
        meta?: Modding.Many<SerializerMetadata<Parameters<(payload: DiffPayload<K, V>) => void>>>,
    ) {
        super();
        this.state = initialEntries !== undefined ? table.clone(initialEntries) : new Map<K, V>();
        this.signalPacket = new SignalPacket<(payload: DiffPayload<K, V>) => void>(id, isUnreliable === true, meta);

        if (Environment.IS_VIRTUAL) {
            this.changed = new Signal();
            this.perPlayer = new Map();
        } else if (Environment.IS_SERVER) {
            this.perPlayer = new Map();
            this.signalPacket.remoteEvent.SetAttribute("RemoteShallowObjectMap", true);
            this.playerRemoving = Players.PlayerRemoving.Connect((player) => {
                this.perPlayer?.delete(player);
            });
            this.signalPacket.remoteEvent.OnServerEvent.Connect((player) => {
                this.signalPacket.toClient(player, this.createFullDiffForPlayer(player));
            });
        } else {
            this.changed = new Signal();
            this.signalPacket.fromServer((payload) => {
                this.applyDiff(payload);
                this.changed?.fire(this.snapshot(), cloneDiff(payload));
            });
            this.signalPacket.remoteEvent.FireServer();
        }
    }

    private createFullDiffFrom(map: Map<K, V>): DiffPayload<K, V> {
        const changes = new Array<DiffChange<K, V>>();
        for (const [key, value] of map) {
            changes.push({ type: EntryChangeType.Replace, key, value: cloneObject(value) });
        }
        return { full: true, changes };
    }

    private createFullDiff(): DiffPayload<K, V> {
        return this.createFullDiffFrom(this.state);
    }

    private createFullDiffForPlayer(player: Player): DiffPayload<K, V> {
        return this.createFullDiffFrom(this.getStateForPlayer(player));
    }

    private snapshot() {
        return cloneMap(this.state);
    }

    private getStateForPlayer(player: Player): Map<K, V> {
        const perPlayerState = this.perPlayer?.get(player);
        if (perPlayerState !== undefined) {
            return perPlayerState;
        }
        return this.state;
    }

    private applyDiff(payload: DiffPayload<K, V>) {
        if (payload.full) {
            this.state = new Map<K, V>();
        }
        for (const change of payload.changes) {
            if (change.type === EntryChangeType.Replace) {
                this.state.set(change.key, cloneObject(change.value));
            } else if (change.type === EntryChangeType.Patch) {
                const current = this.state.get(change.key) ?? ({} as V);
                const updated = cloneObject(current);
                for (const [field, fieldValue] of pairs(change.sets as unknown as Record<string, object>)) {
                    updated[field as keyof V] = fieldValue as V[keyof V];
                }
                for (const field of change.deletes) {
                    (updated as Record<string, unknown>)[field] = undefined;
                }
                this.state.set(change.key, updated);
            } else {
                this.state.delete(change.key);
            }
        }
    }

    private computeDiff(currentMap: Map<K, V>, nextMap: Map<K, V>): Array<DiffChange<K, V>> {
        const changes = new Array<DiffChange<K, V>>();

        for (const [key, nextValue] of nextMap) {
            const hasCurrent = currentMap.has(key);
            if (!hasCurrent) {
                changes.push({ type: EntryChangeType.Replace, key, value: cloneObject(nextValue) });
                continue;
            }

            const currentValue = currentMap.get(key)!;
            const sets = {} as Partial<V>;
            const deletes = new Array<keyof V & string>();
            let modified = false;
            const visitedFields = new Set<string>();

            for (const [field, fieldValue] of pairs(nextValue as unknown as Record<string, object>)) {
                const fieldName = field as keyof V & string;
                const currentFieldValue = currentValue[field as keyof V] as object | undefined;
                if (currentFieldValue !== fieldValue) {
                    sets[field as keyof V] = fieldValue as V[keyof V];
                    modified = true;
                }
                visitedFields.add(fieldName);
            }

            const currentRecord = currentValue as unknown as Record<string, object | undefined>;
            for (const [field] of pairs(currentValue as unknown as Record<string, object>)) {
                const fieldName = field as keyof V & string;
                if (!visitedFields.has(fieldName) && currentRecord[fieldName] !== undefined) {
                    deletes.push(fieldName);
                    modified = true;
                }
            }

            if (modified) {
                changes.push({ type: EntryChangeType.Patch, key, sets, deletes });
            }
        }

        for (const [key] of currentMap) {
            if (!nextMap.has(key)) {
                changes.push({ type: EntryChangeType.Delete, key });
            }
        }

        return changes;
    }

    private dispatch(diff: DiffPayload<K, V>) {
        if (diff.changes.size() === 0 && diff.full === false) {
            return;
        }

        if (Environment.IS_VIRTUAL) {
            this.changed?.fire(this.snapshot(), cloneDiff(diff));
            return;
        }

        if (Environment.IS_SERVER) {
            const payload = cloneDiff(diff);
            this.signalPacket.toAllClients(payload);
        }
    }

    private dispatchToPlayer(player: Player, diff: DiffPayload<K, V>) {
        if (diff.changes.size() === 0 && diff.full === false) {
            return;
        }

        if (Environment.IS_VIRTUAL) {
            this.changed?.fire(this.snapshot(), cloneDiff(diff));
            return;
        }

        if (Environment.IS_SERVER) {
            this.signalPacket.toClient(player, cloneDiff(diff));
        }
    }

    getSnapshot() {
        return this.snapshot();
    }

    getEntry(key: K) {
        const value = this.state.get(key);
        return value ? cloneObject(value) : undefined;
    }

    get(player?: Player): Map<K, V> {
        if (Environment.IS_SERVER) {
            if (player !== undefined) {
                const perPlayerState = this.perPlayer?.get(player);
                if (perPlayerState !== undefined) {
                    return cloneMap(perPlayerState);
                }
            }
            return this.snapshot();
        }

        if (Environment.IS_VIRTUAL) {
            const localPlayer = Players.LocalPlayer;
            if (player === undefined && localPlayer !== undefined) {
                player = localPlayer;
            }
            if (player !== undefined) {
                const perPlayerState = this.perPlayer?.get(player);
                if (perPlayerState !== undefined) {
                    return cloneMap(perPlayerState);
                }
            }
        }

        return this.snapshot();
    }

    set(entries: Map<K, V>) {
        const changes = this.computeDiff(this.state, entries);

        if (changes.size() === 0) {
            return;
        }

        this.state = table.clone(entries);
        this.perPlayer?.clear();
        this.dispatch({ full: false, changes });
    }

    setFor(player: Player, value: Map<K, V>): void {
        if (this.perPlayer === undefined) {
            this.perPlayer = new Map();
        }

        const currentMap = this.perPlayer.get(player) ?? new Map<K, V>();
        const changes = this.computeDiff(currentMap, value);

        if (changes.size() === 0) {
            return;
        }

        if (player.Parent !== undefined || Environment.IS_VIRTUAL) {
            this.perPlayer.set(player, value);
        } else {
            this.perPlayer.delete(player);
        }

        this.dispatchToPlayer(player, { full: false, changes });
    }

    setEntry(key: K, value: V) {
        const cloned = cloneObject(value);
        this.state.set(key, cloned);
        this.dispatch({ full: false, changes: [{ type: EntryChangeType.Replace, key, value: cloneObject(cloned) }] });
    }

    patchEntry(key: K, patch: Partial<V>, deletes?: Array<keyof V & string>) {
        const current = this.state.get(key);
        if (!current) {
            this.setEntry(key, patch as V);
            return;
        }

        const sets = {} as Partial<V>;
        const deleteList = new Array<keyof V & string>();
        let modified = false;

        for (const [field, value] of pairs(patch as unknown as Record<string, object | undefined>)) {
            const fieldValue = value as V[keyof V] | undefined;
            if (fieldValue !== undefined && current[field as keyof V] !== fieldValue) {
                sets[field as keyof V] = fieldValue;
                modified = true;
            }
        }

        if (deletes) {
            for (const field of deletes) {
                if (current[field as keyof V] !== undefined) {
                    deleteList.push(field);
                    modified = true;
                }
            }
        }

        if (!modified) {
            return;
        }

        const updated = cloneObject(current);
        for (const [field, value] of pairs(sets as unknown as Record<string, object>)) {
            updated[field as keyof V] = value as V[keyof V];
        }
        for (const field of deleteList) {
            (updated as Record<string, unknown>)[field] = undefined;
        }
        this.state.set(key, updated);
        this.dispatch({ full: false, changes: [{ type: EntryChangeType.Patch, key, sets, deletes: deleteList }] });
    }

    deleteFields(key: K, fields: Array<keyof V & string>) {
        this.patchEntry(key, {} as Partial<V>, fields);
    }

    deleteEntry(key: K) {
        if (!this.state.has(key)) {
            return;
        }
        this.state.delete(key);
        this.dispatch({ full: false, changes: [{ type: EntryChangeType.Delete, key }] });
    }

    clear() {
        if (this.state.size() === 0) {
            return;
        }
        const changes = new Array<DiffChange<K, V>>();
        for (const [key] of this.state) {
            changes.push({ type: EntryChangeType.Delete, key });
        }
        this.state.clear();
        this.perPlayer?.clear();
        this.dispatch({ full: false, changes });
    }

    clearFor(player: Player): void {
        if (this.perPlayer === undefined) {
            this.perPlayer = new Map();
        }

        if (player.Parent !== undefined || Environment.IS_VIRTUAL) {
            this.perPlayer.set(player, undefined);
        } else {
            this.perPlayer.delete(player);
        }

        this.dispatchToPlayer(player, this.createFullDiff());
    }

    observe(handler: (snapshot: Map<K, V>, diff: DiffPayload<K, V>) => void) {
        task.spawn(() => {
            handler(this.snapshot(), this.createFullDiff());
        });

        if (this.changed === undefined) {
            this.changed = new Signal();
        }

        return this.changed.connect((snapshot, diff) => handler(cloneMap(snapshot), cloneDiff(diff)));
    }

    destroy() {
        if (this.playerRemoving !== undefined) {
            this.playerRemoving.Disconnect();
        }
        this.perPlayer?.clear();
        this.changed?.destroy();
        this.signalPacket.destroy();
    }
}
