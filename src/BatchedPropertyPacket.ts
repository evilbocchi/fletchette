import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players } from "@rbxts/services";
import AbstractPropertyPacket from "./AbstractPropertyPacket";
import Environment from "./Environment";
import SignalPacket from "./SignalPacket";

/**
 * BatchedPropertyPacket batches property updates so they are delivered no more than once per interval.
 *
 * @typeParam T The type of the property
 */
export default class BatchedPropertyPacket<T> extends AbstractPropertyPacket<T> {
    private static playersProvider: () => Player[] = () => Players.GetPlayers();

    readonly className = "BatchedPropertyPacket";
    /**
     * SignalPacket used to send the property
     */
    readonly signalPacket: SignalPacket<(value: T) => void>;

    /**
     * The current value of the property
     */
    private value!: T;

    /**
     * Signal that fires when the property changes.
     * Should only be used on the client since the server does not listen for changes.
     */
    changed!: Signal<(value: T) => void>;

    /**
     * Map of player to their property value
     */
    perPlayer?: Map<Player, T | undefined>;

    /**
     * Connection to {@link Players.PlayerRemoving} event.
     */
    private playerRemoving?: RBXScriptConnection;

    /**
     * Interval between flushes, expressed in milliseconds.
     */
    readonly batchIntervalMs: number;

    private readonly batchIntervalSeconds: number;

    private hasPendingGlobal = false;
    private pendingGlobal: T | undefined;
    private readonly pendingPerPlayer = new Map<Player, T>();
    private pendingFlush?: thread;
    private virtualPending = false;

    constructor(
        id: string,
        batchIntervalMs: number,
        initialValue?: T,
        isUnreliable?: boolean,
        meta?: Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>,
    ) {
        super();
        this.batchIntervalMs = math.max(batchIntervalMs, 0);
        this.batchIntervalSeconds = this.batchIntervalMs / 1000;
        this.signalPacket = new SignalPacket<(value: T) => void>(id, isUnreliable === true, meta);
        if (initialValue !== undefined) this.value = initialValue;

        if (Environment.IS_VIRTUAL) {
            this.perPlayer = new Map();
            this.changed = new Signal();
        } else if (Environment.IS_SERVER) {
            this.signalPacket.remoteEvent.SetAttribute("RemoteProperty", true);
            this.perPlayer = new Map();
            this.playerRemoving = Players.PlayerRemoving.Connect((player) => {
                this.perPlayer!.delete(player);
                this.pendingPerPlayer.delete(player);
            });

            this.signalPacket.remoteEvent.OnServerEvent.Connect((player) => {
                let result = this.getFor(player);
                if (result === undefined) {
                    while (result === undefined) {
                        task.wait();
                        result = this.getFor(player);
                    }
                }
                this.signalPacket.toClient(player, result as T);
            });
        } else {
            this.changed = new Signal();
            this.signalPacket.fromServer((value) => {
                const changed = value !== this.value;
                this.value = value;
                if (changed === true) {
                    this.changed.fire(value);
                }
            });
            this.signalPacket.remoteEvent.FireServer();
        }
    }

    /**
     * Overrides the provider used to retrieve players when broadcasting filtered updates.
     * Primarily intended for testing. Passing no provider resets to the default behavior.
     */
    static setPlayersProvider(provider?: () => Player[]) {
        this.playersProvider = provider ?? (() => Players.GetPlayers());
    }

    private scheduleFlush() {
        if (this.batchIntervalSeconds <= 0) {
            this.flush();
            return;
        }

        if (this.pendingFlush !== undefined) {
            return;
        }

        this.pendingFlush = task.delay(this.batchIntervalSeconds, () => {
            this.pendingFlush = undefined;
            this.flush();
        });
    }

    private setPendingGlobal(value: T) {
        this.hasPendingGlobal = true;
        this.pendingGlobal = value;
        this.pendingPerPlayer.clear();
        this.virtualPending = true;
        this.scheduleFlush();
    }

    private setPendingForPlayer(player: Player, value: T) {
        this.pendingPerPlayer.set(player, value);
        this.virtualPending = true;
        this.scheduleFlush();
    }

    private flush() {
        if (Environment.IS_VIRTUAL) {
            if (!this.virtualPending && !this.hasPendingGlobal && this.pendingPerPlayer.size() === 0) {
                return;
            }

            if (this.changed) {
                this.changed.fire(this.get());
            }
            this.clearPending();
            return;
        }

        if (!this.hasPendingGlobal && this.pendingPerPlayer.size() === 0) {
            return;
        }

        if (this.hasPendingGlobal) {
            this.signalPacket.toAllClients(this.pendingGlobal as T);
        }

        for (const [player, value] of this.pendingPerPlayer) {
            if (player.Parent === undefined) {
                this.perPlayer?.delete(player);
                continue;
            }
            this.signalPacket.toClient(player, value as T);
        }

        this.clearPending();
    }

