import { traxEvents } from "@traxjs/trax";
import { component } from "@traxjs/trax-preact";
import { DevToolsStore } from "../devtoolsstore";
import { APP_EVENT_TYPE, DtLogCycle, DtLogEvent, DtTraxPgCollectionUpdate, DtTraxPgCompute, DtTraxPgStoreInit, PCG_NAME_COMPUTE, PCG_NAME_RECONCILIATION, PROCESSING_GROUP_END, PROCESSING_GROUP_TYPE } from "../types";
import { Filters } from "./filters";
import { formatDuration } from "./format";
import './logs.css';

export const DtLogPane = component("DtLogs", (props: { store: DevToolsStore }) => {
    const { store } = props;
    const logs = store.data.logs;

    return <div className="logs-pane">
        <div className="logs">
            {logs.map((c) => <DtLogCycleBlock key={"cycle:" + c.cycleId} logCycle={c} />)}
        </div>
        <div className="logs-filter">
            <Filters store={store} />
        </div>
    </div>
});

const DtLogCycleBlock = component("DtLogCycle", (props: { logCycle: DtLogCycle }) => {
    const { logCycle } = props;

    const content: JSX.Element[] = [];

    printEvents(logCycle.events, 0, content);

    if (!logCycle.matchFilter) return <div></div>

    let clsName = "logs-cycle";
    let separator: string | JSX.Element = "";
    if (logCycle.elapsedMs > 50) {
        clsName = "logs-cycle long";
        separator = <div className="logs-idle-separator">
            <hr />
            <div className="info">idle {formatDuration(logCycle.elapsedMs)}</div>
        </div>
    }

    return <div className={clsName}>
        {separator}
        <div className="header" title={`Cycle #${logCycle.cycleId} (computed in ${logCycle.computeMs}ms)`}>&nbsp;</div>
        <div className="content">{content}</div>
    </div>
});


const objectTypes = {
    "": "(Unknown Type)",
    "O": "Data Object",
    "A": "Data Array",
    "S": "Store",
    "P": "Processor"
};

