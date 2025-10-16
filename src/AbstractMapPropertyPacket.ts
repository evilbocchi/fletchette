import AbstractPropertyPacket from "./AbstractPropertyPacket";

/**
 * AbstractMapPropertyPacket provides a base class for map-based property packets,
 * defining the essential methods for managing a map of key-value pairs that goes through
 * diff-based updates.
 * It extends AbstractPropertyPacket with a Map<K, V> type.
 */
export default abstract class AbstractMapPropertyPacket<K, V> extends AbstractPropertyPacket<Map<K, V>> {
    /**
     * Returns a new Map snapshot of the current state.
     */
    abstract getSnapshot(): Map<K, V>;

    /**
     * Retrieves the value for a specific key.
     */
    abstract getEntry(key: K): V | undefined;

    /**
     * Retrieves the entire map. If a player is provided, retrieves the map specific to that player if it exists.
     * @param player The player for whom to retrieve the map, or undefined for the global map.
     */
    abstract get(player?: Player): Map<K, V>;

    /**
     * Replaces the entire map with the provided entries, sending only the computed diff to clients.
     * @param entries The new entries to set in the map.
     */
    abstract set(entries: Map<K, V>): void;

    /**
     * Sets the value of the map for a specific player.
     * @param player The player to set the value for
     * @param value The new value of the property
     */
    abstract setFor(player: Player, value: Map<K, V>): void;

    /**
     * Sets a single entry in the map, keeping existing entries intact.
     * @param key The key of the entry to set.
     * @param value The value to set for the specified key.
     */
    abstract setEntry(key: K, value: V): void;

    /**
     * Removes an entry from the map if present.
     * @param key The key of the entry to remove.
     * @return True if the entry was present and removed, false otherwise.
     */
    abstract deleteEntry(key: K): boolean;

    /**
     * Sets and deletes multiple entries in a single operation.
     * @param entriesToSet The entries to set in the map.
     * @param keysToDelete The keys to delete from the map.
     */
    abstract setAndDeleteEntries(entriesToSet?: Map<K, V>, keysToDelete?: Set<K>): void;

    /**
     * Sets multiple entries in the map, keeping existing entries intact.
     * @param entries The entries to set in the map.
     */
    setEntries(entries: Map<K, V>) {
        return this.setAndDeleteEntries(entries);
    }

    /**
     * Clears the map.
     */
    abstract clear(): void;

    /**
     * Clears the map for a specific player.
     * @param player The player for whom to clear the map.
     */
    abstract clearFor(player: Player): void;
}
