import { Modding } from "@flamework/core";
import { createBinarySerializer, Serializer, SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import { Players } from "@rbxts/services";
import AbstractPacket from "./AbstractPacket";
import Environment from "./Environment";
import PacketStorage from "./PacketStorage";

/**
 * A request packet that can be sent between client and server.
 * This packet can be used to send data to the server and receive a response, or toClient a client for a response.
 *
 * @typeParam V The data being sent by the request
 * @typeParam B The data being received by the request
 * @typeParam T The function signature for the request
 */
export default class RequestPacket<V, B, T extends (...args: Parameters<V>) => B> extends AbstractPacket {
    readonly className = "RequestPacket";
    /**
     * Unique identifier for the request
     */
    readonly id: string;

    /**
     * RemoteFunction used to send the request
     */
    remoteFunction: RemoteFunction;

    /**
     * Serializer for the data being sent by the request
     */
    serializer: Serializer<Parameters<T>>;

    /** Virtual handler that can be used to handle the request on the client */
    virtualClientHandler?: (...args: Parameters<T>) => B;
    /** Virtual handler that can be used to handle the request on the server */
    virtualServerHandler?: (player: Player, ...args: Parameters<T>) => B;

    /**
     * Create a RequestPacket with a unique id. Metadata can be provided to specify how the data should be serialized.
     *
     * @param id Unique identifier for the request
     * @param meta Metadata for serialization
     */
    constructor(id: string, meta?: Modding.Many<SerializerMetadata<Parameters<T>>>) {
        super();
        this.id = id;
        this.serializer = createBinarySerializer<Parameters<T>>(meta);
        this.remoteFunction = PacketStorage.getRequestRemote(id);
    }

    /**
     * Invoke the request on the server.
     * The server should have a handler set up with {@link fromClient} that can handle the toServer.
     * Hence, this function should only be called on the client.
     *
     * @param args The data to send
     */
    toServer(...args: Parameters<T>): B {
        if (Environment.IS_VIRTUAL) {
            const handler = this.virtualServerHandler;
            if (!handler) throw `No virtual server handler set for RequestPacket ${this.id}`;
            return handler(Players.LocalPlayer, ...args);
        }

        const serialized = this.serializer.serialize(args);
        return this.remoteFunction!.InvokeServer(serialized.buffer, serialized.blobs);
    }

    /**
     * Query a client for a response.
     * The client should have a handler set up with {@link fromServer} that can handle the toClient.
     * Hence, this function should only be called on the server.
     *
     * @param player The player to send the toClient to
     * @param args The data to send
     */
    toClient(player: Player, ...args: Parameters<T>): B {
        if (Environment.IS_VIRTUAL) {
            const handler = this.virtualClientHandler;
            if (!handler) throw `No virtual client handler set for RequestPacket ${this.id}`;
            return handler(...args);
        }

        const serialized = this.serializer.serialize(args);
        return this.remoteFunction!.InvokeClient(player, serialized.buffer, serialized.blobs) as B;
    }

    /**
     * Set up a handler for the client to respond to {@link toClient}.
     * This function should only be called on the client to listen for queries made by the server.
     *
     * @param handler The handler to call when a toClient is made
     */
    fromServer(handler: (...args: Parameters<T>) => B): void {
        if (Environment.IS_VIRTUAL) {
            this.virtualClientHandler = handler;
            return;
        }

        this.remoteFunction!.OnClientInvoke = (buffer, blobs) => handler(...this.serializer.deserialize(buffer, blobs));
    }

    /**
     * Set up a handler for the server to respond to {@link toServer}.
     * This function should only be called on the server to listen for requests made by the client.
     *
     * @param handler The handler to call when a request is made
     */
    fromClient(handler: (player: Player, ...args: Parameters<T>) => B): void {
        if (Environment.IS_VIRTUAL) {
            this.virtualServerHandler = handler;
            return;
        }

        this.remoteFunction!.OnServerInvoke = (player, buffer, blobs) =>
            handler(player, ...this.serializer.deserialize(buffer as buffer, blobs as defined[]));
    }

    destroy() {
        this.remoteFunction?.Destroy();
        table.clear(this);
    }
}
