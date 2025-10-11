/**
 * @file This file contains macros for creating packets without the need to specify unique IDs.
 */

import { Modding } from "@flamework/core/out/modding";
import { SerializerMetadata } from "@rbxts/flamework-binary-serializer";
import BatchedPropertyPacket from "./BatchedPropertyPacket";
import ExactMapPropertyPacket, { ExactMapDiffPayload } from "./ExactMapPropertyPacket";
import ExactSetPropertyPacket, { ExactSetDiffPayload } from "./ExactSetPropertyPacket";
import PropertyPacket from "./PropertyPacket";
import RequestPacket from "./RequestPacket";
import ShallowMapPropertyPacket, { ShallowObject, ShallowObjectMapDiffPayload } from "./ShallowMapPropertyPacket";
import SignalPacket from "./SignalPacket";

type InferSetValue<T> = T extends Set<infer V> ? V : never;

export type SignalOrRequestPacket<T extends Callback = Callback> =
    ReturnType<T> extends void ? SignalPacket<T> : RequestPacket<Parameters<T>, ReturnType<T>, T>;
export type PropertyLikePacket<T> =
    | PropertyPacket<T>
    | BatchedPropertyPacket<T>
    | (T extends Set<infer V> ? ExactSetPropertyPacket<V> : never);

let i = 0;
const duplicateNames = new Set<string>();
function generateName(name?: string, uuid?: string) {
    if (!name) return tostring(++i);

    if (name.size() > 50) {
        name = name.sub(1, 50);
    }
    if (duplicateNames.has(name)) {
        name = `${name}_${uuid ?? ++i}`;
    }
    duplicateNames.add(name);
    return name;
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
    uuid?: Modding.Caller<"uuid">,
) {
    return new SignalPacket<T>(generateName(name, uuid), isUnreliable, meta);
}

/**
 * Create a RequestPacket. Metadata can be provided to specify how the data should be serialized.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function request<T extends Callback = Callback>(
    meta?: Modding.Many<SerializerMetadata<Parameters<T>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
) {
    return new RequestPacket<Parameters<T>, ReturnType<T>, T>(generateName(name, uuid), meta);
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
    uuid?: Modding.Caller<"uuid">,
) {
    return new PropertyPacket<T>(generateName(name, uuid), initialValue, isUnreliable, meta);
}

/**
 * Create a BatchedPropertyPacket. Metadata can be provided to specify how the data should be serialized.
 * @param batchIntervalMs Interval in milliseconds to batch updates before delivering them to clients.
 * @param initialValue The initial value of the property
 * @param isUnreliable Whether the property should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function batchedProperty<T>(
    batchIntervalMs: number,
    initialValue?: T,
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
) {
    return new BatchedPropertyPacket<T>(generateName(name, uuid), batchIntervalMs, initialValue, isUnreliable, meta);
}

/**
 * Create a ExactMapPropertyPacket, where updates are diff-based and only checked with
 * strict equality (===).
 * Metadata can be provided to specify how the data should be serialized.
 * @param initialEntries Initial map entries to populate the property with
 * @param isUnreliable Whether the property should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function exactMapProperty<K, V>(
    initialEntries?: Map<K, V>,
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<(payload: ExactMapDiffPayload<K, V>) => void>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
) {
    return new ExactMapPropertyPacket<K, V>(generateName(name, uuid), initialEntries, isUnreliable, meta);
}

/**
 * Create an ExactSetPropertyPacket, where updates are diff-based and only track membership changes.
 * Metadata can be provided to specify how the data should be serialized.
 * @param initialValues Initial set values to populate the property with
 * @param isUnreliable Whether the property should be unreliable. Default is false.
 * @param meta Metadata for the serializer
 * @metadata macro
 */
export function exactSetProperty<T>(
    initialValues?: Set<T>,
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<(payload: ExactSetDiffPayload<T>) => void>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
) {
    return new ExactSetPropertyPacket<T>(generateName(name, uuid), initialValues, isUnreliable, meta);
}

/**
 * Create a ShallowMapPropertyPacket, where updates are diff-based and only the first level
 * of object values are checked for changes with strict equality (===).
 * Metadata can be provided to specify how the data should be serialized.
 * @param initialEntries Initial map entries to populate the property with
 * @param isUnreliable Whether the property should be unreliable. Default is false.
 * @param meta Metadata for serialization
 * @metadata macro
 */
export function shallowMapProperty<K, V extends ShallowObject>(
    initialEntries?: Map<K, V>,
    isUnreliable?: boolean,
    meta?: Modding.Many<SerializerMetadata<Parameters<(payload: ShallowObjectMapDiffPayload<K, V>) => void>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
) {
    return new ShallowMapPropertyPacket<K, V>(generateName(name, uuid), initialEntries, isUnreliable, meta);
}

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
    uuid?: Modding.Caller<"uuid">,
    returnType?: Modding.Generic<ReturnType<T>, "text">,
): SignalOrRequestPacket<T> {
    if (returnType === "void" || returnType === undefined) {
        return signal<T>(isUnreliable, meta, name, uuid) as unknown as SignalOrRequestPacket<T>;
    }
    return request<T>(meta, name, uuid) as unknown as SignalOrRequestPacket<T>;
}

type Packet<T> = T extends Callback ? SignalOrRequestPacket<T> : PropertyLikePacket<T>;

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
    options?: { initialValue?: T; isUnreliable?: boolean; batchIntervalMs?: number },
    meta?: Modding.Many<SerializerMetadata<Parameters<T extends Callback ? T : (value: T) => void>>>,
    name?: Modding.Caller<"text">,
    uuid?: Modding.Caller<"uuid">,
    returnType?: Modding.Generic<ReturnType<T>, "text">,
): Packet<T> {
    if (options?.initialValue !== undefined || options?.batchIntervalMs !== undefined || returnType === "never") {
        if (options?.batchIntervalMs !== undefined) {
            return batchedProperty<T>(
                options.batchIntervalMs,
                options.initialValue,
                options.isUnreliable,
                meta as unknown as Modding.Many<SerializerMetadata<Parameters<(value: T) => void>>>,
                name,
            ) as unknown as Packet<T>;
        }

        const inner = meta?.[1];
        if (
            inner !== undefined &&
            typeIs(inner, "table") &&
            typeIs((inner as [unknown])[0], "table") &&
            ((inner as Array<[unknown]>)[0] as [unknown])[0] === "set"
        ) {
            return exactSetProperty<InferSetValue<T>>(
                options?.initialValue as unknown as Set<InferSetValue<T>> | undefined,
                options?.isUnreliable,
                meta as unknown as Modding.Many<
                    SerializerMetadata<Parameters<(payload: ExactSetDiffPayload<InferSetValue<T>>) => void>>
                >,
                name,
            ) as unknown as Packet<T>;
        }
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
        uuid,
        returnType,
    ) as unknown as Packet<T>;
}
