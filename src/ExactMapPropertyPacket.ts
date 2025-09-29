import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players } from "@rbxts/services";
import AbstractMapPropertyPacket from "./AbstractMapPropertyPacket";
import Environment from "./Environment";
import SignalPacket from "./SignalPacket";

const enum DiffChangeType {
    Set = "set",
    Delete = "delete",
}

type DiffChange<K, V> = { type: DiffChangeType.Set; key: K; value: V } | { type: DiffChangeType.Delete; key: K };

type DiffPayload<K, V> = {
    full: boolean;
    changes: Array<DiffChange<K, V>>;
};

export type ExactMapDiffChange<K, V> = DiffChange<K, V>;
export type ExactMapDiffPayload<K, V> = DiffPayload<K, V>;

function cloneDiff<K, V>(diff: DiffPayload<K, V>): DiffPayload<K, V> {
    return {
        full: diff.full,
        changes: diff.changes.map((change) => {
            if (change.type === DiffChangeType.Set) {
                return {
                    type: change.type,
                    key: change.key,
                    value: change.value,
                } satisfies DiffChange<K, V>;
            }
            return {
                type: change.type,
                key: change.key,
            } satisfies DiffChange<K, V>;
        }),
    };
}

function cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
    const result = new Map<K, V>();
    for (const [key, value] of map) {
        result.set(key, value);
    }
    return result;
}

/**
 * ExactMapPropertyPacket synchronizes a map using diff-based updates, where update checks
 * are based on exact equality of values.
 */
export default class ExactMapPropertyPacket<K, V> extends AbstractMapPropertyPacket<K, V> {
    readonly className = "ExactMapPropertyPacket";
    readonly signalPacket: SignalPacket<(payload: DiffPayload<K, V>) => void>;

    private state: Map<K, V>;
    private changed?: Signal<(snapshot: Map<K, V>, diff: DiffPayload<K, V>) => void>;
    private perPlayer?: Map<Player, Map<K, V> | undefined>;
    private playerRemoving?: RBXScriptConnection;

    constructor(
        id: string,
        initialEntries?: ReadonlyMap<K, V>,
        isUnreliable?: boolean,
        meta?: Modding.Many<SerializerMetadata<Parameters<(payload: DiffPayload<K, V>) => void>>>,
    ) {
        super();
        this.state = initialEntries !== undefined ? table.clone(initialEntries) : new Map();
        this.signalPacket = new SignalPacket<(payload: DiffPayload<K, V>) => void>(id, isUnreliable === true, meta);

        if (Environment.IS_VIRTUAL) {
            this.changed = new Signal();
            this.perPlayer = new Map();
        } else if (Environment.IS_SERVER) {
            this.perPlayer = new Map();
            this.signalPacket.remoteEvent.SetAttribute("RemotePrimitiveMap", true);
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
        const changes: Array<DiffChange<K, V>> = [];
        for (const [key, value] of map) {
            changes.push({ type: DiffChangeType.Set, key, value });
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
            if (change.type === DiffChangeType.Set) {
                this.state.set(change.key, change.value);
            } else {
                this.state.delete(change.key);
            }
        }
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
        return this.state.get(key);
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
        const changes: Array<DiffChange<K, V>> = [];

        for (const [key, value] of entries) {
            if (this.state.get(key) !== value) {
                changes.push({ type: DiffChangeType.Set, key, value });
            }
        }

        for (const [key] of this.state) {
            if (!entries.has(key)) {
                changes.push({ type: DiffChangeType.Delete, key });
            }
        }

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
        const changes: Array<DiffChange<K, V>> = [];

        for (const [key, nextValue] of value) {
            if (currentMap.get(key) !== nextValue) {
                changes.push({ type: DiffChangeType.Set, key, value: nextValue });
            }
        }

        for (const [key] of currentMap) {
            if (!value.has(key)) {
                changes.push({ type: DiffChangeType.Delete, key });
            }
        }

        if (changes.size() === 0) {
            return;
        }

        if (player.Parent !== undefined) {
            this.perPlayer.set(player, value);
        } else {
            this.perPlayer.delete(player);
        }

        this.dispatchToPlayer(player, { full: false, changes });
    }

    setEntry(key: K, value: V) {
        if (this.state.get(key) === value) {
            return;
        }

        this.state.set(key, value);
        this.dispatch({ full: false, changes: [{ type: DiffChangeType.Set, key, value }] });
    }

    setEntries(entries: Map<K, V>) {
        const changes: Array<DiffChange<K, V>> = [];

        for (const [key, value] of entries) {
            if (this.state.get(key) !== value) {
                changes.push({ type: DiffChangeType.Set, key, value });
                this.state.set(key, value);
            }
        }

        if (changes.isEmpty()) {
            return;
        }

        this.dispatch({ full: false, changes });
    }

    deleteEntry(key: K) {
        if (!this.state.has(key)) {
            return false;
        }

        this.state.delete(key);
        this.dispatch({ full: false, changes: [{ type: DiffChangeType.Delete, key }] });
        return true;
    }

    clear() {
        if (this.state.isEmpty()) {
            return;
        }

        const changes: Array<DiffChange<K, V>> = [];
        for (const [key] of this.state) {
            changes.push({ type: DiffChangeType.Delete, key });
        }

        this.state.clear();
        this.perPlayer?.clear();
        this.dispatch({ full: false, changes });
    }

    clearFor(player: Player): void {
        if (this.perPlayer === undefined) {
            this.perPlayer = new Map();
        }

        if (player.Parent !== undefined) {
            this.perPlayer.set(player, undefined);
        } else {
            this.perPlayer.delete(player);
        }

        this.dispatchToPlayer(player, this.createFullDiff());
    }

    /**
     * Observes map changes. Handler receives the latest snapshot and the diff payload.
     */
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
