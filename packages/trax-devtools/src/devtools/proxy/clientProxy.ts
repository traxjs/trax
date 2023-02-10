import { StreamEvent, Trax, traxEvents } from "@traxjs/trax";
import { createPostMsgStub } from "./msgStub";
import { DtMessageStub, DtMsgType } from "./types";

/**
 * This file has to be injected in the application page. This can be done in 2 ways:
 * - in an iframe envionment: by referencing the lib manually (cf. test app)
 * - in dev tools extension environment, through the background script
 * It exposes a hook to the trax library (__TRAX_DEVTOOLS__ global varialbe) that will allow trax 
 * to register on this script.
 * When trax has registered this script will communicate with the devtools application (panel.html)
 * Again, 2 possible options:
 * - in iframe environment: thanks to postMessage communication with the panel page
 * - in dev tools extention environment thanks to postMessage with the content script (that will forward
 * to the background script, that will forward to the panel page)
 */

export function createClientProxy(stub: DtMessageStub) {
    let trx: Trax;
    let logSubscription: any;
    let bufferCycle = -1;
    let buffer: StreamEvent[] = [];

    stub.setName("TraxClientProxy");
    stub.setMessageListener((m) => {
        if (m.type === "TRXA") {
            if (m.actionName === "startMonitoring") {
                startMonitoring();
            } else if (m.actionName === "stopMonitoring") {
                stopMonitoring();
            } else {
                stub.trace("TODO: support action", m.actionName);
            }
        } else {
            stub.trace("TODO: support", m.type);
        }
    });

    function startMonitoring() {
        if (!trx) return;
        stub.trace("Buffererd events ingestion...");
        trx.log.scan(ingestEvent);
        stub.trace("Buffererd events ingestion [complete]");
        logSubscription = trx.log.subscribe("*", ingestEvent);
    }

    function cycleId(eventId: string) {
        const m = eventId.match(/^(\d+)\:/);
        if (!m) {
            stub.error("Invalid event id: " + eventId);
            return -1;
        } else {
            return parseInt(m[1], 10);
        }
    }

    function ingestEvent(e: StreamEvent) {
        const cid = cycleId(e.id);
        if (bufferCycle < 0) {
            // new cycle
            bufferCycle = cid;
        }
        if (e.type === traxEvents.CycleComplete || cid !== bufferCycle) {
            if (e.type === traxEvents.CycleComplete) {
                buffer.push(e);
            } else {
                // we shouldn't get here
                stub.error(`Invalid Cycle Ids: expected ${bufferCycle} / received ${cid}`);
            }
            // push last events
            if (buffer.length) {
                stub.sendMessage({ to: "TraxClientAPI", type: DtMsgType.LOGS, cycleId: bufferCycle, events: buffer });
                buffer = [];
            }
            // reset 
            bufferCycle = -1;
        } else {
            buffer.push(e);
        }
    }

    function stopMonitoring() {
        if (!trx) return;
        logSubscription && trx.log.unsubscribe(logSubscription);
        logSubscription = undefined;
        bufferCycle = -1;
    }

    // Tell the clientAPI that we are loaded
    stub.sendMessage({ to: "TraxClientAPI", type: DtMsgType.ACTION, actionName: "startMonitoring" });
    return {
        connectTrax(traxInstance: Trax) {
            trx = traxInstance;
            stub.trace("Client Proxy: Trax registered");
        }
    }
}

export function loadClientProxy(w?: Window) {
    const stub = createPostMsgStub(w || (globalThis as any));
    (globalThis as any).__TRAX_DEVTOOLS__ = createClientProxy(stub);
}
