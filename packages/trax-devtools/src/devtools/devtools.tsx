import { component, componentId, useStore } from "@traxjs/trax-react";
import { createDevToolsStore } from "./devtoolsstore";
import { DtClientAPI, DtLogCycle, DtLogEvent, DtTraxPgCollectionUpdate, DtTraxPgCompute, DtTraxPgStoreInit } from "./types";
import './devtools.css';
import { traxEvents } from "@traxjs/trax";

export const DevTools = component("DtDevTools", (props: { clientAPI: DtClientAPI }) => {
    const store = useStore(() => createDevToolsStore(props.clientAPI));
    const data = store.data;
    const logs = data.logs;

    return <div className="devtools">
        <DtMainTabs />
        <div className="log-pane">
            {logs.map((c) => <DtLogCycleBlock key={"cycle:" + c.cycleId} logCycle={c} />)}

        </div>
    </div>
});

const DtMainTabs = component("DtMainTabs", () => {
    const tabs = [{ key: "STORES", label: "Stores" }, { key: "LOGS", label: "Logs" }];

    return <div className="main-tabs">
        <div className="tab-group">
            {tabs.map(tab => <label className="tab">
                <input className="tab-input" type="radio" name="dt-main-tabs" value={tab.key} checked={tab.key === "LOGS"} />
                <span className="tab-title">{tab.label}</span>
            </label>)}
        </div>
    </div>
});

const DtLogCycleBlock = component("DtLogCycle", (props: { logCycle: DtLogCycle }) => {
    const { logCycle } = props;

    const content: JSX.Element[] = [];

    printEvents(logCycle.events, 0, content);

    return <div className="log-cycle">
        <div className="header">&nbsp;</div>
        <div className="content">{content}</div>
    </div>
});

function printEvents(events: DtLogEvent[], indent: number, output: JSX.Element[]) {
    for (const e of events) {
        if (!e.matchFilter) continue; // not in view
        const tp = e.type;
        let evtName: string = e.type;
        let evtClassName = "";
        if (evtName && evtName.charAt(0) === "!") {
            evtName = evtName.slice(1);
            evtClassName = "evt-" + evtName.toLowerCase();
        }

        if (tp === traxEvents.Get) {
            addLine(`${e.id} ${tp} ${e.objectId}.${e.propName} --> ${e.propValue}`);
            // addLine([pill(evtName, evtClassName), objectId(e.objectId), ".", propName(e.propName), "--> xxx"]);
        } else if (tp === traxEvents.Set) {
            addLine(`${e.id} ${tp} ${e.objectId}.${e.propName} = ${e.toValue} (previous: ${e.fromValue})`);
        } else if (tp === traxEvents.Error || tp === traxEvents.Info || tp === traxEvents.Warning) {
            addLine(`${e.id} ${tp} ${e.data}`);
        } else if (tp === traxEvents.New) {
            addLine(`${e.id} ${tp} ${e.objectId}(${e.objectType})`);
        } else if (tp === traxEvents.Dispose) {
            addLine(`${e.id} ${tp} ${e.objectId}`);
        } else if (tp === traxEvents.ProcessorDirty) {
            addLine(`${e.id} ${tp} ${e.objectId}.${e.propName} => ${e.processorId}`);
        } else if (tp === "!PCG") {
            const as = e.async ? " ASYNC" : "";
            const rs = e.resume ? ":RESUME" : "";
            let btn: string | JSX.Element = "";
            if (e.contentSize > 0) {
                btn = treeBtn(e.expanded);
            }
            if (e.name === "!StoreInit") {
                const evt = e as DtTraxPgStoreInit;
                addLine([btn, `${e.id} ${tp} !StoreInit${rs} ${evt.storeId}${as}`]);
            } else if (e.name === "!Compute") {
                const evt = e as DtTraxPgCompute;
                const renderer = evt.isRenderer ? " RENDERER" : "";
                addLine([btn, `${e.id} ${tp} !Compute${rs} ${evt.processorId} (${evt.trigger}) #${evt.computeCount} P${evt.processorPriority}${renderer}${as}`]);
            } else if (e.name === "!ArrayUpdate" || e.name === "!DictionaryUpdate") {
                const evt = e as DtTraxPgCollectionUpdate;
                addLine([btn, `${e.id} ${tp} ${evt.name}${rs} ${evt.objectId}${as}`]);
            } else {
                addLine([btn, `${e.id} ${tp} ${e.name}${rs}${as}`]);
            }

            if (e.expanded && e.events) {
                printEvents(e.events, indent + 1, output);
            }

        } else if (tp === "!EVT") {
            let d = e.data !== '' ? JSON.stringify(e.data) : '';
            if (d) {
                d = " data:" + d.replace(/\"/g, "'");
            }
            addLine(`${e.id} ${tp} ${e.eventType}${d}`);
        } else {
            addLine(`Unknown event type: ${tp}`);
        }

        function addLine(content: string | (string | JSX.Element)[]) {
            const idt = ((indent + 1) * (1.8
                )) + "rem";
            output.push(<div className={"log-line evt " + evtClassName} style={{ paddingLeft: idt }}>
                {content}
            </div>);
        }
    }

}

function treeBtn(expanded: boolean) {
    return <button className="tree-btn">{expanded ? "▼ " : "▶ "}</button>
}

function pill(text: string, cls: string) {
    return <span className={"pill " + cls}> {text} </span>
}

function objectId(text: string) {
    return <span className="pill objectId"> {text} </span>
}

function propName(text: string) {
    return <span className="pill propName"> {text} </span>
}
