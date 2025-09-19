/**
 * @file This file contains macros for creating packets without the need to specify unique IDs.
 */

import { Modding } from "@flamework/core/out/modding";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import PropertyPacket from "./PropertyPacket";
import RequestPacket from "./RequestPacket";
import SignalPacket from "./SignalPacket";

/**
 * Basic incrementing ID for packets
 */
let i = 0;

/**
 * Create a SignalPacket. Metadata can be provided to specify how the data should be serialized.
 * @param isUnreliable Whether the signal should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function signal<T extends Callback = Callback>(
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<T>>>,
) {
    return new SignalPacket<T>(tostring(++i), isUnreliable, meta);
}

/**
 * Create a RequestPacket. Metadata can be provided to specify how the data should be serialized.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function request<T extends Callback = Callback>(meta?: Modding.Many<SerializerMetadata<Parameters<T>>>) {
    return new RequestPacket<Parameters<T>, ReturnType<T>, T>(tostring(++i), meta);
}

/**
 * Create a PropertyPacket. Metadata can be provided to specify how the data should be serialized.
 * @param initialValue The initial value of the property
 * @param isUnreliable Whether the property should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function property<T>(
    initialValue?: T,
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>,
) {
    return new PropertyPacket<T>(tostring(++i), initialValue, isUnreliable, meta);
}