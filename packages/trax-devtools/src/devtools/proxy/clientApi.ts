
/** 
 * API object exposed to the devtools - can be launched in a iframe of extension context 
 * Will be discovered by the DevTools thanks to the __TRAX_CLIENT_API__ global variable 
 **/

import { DtClientAPI, DtEventGroup } from "../types";
import { DtMessageStub, DtMsgType } from "./types";

export function createClientAPI(stub: DtMessageStub): DtClientAPI {
    let active = false;
    let logListener: ((events: DtEventGroup) => void) | undefined;

    stub.setName("TraxClientAPI");
    stub.setMessageListener((m) => {
        const tp = m.type;
        if (tp === DtMsgType.ACTION) {
            if (m.actionName === "startMonitoring") {
                // tell the proxy that we are loaded (this can occur when the devtools are loaded before the proxy)
                active && stub.sendMessage({ to: "TraxClientProxy", type: DtMsgType.ACTION, actionName: "startMonitoring" });
            } else {
                stub.trace("TODO: support action");
            }
        } else if (tp === DtMsgType.LOGS) {
            logListener && logListener({ cycleId: m.cycleId, events: m.events });
        }

    });

    const api = {
        startMonitoring() {
            active = true;
            stub.sendMessage({ to: "TraxClientProxy", type: DtMsgType.ACTION, actionName: "startMonitoring" });
        },
        stopMonitoring() {
            active = false;
            stub.sendMessage({ to: "TraxClientProxy", type: DtMsgType.ACTION, actionName: "stopMonitoring" });
        },
        onChange(listener: (events: DtEventGroup) => void) {
            logListener = listener;
        }
    }
    return api;
}
