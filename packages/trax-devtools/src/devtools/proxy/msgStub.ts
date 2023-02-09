import { DtMessage, DtMessageStub, DtMsgHandler } from "./types";

const TRACE_ON = true;

export function createPostMsgStub(target: Window, tabId?: number): DtMessageStub {
    let name: DtMsgHandler = "Unknown";
    let msgCb: ((m: DtMessage) => void) | undefined;

    function logPrefix() {
        return tabId ? `[${name}/${tabId}]` : `[${name}]`;
    }

    function trace(...args: any[]) {
        TRACE_ON && console.log(logPrefix(), ...args);
    }

    // listen on current window but sent on target window
    window.addEventListener("message", (e: MessageEvent) => {
        if (e.source === target && e.data && e.data.to === name) {
            const m = e.data;
            trace('Msg Received:', m);
            msgCb && msgCb(m);
        }
    });

    return {
        setName(nm: DtMsgHandler) {
            name = nm;
        },
        sendMessage(m: DtMessage) {
            let msg = tabId ? { ...m, from: name, tabId: tabId } : { ...m, from: name };
            trace("Send Message:", msg);
            target.postMessage(msg, "*");
        },
        setMessageListener(ln: (m: DtMessage) => void) {
            msgCb = ln;
        },
        trace,
        error(...args: any[]) {
            console.error(logPrefix(), ...args);
        }
    }
}

