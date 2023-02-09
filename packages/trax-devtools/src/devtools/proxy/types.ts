import { StreamEvent } from "@traxjs/trax";

/**
 * Type of messages supported in the application
 */
export enum DtMsgType {
    /** Method call, no return value (DevTools->TraxClientAPI->TraxClientProxy->Trax) */
    ACTION = "TRXA",
    /** Async method call with return value (DevTools->TraxClientAPI->TraxClientProxy->Trax) */
    CALL = "TRXC",
    /** Log push (Trax->TraxClientProxy->TraxClientAPI->DevTools) */
    LOGS = "TRXL"
}

export const dtMsgHandlers: Record<string, DtMsgHandler> = {
    clientAPI: "TraxClientAPI",
    bkgScript: "TraxBkgScript",
    contentScript: "TraxContentScript",
    clientProxy: "TraxClientProxy",
}

export type DtMsgHandler = "TraxClientAPI" | "TraxBkgScript" | "TraxContentScript" | "TraxClientProxy" | "Unknown";

export type DtMessage = DtMsgAction | DtMsgLogs;

export interface DtMsgBase {
    /** Type of event */
    type: DtMsgType;
    /** Tab associated to this event */
    tabId?: number; // cf. chrome.devtools.inspectedWindow.tabId
    /** Event source */
    from?: DtMsgHandler,
    /** Event destination */
    to: DtMsgHandler,
    /** Last intermediary handler that forwarded the message */
    via?: DtMsgHandler,

}

export interface DtMsgAction extends DtMsgBase {
    type: DtMsgType.ACTION,
    actionName: "startMonitoring" | "stopMonitoring"
}

export interface DtMsgLogs extends DtMsgBase {
    type: DtMsgType.LOGS,
    cycleId: number;
    events: StreamEvent[];
}

export interface DtMessageStub {
    setName(nm: DtMsgHandler): void;
    sendMessage(m: DtMessage): void;
    setMessageListener(ln: (m: DtMessage) => void): void;
    trace(...args: any[]): void;
    error(...args: any[]): void;
}
