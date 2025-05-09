import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { createBinarySerializer, Serializer } from "@rbxts/flamework-binary-serializer";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players, RunService } from "@rbxts/services";
import PacketStorage from "./PacketStorage";

/**
 * Modified version of SignalPacket that sends a single value instead of a tuple.
 */
class PropertySignalPacket<T> {
    readonly id: string;
    remoteEvent: RemoteEvent;
    serializer: Serializer<T>;

    constructor(id: string, isUnreliable?: boolean, meta?: Modding.Many<SerializerMetadata<T>>) {
        this.id = id;
        this.serializer = createBinarySerializer<T>(meta);
        this.remoteEvent = PacketStorage.getSignalRemote(id, isUnreliable);
    }

    fire(player: Player, value: T) {
        const serialized = this.serializer.serialize(value);
        this.remoteEvent!.FireClient(player, serialized.buffer, serialized.blobs);
    }

    fireAll(value: T) {
        const serialized = this.serializer.serialize(value);
        this.remoteEvent!.FireAllClients(serialized.buffer, serialized.blobs);
    }

    connect(handler: (value: T) => void) {
        return this.remoteEvent!.OnClientEvent.Connect((buffer, blobs) => handler(this.serializer.deserialize(buffer, blobs)));
    }

    listen(handler: (player: Player, value: T) => void) {
        this.remoteEvent!.OnServerEvent.Connect((player, buffer, blobs) => handler(player, this.serializer.deserialize(buffer as buffer, blobs as defined[])));
    }
}

const IS_SERVER = RunService.IsServer();

/**
 * PropertyPacket is a wrapper around PropertySignalPacket that provides a type-safe way to send data between server and client.
 * This implements a property system where the value can be set for all players, a specific player, or a filtered list of players.
 * 
 * @typeParam T The type of the property
 */
export default class PropertyPacket<T> {

    /**
     * SignalPacket used to send the property
     */
    signalPacket: PropertySignalPacket<T>;

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
     * Creates a new PropertyPacket.
     * 
     * @param id The id of the property
     * @param initialValue The initial value of the property
     * @param isUnreliable Whether the property should be sent unreliably. Default is false.
     * @param meta Metadata for the serializer
     */
    constructor(id: string, initialValue?: T, isUnreliable?: boolean, meta?: Modding.Many<SerializerMetadata<T>>) {
        this.signalPacket = new PropertySignalPacket<T>(id, isUnreliable === true, meta);
        if (initialValue !== undefined)
            this.value = initialValue;

        if (IS_SERVER) {
            this.signalPacket.remoteEvent.SetAttribute("RemoteProperty", true);
            this.perPlayer = new Map();
            this.playerRemoving = Players.PlayerRemoving.Connect((player) => this.perPlayer!.delete(player));
            
            this.signalPacket.remoteEvent.OnServerEvent.Connect((player) => {
                let result = this.getFor(player);
                if (result === undefined) {
                    while (result === undefined) {
                        task.wait();
                        result = this.getFor(player);
                    }
                }
                this.signalPacket.fire(player, result);
            });
        }
        else {
            this.changed = new Signal();
            this.signalPacket.connect((value) => {
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
     * Sets the value of the property.
     * This will clear the perPlayer map and fire the signal to all players.
     * Should only be used on the server.
     * 
     * @param value The new value of the property
     */
    set(value: T) {
        this.value = value;
        this.perPlayer!.clear();
        this.signalPacket.fireAll(value);
    }

    /**
     * Sets the value of the property for players that do not have a value set.
     * Should only be used on the server.
     * 
     * @param value The new value of the property
     */
    setTop(value: T) {
        this.value = value;
        for (const player of Players.GetPlayers()) {
            if (this.perPlayer!.get(player) === undefined) {
                this.signalPacket.fire(player, value as T);
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
        for (const player of Players.GetPlayers()) {
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
            this.perPlayer!.set(player, value);
        }
        this.signalPacket.fire(player, value as T);
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
     * Clears the value of the property.
     * This will clear the perPlayer map and fire the signal to all players.
     * Should only be used on the server.
     */
    clearFor(player: Player) {
        this.perPlayer!.set(player, undefined);
        this.signalPacket.fire(player, this.value);
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
        for (const player of Players.GetPlayers()) {
            if (predicate(player)) {
                this.clearFor(player);
            }
        }
    }

    /**
     * Returns the current value of the property.
     * For the server, this will ignore the perPlayer map and return the value.
     */
    get() {
        return this.value;
    }

    /**
     * Returns the value of the property for a specific player.
     * Should only be used on the server.
     * 
     * @param player The player to get the value for
     * @returns The value of the property for the player
     */
    getFor(player: Player) {
        const playerVal = this.perPlayer!.get(player);
        return playerVal === undefined ? this.value : playerVal;
    }

    /**
     * Observes the property for changes. Unlike {@link changed}, this will fire the handler immediately if the value is already set.
     * Else, it will wait for the value to be set and then fire the handler.
     * 
     * @param handler The handler to call when the property changes
     * @returns A connection that can be disconnected to stop observing the property
     */
    observe(handler: (value: T) => void) {
        task.spawn(() => {
            while (task.wait()) {
                if (this.value !== undefined)
                    break;
            }
            handler(this.value);
        });
        return this.changed.connect((value) => handler(value));
    }

    /**
     * Disconnects all connections and destroys the remote event.
     * Should be called when the property is no longer needed to prevent memory leaks.
     */
    destroy() {
        if (this.playerRemoving !== undefined) {
            this.playerRemoving.Disconnect();
        }
        this.signalPacket.remoteEvent.Destroy();
    }
}