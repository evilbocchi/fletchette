import { Modding } from "@flamework/core";
import { createBinarySerializer, Serializer, SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import { Players } from "@rbxts/services";
import PacketStorage from "./PacketStorage";

/**
 * SignalPacket is a wrapper around RemoteEvent that provides a type-safe way to send data between server and client.
 * 
 * @typeParam T The function signature for the signal
 */
export default class SignalPacket<T> {

    /**
     * Unique identifier for the signal
     */
    readonly id: string;

    /**
     * RemoteEvent used to send the signal
     */
    remoteEvent: RemoteEvent;

    /**
     * Serializer for the data being sent by the signal
     */
    serializer: Serializer<Parameters<T>>;

    /**
     * Create a SignalPacket with a unique id. Metadata can be provided to specify how the data should be serialized.
     * 
     * @param id Unique identifier for the signal
     * @param isUnreliable Whether the signal should be unreliable. Default is false.
     * @param meta Metadata for serialization
     */
    constructor(id: string, isUnreliable?: boolean, meta?: Modding.Many<SerializerMetadata<Parameters<T>>>) {
        this.id = id;
        this.serializer = createBinarySerializer<Parameters<T>>(meta);
        this.remoteEvent = PacketStorage.getSignalRemote(id, isUnreliable);
    }

    /**
     * Fire the signal to a specific player.
     * 
     * @param player The player to send the signal to
     * @param args The data to send
     */
    fire(player: Player, ...args: Parameters<T>) {
        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireClient(player, serialized.buffer, serialized.blobs);
    }

    /**
     * Fire the signal to all players.
     * 
     * @param args The data to send
     */
    fireAll(...args: Parameters<T>) {
        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireAllClients(serialized.buffer, serialized.blobs);
    }

    /**
     * Fire the signal to all players in a radius.
     * 
     * @param position The position to center the radius around
     * @param radius The radius to send the signal to
     * @param args The data to send
     */
    fireInRadius(position: Vector3, radius: number, ...args: Parameters<T>) {
        const players = Players.GetPlayers();
        for (const player of players) {
            const character = player.Character;
            if (character === undefined || character.PrimaryPart === undefined)
                continue;
            if (character.PrimaryPart.Position.sub(position).Magnitude <= radius) {
                this.fire(player, ...args);
            }
        }
    }

    /**
     * Fire the signal to all players except one.
     * 
     * @param player The player to exclude
     * @param args The data to send
     */
    fireExcept(player: Player, ...args: Parameters<T>) {
        const players = Players.GetPlayers();
        for (const p of players) {
            if (p !== player) {
                this.fire(p, ...args);
            }
        }
    }

    /**
     * Fire the signal to a list of players.
     * 
     * @param players The list of players to send the signal to
     * @param args The data to send
     */
    fireList(players: Player[], ...args: Parameters<T>) {
        for (const player of players) {
            this.fire(player, ...args);
        }
    }

    /**
     * Inform the server of an event.
     * Used by the client to send data to the server.
     * 
     * @param args The data to send
     */
    inform(...args: Parameters<T>) {
        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireServer(serialized.buffer, serialized.blobs);
    }

    /**
     * Connect a handler to the signal.
     * Used by the client to listen for data from the server.
     * Hence, this function should only be called on a client environment.
     * 
     * @param handler The function to call when the signal is fired
     * @returns The connection object
     */
    connect(handler: (...args: Parameters<T>) => void) {
        return this.remoteEvent!.OnClientEvent.Connect((buffer, blobs) => handler(...this.serializer.deserialize(buffer, blobs)));
    }

    /**
     * Connect a handler to the signal.
     * Used by the server to listen for data from the client.
     * Hence, this function should only be called on a server environment.
     * 
     * @param handler The function to call when the signal is fired
     */
    listen(handler: (player: Player, ...args: Parameters<T>) => void) {
        this.remoteEvent!.OnServerEvent.Connect((player, buffer, blobs) => handler(player, ...this.serializer.deserialize(buffer as buffer, blobs as defined[])));
    }
}