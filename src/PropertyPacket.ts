import Signal from "@antivivi/lemon-signal";
import { Modding } from "@flamework/core";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer/out/metadata";
import { Players } from "@rbxts/services";
import { IS_EDIT, IS_SERVER } from "./Environment";
import SignalPacket from "./SignalPacket";

/**
 * PropertyPacket is a wrapper around SignalPacket that provides a type-safe way to send data between server and client.
 * This implements a property system where the value can be set for all players, a specific player, or a filtered list of players.
 * 
 * @typeParam T The type of the property
 */
export default class PropertyPacket<T> {

    /**
     * SignalPacket used to send the property
     */
    signalPacket: SignalPacket<(value: T) => void>;

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
    constructor(id: string, initialValue?: T, isUnreliable?: boolean, meta?: Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>) {
        this.signalPacket = new SignalPacket<(value: T) => void>(id, isUnreliable === true, meta);
        if (initialValue !== undefined)
            this.value = initialValue;

        if (IS_EDIT) {
            this.perPlayer = new Map();
            this.changed = new Signal();
        }
        else if (IS_SERVER) {
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
                this.signalPacket.toClient(player, result);
            });
        }
        else {
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
     * Sends the property change virtually in edit mode.
     * 
     * Does not actually check for changes, this will always fire the changed signal.
     * 
     * @returns Whether the signal was sent
     */
    private sendVirtually() {
        if (IS_EDIT) {
            this.changed.fire(this.get());
            return true;
        }
        return false;
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

        if (this.sendVirtually())
            return;
        this.signalPacket.toAllClients(value);
    }

    /**
     * Sets the value of the property for players that do not have a value set.
     * Should only be used on the server.
     * 
     * @param value The new value of the property
     */
    setTop(value: T) {
        this.value = value;

        if (this.sendVirtually())
            return;
        for (const player of Players.GetPlayers()) {
            if (this.perPlayer!.get(player) === undefined) {
                this.signalPacket.toClient(player, value as T);
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
        if (this.sendVirtually())
            return;
        this.signalPacket.toClient(player, value as T);
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
        if (this.sendVirtually())
            return;
        this.signalPacket.toClient(player, this.value);
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
        if (IS_EDIT) {
            return this.perPlayer?.get(Players.LocalPlayer) ?? this.value;
        }

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