import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players } from "@rbxts/services";
import AbstractPropertyPacket from "./AbstractPropertyPacket";
import Environment from "./Environment";
import SignalPacket from "./SignalPacket";

const enum DiffChangeType {
    Add = "add",
    Delete = "delete",
}

type DiffChange<T> = { type: DiffChangeType.Add; value: T } | { type: DiffChangeType.Delete; value: T };

type DiffPayload<T> = {
    full: boolean;
    changes: Array<DiffChange<T>>;
};

export type ExactSetDiffChange<T> = DiffChange<T>;
export type ExactSetDiffPayload<T> = DiffPayload<T>;

function cloneDiff<T>(diff: DiffPayload<T>): DiffPayload<T> {
    return {
        full: diff.full,
        changes: diff.changes.map((change) => {
            if (change.type === DiffChangeType.Add) {
                return {
                    type: change.type,
                    value: change.value,
                } satisfies DiffChange<T>;
            }

            return {
                type: change.type,
                value: change.value,
            } satisfies DiffChange<T>;
        }),
    };
}

function cloneSet<T>(set: ReadonlySet<T>): Set<T> {
    const result = new Set<T>();
    for (const value of set) {
        result.add(value);
    }
    return result;
}

/**
 * ExactSetPropertyPacket synchronizes a set using diff-based updates, where update checks
 * are based on membership of set values.
 */
export default class ExactSetPropertyPacket<T> extends AbstractPropertyPacket<Set<T>> {
    readonly className = "ExactSetPropertyPacket";
    readonly signalPacket: SignalPacket<(payload: DiffPayload<T>) => void>;

    private state: Set<T>;
    private changed?: Signal<(snapshot: Set<T>, diff: DiffPayload<T>) => void>;
    private perPlayer?: Map<Player, Set<T> | undefined>;
    private playerRemoving?: RBXScriptConnection;

    constructor(
        id: string,
        initialValues?: ReadonlySet<T>,
        isUnreliable?: boolean,
        meta?: Modding.Many<SerializerMetadata<Parameters<(payload: DiffPayload<T>) => void>>>,
    ) {
        super();
        this.state = initialValues !== undefined ? cloneSet(initialValues) : new Set<T>();
        this.signalPacket = new SignalPacket<(payload: DiffPayload<T>) => void>(id, isUnreliable === true, meta);

        if (Environment.IS_VIRTUAL) {
            this.changed = new Signal();
            this.perPlayer = new Map();
        } else if (Environment.IS_SERVER) {
            this.perPlayer = new Map();
            this.signalPacket.remoteEvent.SetAttribute("RemotePrimitiveSet", true);
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

    private createFullDiffFrom(set: Set<T>): DiffPayload<T> {
        const changes: Array<DiffChange<T>> = [];
        for (const value of set) {
            changes.push({ type: DiffChangeType.Add, value });
        }
        return { full: true, changes };
    }

    private createFullDiff(): DiffPayload<T> {
        return this.createFullDiffFrom(this.state);
    }

    private createFullDiffForPlayer(player: Player): DiffPayload<T> {
        return this.createFullDiffFrom(this.getStateForPlayer(player));
    }

    private snapshot() {
        return cloneSet(this.state);
    }

    private getStateForPlayer(player: Player): Set<T> {
        const perPlayerState = this.perPlayer?.get(player);
        if (perPlayerState !== undefined) {
            return perPlayerState;
        }
        return this.state;
    }

    private applyDiff(payload: DiffPayload<T>) {
        if (payload.full) {
            this.state = new Set<T>();
        }
        for (const change of payload.changes) {
            if (change.type === DiffChangeType.Add) {
                this.state.add(change.value);
            } else {
                this.state.delete(change.value);
            }
        }
    }

    private dispatch(diff: DiffPayload<T>) {
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

    private dispatchToPlayer(player: Player, diff: DiffPayload<T>) {
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

    get(player?: Player): Set<T> {
        if (Environment.IS_SERVER) {
            if (player !== undefined) {
                const perPlayerState = this.perPlayer?.get(player);
                if (perPlayerState !== undefined) {
                    return cloneSet(perPlayerState);
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
                    return cloneSet(perPlayerState);
                }
            }
        }

        return this.snapshot();
    }

    set(values: Set<T>) {
        const changes: Array<DiffChange<T>> = [];

        for (const value of values) {
            if (!this.state.has(value)) {
                changes.push({ type: DiffChangeType.Add, value });
            }
        }

        for (const value of this.state) {
            if (!values.has(value)) {
                changes.push({ type: DiffChangeType.Delete, value });
            }
        }

        if (changes.size() === 0) {
            return;
        }

        this.state = cloneSet(values);
        this.perPlayer?.clear();
        this.dispatch({ full: false, changes });
    }

    setFor(player: Player, value: Set<T>): void {
        if (this.perPlayer === undefined) {
            this.perPlayer = new Map();
        }

        const currentSet = this.perPlayer.get(player) ?? new Set<T>();
        const changes: Array<DiffChange<T>> = [];

        for (const nextValue of value) {
            if (!currentSet.has(nextValue)) {
                changes.push({ type: DiffChangeType.Add, value: nextValue });
            }
        }

        for (const existing of currentSet) {
            if (!value.has(existing)) {
                changes.push({ type: DiffChangeType.Delete, value: existing });
            }
        }

        if (changes.size() === 0) {
            return;
        }

        if (player.Parent !== undefined) {
            this.perPlayer.set(player, cloneSet(value));
        } else {
            this.perPlayer.delete(player);
        }

        this.dispatchToPlayer(player, { full: false, changes });
    }

    add(value: T) {
        if (this.state.has(value)) {
            return false;
        }

        this.state.add(value);
        this.dispatch({ full: false, changes: [{ type: DiffChangeType.Add, value }] });
        return true;
    }

    delete(value: T) {
        if (!this.state.has(value)) {
            return false;
        }

        this.state.delete(value);
        this.dispatch({ full: false, changes: [{ type: DiffChangeType.Delete, value }] });
        return true;
    }

    clear() {
        if (this.state.isEmpty()) {
            return;
        }

        const changes: Array<DiffChange<T>> = [];
        for (const value of this.state) {
            changes.push({ type: DiffChangeType.Delete, value });
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

    observe(handler: (snapshot: Set<T>, diff: DiffPayload<T>) => void) {
        task.spawn(() => {
            handler(this.snapshot(), this.createFullDiff());
        });

        if (this.changed === undefined) {
            this.changed = new Signal();
        }

        return this.changed.connect((snapshot, diff) => handler(cloneSet(snapshot), cloneDiff(diff)));
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
