import { Connection } from "@antivivi/lemon-signal";
import { Players } from "@rbxts/services";
import AbstractPacket from "./AbstractPacket";

export default abstract class AbstractPropertyPacket<T> extends AbstractPacket {
    /**
     * Sets the value of the property for all players.
     * Should only be used on the server.
     * @param value The new value of the property
     */
    abstract set(value: T): void;

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
     * @param player The player to set the value for
     * @param value The new value of the property
     */
    abstract setFor(player: Player, value: T): void;

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
    abstract clearFor(player: Player): void;

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
     * @param player The player to get the value for. Does nothing on the client.
     * @returns The current value of the property
     */
    abstract get(player?: Player): T;

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
     * Observes the property for changes. Unlike {@link changed}, this will fire the handler immediately if the value is already set.
     * Else, it will wait for the value to be set and then fire the handler.
     *
     * @param handler The handler to call when the property changes
     * @returns A connection that can be disconnected to stop observing the property
     */
    abstract observe(handler: (value: T) => void): Connection;
}
