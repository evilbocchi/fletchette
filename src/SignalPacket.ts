import { Modding } from "@flamework/core";
import { createBinarySerializer, Serializer, SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import { Players } from "@rbxts/services";
import { IS_EDIT } from "./Environment";
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

    /** Set of virtual handlers that can be used to handle the signal on the client */
    readonly virtualClientHandlers = new Set<(...args: Parameters<T>) => void>();
    /** Set of virtual handlers that can be used to handle the signal on the server */
    readonly virtualServerHandlers = new Set<(player: Player, ...args: Parameters<T>) => void>();

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
     * Used by the server to send data to a client.
     * 
     * @param player The player to send the signal to
     * @param args The data to send
     */
    toClient(player: Player, ...args: Parameters<T>): void {
        if (IS_EDIT) {
            for (const handler of this.virtualClientHandlers) {
                handler(...args);
            }
            return;
        }

        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireClient(player, serialized.buffer, serialized.blobs);
    }

    /**
     * Fire the signal to all players.
     * Used by the server to send data to all clients.
     * 
     * @param args The data to send
     */
    toAllClients(...args: Parameters<T>): void {
        if (IS_EDIT) {
            for (const handler of this.virtualClientHandlers) {
                handler(...args);
            }
            return;
        }

        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireAllClients(serialized.buffer, serialized.blobs);
    }

    /**
     * Fire the signal to all players in a radius.
     * Used by the server to send data to all clients within a certain radius.
     * 
     * @param position The position to center the radius around
     * @param radius The radius to send the signal to
     * @param args The data to send
     */
    toClientsInRadius(position: Vector3, radius: number, ...args: Parameters<T>): void {
        const players = Players.GetPlayers();
        for (const player of players) {
            const character = player.Character;
            if (character === undefined || character.PrimaryPart === undefined)
                continue;
            if (character.PrimaryPart.Position.sub(position).Magnitude <= radius) {
                this.toClient(player, ...args);
            }
        }
    }

    /**
     * Fire the signal to all players except one.
     * Used by the server to send data to all clients except one.
     * 
     * @param player The player to exclude
     * @param args The data to send
     */
    toClientsExcept(player: Player, ...args: Parameters<T>): void {
        const players = Players.GetPlayers();
        for (const p of players) {
            if (p !== player) {
                this.toClient(p, ...args);
            }
        }
    }

    /**
     * Fire the signal to a list of players.
     * Used by the server to send data to a specific group of clients.
     * 
     * @param players The list of players to send the signal to
     * @param args The data to send
     */
    toClientsInList(players: Player[], ...args: Parameters<T>): void {
        for (const player of players) {
            this.toClient(player, ...args);
        }
    }

    /**
     * Inform the server of an event.
     * Used by the client to send data to the server.
     * 
     * @param args The data to send
     */
    toServer(...args: Parameters<T>): void {
        if (IS_EDIT) {
            for (const handler of this.virtualServerHandlers) {
                handler(Players.LocalPlayer, ...args);
            }
            return;
        }

        const serialized = this.serializer.serialize(args);
        this.remoteEvent!.FireServer(serialized.buffer, serialized.blobs);
    }

    /**
     * Create a virtual connection for a handler, used when cross-boundary communication should be simulated.
     * 
     * @param handlers The set of handlers to manage
     * @param handler The specific handler to create a virtual connection for
     * @returns The virtual connection object
     */
    private createVirtualHandler<T>(handlers: Set<T>, handler: T): RBXScriptConnection {
        handlers.add(handler);
        const virtualConnection = {
            Connected: true,
            Disconnect: () => {
                virtualConnection.Connected = false;
                handlers.delete(handler);
            }
        };
        return virtualConnection;
    }

    /**
     * Connect a client-side handler to the signal.
     * Used by the client to listen for data from the server.
     * Hence, this function should only be called on a client environment.
     * 
     * @param handler The function to call when the signal is fired
     * @returns The connection object
     */
    fromServer(handler: (...args: Parameters<T>) => void): RBXScriptConnection {
        if (IS_EDIT) {
            return this.createVirtualHandler(this.virtualClientHandlers, handler);
        }

        return this.remoteEvent!.OnClientEvent.Connect((buffer, blobs) => handler(...this.serializer.deserialize(buffer, blobs)));
    }

    /**
     * Connect a server-side handler to the signal.
     * Used by the server to listen for data from the client.
     * Hence, this function should only be called on a server environment.
     * 
     * @param handler The function to call when the signal is fired
     */
    fromClient(handler: (player: Player, ...args: Parameters<T>) => void): RBXScriptConnection {
        if (IS_EDIT) {
            return this.createVirtualHandler(this.virtualServerHandlers, handler);
        }

        return this.remoteEvent!.OnServerEvent.Connect((player, buffer, blobs) => handler(player, ...this.serializer.deserialize(buffer as buffer, blobs as defined[])));
    }

    /**
     * Destroys the signal and cleans up any resources.
     */
    destroy() {
        this.virtualClientHandlers?.clear();
        this.virtualServerHandlers?.clear();
        this.remoteEvent?.Destroy();
        table.clear(this);
    }
}