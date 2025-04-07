"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DnsLookup = void 0;
const worker_threads_1 = __importDefault(require("worker_threads"));
class DnsLookup {
    constructor() {
        Object.defineProperty(this, "thread", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        const lookupWorkerFunction = () => {
            const worker_thread = global.require("worker_threads");
            const { lookup } = global.require("dns");
            const dnsLookup = (host) => lookup(host, (err, address, family) => {
                const res = {
                    err: err?.message,
                    address,
                    family,
                    host,
                };
                worker_thread.parentPort?.postMessage(res);
                process.exit();
            });
            worker_thread.parentPort?.on("message", (message) => {
                const { host } = message;
                dnsLookup(host);
            });
        };
        const lookupEval = `(${lookupWorkerFunction})()`;
        this.thread = new worker_threads_1.default.Worker(lookupEval, {
            eval: true,
        });
        this.thread.setMaxListeners(100);
    }
    async lookup(host) {
        let cached = this.cache.get(host);
        if (cached) {
            return cached;
        }
        cached = new Promise((r, f) => {
            const exitListener = (exitCode) => f(new Error(`dns.lookup thread exited unexpectedly: ${exitCode}`));
            const threadMessageListener = (result) => {
                if (result.host !== host) {
                    return;
                }
                this.thread.removeListener("message", threadMessageListener);
                this.thread.removeListener("exit", exitListener);
                if (!result.address)
                    return f(new Error(result.err || "dns.lookup thread unknown error"));
                r(result.address);
            };
            this.thread.on("message", threadMessageListener);
            this.thread.on("exit", exitListener);
            this.thread.postMessage({
                host,
            });
        });
        this.cache.set(host, cached);
        return cached;
    }
    close() {
        return this.thread.terminate();
    }
}
exports.DnsLookup = DnsLookup;
//# sourceMappingURL=lookup.js.map