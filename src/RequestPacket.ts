import { Modding } from "@flamework/core";
import { createBinarySerializer, Serializer, SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import PacketStorage from "./PacketStorage";

/**
 * A request packet that can be sent between client and server.
 * This packet can be used to send data to the server and receive a response, or query a client for a response.
 * 
 * @typeParam V The data being sent by the request
 * @typeParam B The data being received by the request
 * @typeParam T The function signature for the request
 */
export default class RequestPacket<V, B, T extends (...args: Parameters<V>) => B> {

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

    /**
     * Create a RequestPacket with a unique id. Metadata can be provided to specify how the data should be serialized.
     * 
     * @param id Unique identifier for the request
     * @param meta Metadata for serialization
     */
    constructor(id: string, meta?: Modding.Many<SerializerMetadata<Parameters<T>>>) {
        this.id = id;
        this.serializer = createBinarySerializer<Parameters<T>>(meta);
        this.remoteFunction = PacketStorage.getRequestRemote(id);
    }

    /**
     * Invoke the request on the server.
     * The server should have a handler set up with {@link onInvoke} that can handle the request.
     * Hence, this function should only be called on the client.
     * 
     * @param args The data to send
     */
    invoke(...args: Parameters<T>): B {
        const serialized = this.serializer.serialize(args);
        return this.remoteFunction!.InvokeServer(serialized.buffer, serialized.blobs);
    }

    /**
     * Query a client for a response.
     * The client should have a handler set up with {@link onQuery} that can handle the query.
     * Hence, this function should only be called on the server.
     * 
     * @param player The player to send the query to
     * @param args The data to send
     */
    query(player: Player, ...args: Parameters<T>): B {
        const serialized = this.serializer.serialize(args);
        return this.remoteFunction!.InvokeClient(player, serialized.buffer, serialized.blobs) as B;
    }

    /**
     * Set up a handler for the client to respond to a query.
     * This function should only be called on the client to listen for queries made by the server.
     * 
     * @param handler The handler to call when a query is made
     */
    onQuery(handler: (...args: Parameters<T>) => B) {
        this.remoteFunction!.OnClientInvoke = (buffer, blobs) => handler(...this.serializer.deserialize(buffer, blobs));
    }

    /**
     * Set up a handler for the server to respond to a request.
     * This function should only be called on the server to listen for requests made by the client.
     * 
     * @param handler The handler to call when a request is made
     */
    onInvoke(handler: (player: Player, ...args: Parameters<T>) => B) {
        this.remoteFunction!.OnServerInvoke = (player, buffer, blobs) => handler(player, ...this.serializer.deserialize(buffer as buffer, blobs as defined[]));
    }
}