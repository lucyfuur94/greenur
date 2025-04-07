/// <reference types="node" />
import worker_thread from "worker_threads";
export declare class DnsLookup {
    thread: worker_thread.Worker;
    cache: Map<string, Promise<string>>;
    constructor();
    lookup(host: string): Promise<string>;
    close(): Promise<number>;
}
