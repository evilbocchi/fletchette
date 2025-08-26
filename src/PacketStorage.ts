import { ReplicatedStorage, RunService } from "@rbxts/services";

/**
 * Utility functions for creating RemoteEvents and RemoteFunctions.
 * Remotes are stored in ReplicatedStorage.PacketStorage.
 */
export default class PacketStorage {
    
    /**
     * Whether the current environment is server.
     * @internal Should not be used outside of this module.
     */
    protected static readonly IS_SERVER = RunService.IsServer();

    /**
     * Whether the current environment is in edit mode.
     * This is used to determine whether to create new instances.
     * 
     * @internal Should not be used outside of this module.
     */
    protected static readonly IS_EDIT = RunService.IsStudio() && !RunService.IsRunning();

    /**
     * PacketStorage folder in ReplicatedStorage.
     */
    static readonly PACKET_STORAGE = (() => {
        if (this.IS_SERVER || this.IS_EDIT) {
            const PacketStorage = new Instance("Folder");
            PacketStorage.Name = "PacketStorage";
            if (!this.IS_EDIT)
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
        if (this.IS_SERVER || this.IS_EDIT) {
            remote = (new Instance(isUnreliable === true ? "UnreliableRemoteEvent" : "RemoteEvent") as BaseRemoteEvent) as RemoteEvent;
            remote.Name = tostring(id);
            if (!this.IS_EDIT)
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
        if (this.IS_SERVER || this.IS_EDIT) {
            remote = new Instance("RemoteFunction");
            remote.Name = tostring(id);
            if (!this.IS_EDIT)
                remote.Parent = this.PACKET_STORAGE;
        }
        else {
            remote = this.PACKET_STORAGE.WaitForChild(id) as RemoteFunction;
        }
        return remote;
    };
}