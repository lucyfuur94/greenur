/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { SocketType } from "dgram";
import { InterfaceAddresses } from "../../common/src";
import { Address } from "./types/model";
export declare class UdpTransport implements Transport {
    private type;
    private portRange?;
    private interfaceAddresses?;
    private socket;
    onData: (data: Buffer, addr: Address) => void;
    constructor(type: SocketType, portRange?: [number, number] | undefined, interfaceAddresses?: InterfaceAddresses | undefined);
    static init(type: SocketType, portRange?: [number, number], interfaceAddresses?: InterfaceAddresses): Promise<UdpTransport>;
    private init;
    send: (data: Buffer, addr: readonly [string, number]) => Promise<void>;
    address(): import("net").AddressInfo;
    close: () => Promise<void>;
}
export interface Transport {
    onData: (data: Buffer, addr: Address) => void;
    send: (data: Buffer, addr: Address) => Promise<void>;
}
