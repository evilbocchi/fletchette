export default abstract class AbstractPacket {
    /**
     * Class name of the packet, used for debugging purposes.
     */
    abstract readonly className: string;

    /**
     * Cleans up any resources used by the packet.
     */
    abstract destroy(): void;
}
