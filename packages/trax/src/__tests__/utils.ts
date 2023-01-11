import { e } from "vitest/dist/index-761e769b";
import { traxMD } from "../core";
import { $EventStream, $TrxLogObjectLifeCycle, $TrxLogProcessStart, $TrxLogPropGet, $TrxLogPropSet, traxEvents } from "../types";

export function printEvents(log: $EventStream, ignoreCycleEvents = true, minCycleId = 0): string[] {
    const arr: string[] = [];
    log.scan((evt) => {
        const m = evt.id.match(/^\d+/);
        if (m) {
            const cycleId = parseInt(m[0], 10);
            if (cycleId < minCycleId) {
                return; // move next
            }
        }
        if (!ignoreCycleEvents || (evt.type !== traxEvents.CycleStart && evt.type !== traxEvents.CycleComplete)) {
            let data = evt.data;
            if ((evt.type === traxEvents.CycleStart || evt.type === traxEvents.CycleComplete)) {
                // item.data is a string - e.g.: '{"elapsedTime":0}'
                data = ("" + evt.data).replace(/"elapsedTime":\d+/, '"elapsedTime":0');
            } else {
                data = formatData(evt.type, evt.data);
            }
            let pid = "";
            if (evt.parentId) {
                pid = " - parentId=" + evt.parentId;
            }
            arr.push(`${evt.id} ${evt.type} - ${data || "NO-DATA"}${pid}`);
        }
    });
    return arr;
}

function formatData(eventType: string, data?: any) {
    if (!data || !eventType || eventType.charAt(0) !== "!") return data;
    try {
        const sd = JSON.parse("" + data);

        if (eventType === traxEvents.ProcessingStart) {
            const d = sd as $TrxLogProcessStart;
            const id = d.id ? " (" + d.id + ")" : "";
            return `${d.name}${id}`;
        } else if (eventType === traxEvents.New) {
            const d = sd as $TrxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType}: ${d.objectId}`;
        } else if (eventType === traxEvents.Dispose) {
            const d = sd as $TrxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType ? d.objectType + ": " : ""}${d.objectId}`;
        } else if (eventType === traxEvents.Get) {
            const d = sd as $TrxLogPropGet;
            return `${d.objectId}.${d.propName} -> ${stringify(d.propValue)}`;
        } else if (eventType === traxEvents.Set) {
            const d = sd as $TrxLogPropSet;
            return `${d.objectId}.${d.propName} = ${stringify(d.toValue)} (prev: ${stringify(d.fromValue)})`;
        }
    } catch (ex) { }
    return data;
}

function stringify(v: any) {
    if (v === undefined) {
        return "undefined";
    } else if (v === null) {
        return "null";
    } else if (typeof v === "object") {
        if (v[traxMD]) return v[traxMD].id;
        return JSON.stringify(v);
    } else if (typeof v === "string") {
        return "\"" + v.replace(/"/g, '\\"') + "\""
    } else {
        return "" + v;
    }
}