function printEvents(events: DtLogEvent[], indent: number, output: JSX.Element[]) {
    for (const e of events) {
        if (!e.matchFilter) continue; // not in view
        const tp = e.type;
        let eid = <span className="logs-eid">{e.id}</span>;
        let evtName: string = e.type;
        let evtClassName = "";
        if (evtName && evtName.charAt(0) === "!") {
            evtName = evtName.slice(1);
            evtClassName = "evt-" + evtName.toLowerCase();
        }

        if (tp === traxEvents.Get) {
            addLine(eid, pill("GET"), " ", objectRef(e.objectId, e.propName), ' ⮕ ', propValue(e.propValue));
        } else if (tp === traxEvents.Set) {
            addLine(eid, pill("SET", "logs-write"), " ", objectRef(e.objectId, e.propName), " = ", propValue(e.toValue), " (previous: ", propValue(e.fromValue), ")");
        } else if (tp === traxEvents.Error) {
            addLine(eid, pill("ERR", "logs-error-type"), " ", <span className="logs-error-msg">{"" + e.data}</span>);
        } else if (tp === traxEvents.Warning) {
            addLine(eid, pill("WRN", "logs-warning-type"), " ", <span className="logs-warning-msg">{"" + e.data}</span>);
        } else if (tp === traxEvents.Info) {
            addLine(eid, pill(tp.slice(1)), ` ${e.data}`);
        } else if (tp === traxEvents.New) {
            addLine(eid, pill("NEW"), ` ${(objectTypes as any)[e.objectType || ""]}: `, objectRef(e.objectId));
        } else if (tp === traxEvents.Dispose) {
            addLine(eid, pill("DEL"), " ", objectRef(e.objectId));
        } else if (tp === traxEvents.ProcessorDirty) {
            addLine(eid, dirtyPill(), " ", objectRef(e.processorId), " (triggered by ", objectRef(e.objectId, e.propName), ")");
        } else if (tp === traxEvents.ProcessorSkipped) {
            addLine(eid, pill("SKP", "logs-warning-type"), " ", objectRef(e.processorId));
        } else if (tp === PROCESSING_GROUP_TYPE) {
            const as = e.async ? " ASYNC" : "";
            let btn: string | JSX.Element = "";
            if (e.contentSize > 0) {
                eid = <span className="logs-eid btn" onClick={() => { e.expanded = !e.expanded }}>
                    <button className="eid-btn" >{e.expanded ? "▼ " : "▶ "}</button>
                    {e.id}
                </span>;
            }
            if (e.name === "!StoreInit") {
                const evt = e as DtTraxPgStoreInit;
                addLine(btn, eid, pill("INIT STORE"), " ", objectRef(evt.storeId));
            } else if (e.name === PCG_NAME_COMPUTE) {
                const evt = e as DtTraxPgCompute;

                if (evt.isRenderer) {
                    addLine(btn, eid, computeRender(), " ", objectRef(evt.processorId), ` (call #${evt.computeCount})`);
                } else {
                    let name = "COMPUTE";
                    if (e.async) {
                        name = e.resume ? "RESUME COMPUTE" : "ASYNC COMPUTE";
                    }
                    addLine(btn, eid, computeName(name), " ", objectRef(evt.processorId), ` (call #${evt.computeCount})`);
                }
            } else if (e.name === "!ArrayUpdate" || e.name === "!DictionaryUpdate") {
                const evt = e as DtTraxPgCollectionUpdate;
                const nm = e.name === "!ArrayUpdate" ? "UPDATE ARRAY" : "UPDATE DICT";
                addLine(btn, eid, pill(nm, "logs-write"), " ", objectRef(evt.objectId));
            } else if (e.name === PCG_NAME_RECONCILIATION) {
                addLine(btn, eid, computeRec("RECONCILE"));
            } else {
                // TODO RESUME
                const rs = e.resume ? "RESUME " : "";
                let name = "ACTION";
                if (e.async) {
                    name = e.resume ? "RESUME ACTION" : "ASYNC ACTION";
                }
                addLine(btn, eid, pill(name), " ", miscName(e.name));
            }

            if (e.expanded && e.events) {
                printEvents(e.events, indent + 1, output);
            }

        } else if (tp === APP_EVENT_TYPE) {
            let d = e.data !== '' ? JSON.stringify(e.data) : '';
            if (d) {
                d = " data:" + d;
            }
            addLine(eid, pill("EVT"), " ", miscName(e.eventType), ` ${d}`);
        } else if (tp === PROCESSING_GROUP_END) {
            addLine(eid, pill(e.isPause ? "PAUSE" : "END", "logs-pcg-end"));
        } else {
            addLine(`Unknown event type: ${tp}`);
        }

        function addLine(...content: (string | JSX.Element)[]) {
            const idt = (1.5 + (indent) * (2)) + "rem";
            output.push(<div className={"logs-line evt " + evtClassName} style={{ paddingLeft: idt }}>
                {content}
            </div>);
        }
    }

}

function computeName(name: string) {
    return pill(name, "logs-compute");
}

function computeRec(name: string) {
    return pill(name, "logs-reconciliation");
}

function computeRender() {
    return pill("RENDER", "logs-render");
}

function dirtyPill() {
    return pill("DRT", "logs-dirty");
}

function pill(text: string, cls: string = "logs-defaut-type") {
    return <span className={"logs-pill " + cls}>&nbsp;{text}&nbsp;</span>
}

function objectRef(text: string, propName?: string) {
    const m = text.match(/(^[^\/\%]+)(\/|\%)(.+$)/);
    let storeId = text, separator = "", idSuffix = "";
    if (m) {
        storeId = m[1];
        separator = m[2];
        idSuffix = m[3];
    }

    return <>
        <span className="logs-objectId"><span className="storeId">{storeId}</span><span className="separator">{separator}</span><span className="idSuffix">{idSuffix}</span></span>
        {propName && "."}{propName && <span className="logs-propName">{propName}</span>}
    </>
}

function propValue(value: any) {
    if (value === undefined) {
        value = "undefined";
    } else if (value === null) {
        value = "null";
    } else if (typeof value === "string") {
        if (value !== "[Function]") {
            // Check if this is the reference to another object
            const m = value.match(/^\[TRAX ([^\]]+)\]$/);
            if (m) {
                value = objectRef(m[1]);
            } else {
                value = '"' + value + '"';
            }
        }
    } else {
        value = "" + value;
    }
    return <span className="logs-value">{value}</span>
}

function miscName(text: string) {
    return <span className="logs-misc-name">{text}</span>
}

