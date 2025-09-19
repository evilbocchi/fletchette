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

function getName(name?: string) {
    if (!name) return tostring(++i);

    if (name.size() > 50) {
        name = name.sub(1, 50);
    }
    return `${name}_${++i}`;
}

/**
 * Create a SignalPacket. Metadata can be provided to specify how the data should be serialized.
 * @param isUnreliable Whether the signal should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function signal<T extends Callback = Callback>(
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<T>>>,
    name?: Modding.Caller<"text">,
) {
    return new SignalPacket<T>(getName(name), isUnreliable, meta);
}

/**
 * Create a RequestPacket. Metadata can be provided to specify how the data should be serialized.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function request<T extends Callback = Callback>(
    meta?: Modding.Many<SerializerMetadata<Parameters<T>>>,
    name?: Modding.Caller<"text">,
) {
    return new RequestPacket<Parameters<T>, ReturnType<T>, T>(getName(name), meta);
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
    name?: Modding.Caller<"text">,
) {
    return new PropertyPacket<T>(getName(name), initialValue, isUnreliable, meta);
}

type SignalOrRequestPacket<T extends Callback = Callback> =
    ReturnType<T> extends void ? SignalPacket<T> : RequestPacket<Parameters<T>, ReturnType<T>, T>;
/**
 * Create a Packet that intelligently chooses between SignalPacket and RequestPacket based on the return type of T.
 * If T returns void, creates a SignalPacket. Otherwise, creates a RequestPacket.
 * @param isUnreliable Whether the signal should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @param returnType The return type of the callback. If "void" or undefined, a SignalPacket is created. Otherwise, a RequestPacket is created.
 * @metadata macro
 */
export function signalOrRequest<T extends Callback>(
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<T>>>,
    name?: Modding.Caller<"text">,
    returnType?: Modding.Generic<ReturnType<T>, "text">,
): SignalOrRequestPacket<T> {
    if (returnType === "void" || returnType === undefined) {
        return signal<T>(isUnreliable, meta, name) as unknown as SignalOrRequestPacket<T>;
    }
    return request<T>(meta, name) as unknown as SignalOrRequestPacket<T>;
}

type Packet<T> = T extends Callback ? SignalOrRequestPacket<T> : PropertyPacket<T>;

/**
 * Create a Packet that intelligently chooses between {@link signal},{@link request}, and
 * {@link property} packets based on the type of T.
 *
 * @param options Object containing initialValue and isUnreliable
 * @param meta Metadata for serialization
 * @param returnType The return type of the callback. If "void" or undefined, a SignalPacket is created. Otherwise, a RequestPacket is created.
 * @returns A Packet of type T
 * @metadata macro
 */
export function packet<T = unknown>(
    options?: { initialValue?: T; isUnreliable?: boolean },
    meta?: Modding.Many<SerializerMetadata<Parameters<T extends Callback ? T : (value: T) => void>>>,
    name?: Modding.Caller<"text">,
    returnType?: Modding.Generic<ReturnType<T>, "text">,
): Packet<T> {
    if (options?.initialValue !== undefined || returnType === "never") {
        return property<T>(
            options?.initialValue,
            options?.isUnreliable,
            meta as unknown as Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>,
            name,
        ) as unknown as Packet<T>;
    }

    return signalOrRequest<T extends Callback ? T : never>(
        options?.isUnreliable,
        meta,
        name,
        returnType,
    ) as unknown as Packet<T>;
}
