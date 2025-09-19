import { ReplicatedStorage } from "@rbxts/services";
import Environment from "./Environment";

/**
 * Utility functions for creating RemoteEvents and RemoteFunctions.
 * Remotes are stored in ReplicatedStorage.PacketStorage.
 */
export default class PacketStorage {
    /**
     * PacketStorage folder in ReplicatedStorage.
     */
    static readonly PACKET_STORAGE = (() => {
        const key = "FLETCHETTE_PACKET_STORAGE";
        const cached = ReplicatedStorage.FindFirstChild(key);
        if (cached) {
            return cached as Folder;
        }

        if (Environment.IS_SERVER || Environment.IS_VIRTUAL) {
            const PacketStorage = new Instance("Folder");
            PacketStorage.Name = key;
            if (!Environment.IS_VIRTUAL) PacketStorage.Parent = ReplicatedStorage;
            return PacketStorage;
        } else {
            return ReplicatedStorage.WaitForChild(key) as Folder;
        }
    })();

    /**
     * Retrieve a RemoteEvent from PacketStorage. If the RemoteEvent does not exist, it will be created.
     * @param id Unique identifier for the remote
     * @param isUnreliable Whether the remote should be unreliable. Default is false.
     */
    static getSignalRemote(id: string | number, isUnreliable?: boolean) {
        const cached = this.PACKET_STORAGE.FindFirstChild(id);
        if (cached) {
            return cached as RemoteEvent;
        }

        let remote: RemoteEvent;
        if (Environment.IS_SERVER || Environment.IS_VIRTUAL) {
            remote = new Instance(
                isUnreliable === true ? "UnreliableRemoteEvent" : "RemoteEvent",
            ) as BaseRemoteEvent as RemoteEvent;
            remote.Name = tostring(id);
            if (!Environment.IS_VIRTUAL) remote.Parent = this.PACKET_STORAGE;
        } else {
            remote = this.PACKET_STORAGE.WaitForChild(id) as RemoteEvent;
        }
        return remote;
    }

    /**
     * Retrieve a RemoteFunction from PacketStorage. If the RemoteFunction does not exist, it will be created.
     * @param id Unique identifier for the remote
     */
    static getRequestRemote(id: string | number) {
        const cached = this.PACKET_STORAGE.FindFirstChild(id);
        if (cached) {
            return cached as RemoteFunction;
        }

        let remote: RemoteFunction;
        if (Environment.IS_SERVER || Environment.IS_VIRTUAL) {
            remote = new Instance("RemoteFunction");
            remote.Name = tostring(id);
            if (!Environment.IS_VIRTUAL) remote.Parent = this.PACKET_STORAGE;
        } else {
            remote = this.PACKET_STORAGE.WaitForChild(id) as RemoteFunction;
        }
        return remote;
    }
}