    private clearPending() {
        this.hasPendingGlobal = false;
        this.pendingGlobal = undefined;
        this.pendingPerPlayer.clear();
        this.virtualPending = false;
    }

    /**
     * Sets the value of the property.
     * This will clear the perPlayer map and broadcast the value to all players after the batch interval.
     * Should only be used on the server.
     *
     * @param value The new value of the property
     */
    set(value: T) {
        this.value = value;
        this.perPlayer?.clear();
        this.setPendingGlobal(value);
    }

    /**
     * Sets the value of the property for players that do not have a value set.
     * Should only be used on the server.
     *
     * @param value The new value of the property
     */
    setTop(value: T) {
        this.value = value;

        if (Environment.IS_VIRTUAL) {
            this.virtualPending = true;
            this.scheduleFlush();
        }

        for (const player of BatchedPropertyPacket.playersProvider()) {
            if (this.perPlayer?.get(player) === undefined) {
                this.setPendingForPlayer(player, value);
            }
        }
    }

    /**
     * Sets the value of the property for players that pass the predicate.
     * Should only be used on the server.
     *
     * @param predicate The predicate to filter players
     * @param value The new value of the property
     */
    setFilter(predicate: (player: Player) => boolean, value: T) {
        for (const player of BatchedPropertyPacket.playersProvider()) {
            if (predicate(player)) {
                this.setFor(player, value);
            }
        }
    }

    /**
     * Sets the value of the property for a specific player.
     * Should only be used on the server.
     *
     * @param player The player to set the value for
     * @param value The new value of the property
     */
    setFor(player: Player, value: T) {
        if (player.Parent !== undefined) {
            this.perPlayer?.set(player, value);
        }
        this.setPendingForPlayer(player, value);
    }

    /**
     * Sets the value of the property for a list of players.
     * Should only be used on the server.
     *
     * @param players The list of players to set the value for
     * @param value The new value of the property
     */
    setForList(players: Player[], value: T) {
        for (const player of players) {
            this.setFor(player, value);
        }
    }

    /**
     * Clears the value of the property for a specific player.
     * Should only be used on the server.
     *
     * @param player The player to clear the value for
     */
    clearFor(player: Player) {
        this.perPlayer?.set(player, undefined);
        this.setPendingForPlayer(player, this.value);
    }

    /**
     * Clears the value of the property for a list of players.
     * Should only be used on the server.
     *
     * @param players The list of players to clear the value for
     */
    clearForList(players: Player[]) {
        for (const player of players) {
            this.clearFor(player);
        }
    }

    /**
     * Clears the value of the property for players that pass the predicate.
     * Should only be used on the server.
     *
     * @param predicate The predicate to filter players
     */
    clearFilter(predicate: (player: Player) => boolean) {
        for (const player of BatchedPropertyPacket.playersProvider()) {
            if (predicate(player)) {
                this.clearFor(player);
            }
        }
    }

    /**
     * Returns the current value of the property.
     * @param player The player to get the value for. Does nothing on the client.
     * @returns The current value of the property
     */
    get(player?: Player) {
        if (Environment.IS_VIRTUAL) {
            const localPlayer = Players.LocalPlayer;
            if (localPlayer !== undefined) {
                player = localPlayer;
            }
            if (player === undefined) {
                return this.value;
            }
            return this.perPlayer?.get(player) ?? this.value;
        }

        if (player !== undefined && this.perPlayer) {
            const value = this.perPlayer.get(player);
            if (value !== undefined) {
                return value;
            }
        }

        return this.value;
    }

    /**
     * Returns the value of the property for a specific player.
     * Should only be used on the server.
     * @deprecated Use {@link get} instead.
     * @param player The player to get the value for
     * @returns The value of the property for the player
     */
    getFor(player: Player) {
        return this.get(player);
    }

    /**
     * Observes the property for changes. Triggers the handler after each flush.
     *
     * @param handler The handler to call when the property changes
     * @returns A connection that can be disconnected to stop observing the property
     */
    observe(handler: (value: T) => void) {
        task.spawn(() => {
            while (task.wait()) {
                if (this.value !== undefined) break;
            }
            handler(this.value);
        });
        return this.changed.connect((value) => handler(value));
    }

    destroy() {
        if (this.pendingFlush) {
            task.cancel(this.pendingFlush);
            this.pendingFlush = undefined;
        }

        if (this.playerRemoving !== undefined) {
            this.playerRemoving.Disconnect();
        }
        this.pendingPerPlayer.clear();
        this.virtualPending = false;
        this.signalPacket.remoteEvent.Destroy();
    }
}
