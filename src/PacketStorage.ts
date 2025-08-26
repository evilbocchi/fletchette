import { ReplicatedStorage } from "@rbxts/services";
import { IS_EDIT, IS_SERVER } from "./Environment";

/**
 * Utility functions for creating RemoteEvents and RemoteFunctions.
 * Remotes are stored in ReplicatedStorage.PacketStorage.
 */
export default class PacketStorage {

    /**
     * PacketStorage folder in ReplicatedStorage.
     */
    static readonly PACKET_STORAGE = (() => {
        if (IS_SERVER || IS_EDIT) {
            const PacketStorage = new Instance("Folder");
            PacketStorage.Name = "PacketStorage";
            if (!IS_EDIT)
                PacketStorage.Parent = ReplicatedStorage;
            return PacketStorage;
        }
        else {
            return ReplicatedStorage.WaitForChild("PacketStorage") as Folder;
        }
    })();

    /**
     * Retrieve a RemoteEvent from PacketStorage. If the RemoteEvent does not exist, it will be created.
     * 
     * @param id Unique identifier for the remote
     * @param isUnreliable Whether the remote should be unreliable. Default is false.
     */
    static getSignalRemote(id: string | number, isUnreliable?: boolean) {
        let remote: RemoteEvent;
        if (IS_SERVER || IS_EDIT) {
            remote = (new Instance(isUnreliable === true ? "UnreliableRemoteEvent" : "RemoteEvent") as BaseRemoteEvent) as RemoteEvent;
            remote.Name = tostring(id);
            if (!IS_EDIT)
                remote.Parent = this.PACKET_STORAGE;
        }
        else {
            remote = this.PACKET_STORAGE.WaitForChild(id) as RemoteEvent;
        }
        return remote;
    }

    /**
     * Retrieve a RemoteFunction from PacketStorage. If the RemoteFunction does not exist, it will be created.
     * 
     * @param id Unique identifier for the remote
     */
    static getRequestRemote(id: string | number) {
        let remote: RemoteFunction;
        if (IS_SERVER || IS_EDIT) {
            remote = new Instance("RemoteFunction");
            remote.Name = tostring(id);
            if (!IS_EDIT)
                remote.Parent = this.PACKET_STORAGE;
        }
        else {
            remote = this.PACKET_STORAGE.WaitForChild(id) as RemoteFunction;
        }
        return remote;
    };
}