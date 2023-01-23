import { traxMD } from "../core";
import { EventStream, TraxLogObjectLifeCycle, TraxLogProcDirty, TraxLogProcessStart, TraxLogPropGet, TraxLogPropSet, traxEvents } from "../index";

export interface Person {
    firstName: string;
    lastName: string;
    prettyName?: string;
    prettyNameLength?: number;
    avatar?: string;
}

export interface SimpleFamilyStore {
    childNames?: string; // computed
    father?: Person;
    mother?: Person;
    child1?: Person;
    child2?: Person;
    child3?: Person;
}

export interface ArrayFamilyStore {
    familyName: string;
    members: Person[];
    size?: number;
    names?: string;
    infos?: { desc: string }[];
    misc?: { desc: string }[][];
}

export interface DictFamilyStore {
    familyName: string;
    members: { [id: string]: Person }
    size?: number;
    names?: string;
    infos?: { [key: string]: { desc: string } };
}

export async function pause(timeMs = 10) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeMs);
    });
}

export function printEvents(log: EventStream, ignoreCycleEvents = true, minCycleId = 0): string[] {
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
            let data = formatData(evt.type, evt.data);
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

        if (eventType === traxEvents.CycleStart || eventType === traxEvents.CycleComplete) {
            return `0`; // 0 = elapsedTime
        } else if (eventType === traxEvents.Info
            || eventType === traxEvents.Warning
            || eventType === traxEvents.Error
            || eventType === traxEvents.ProcessingPause
            || eventType === traxEvents.ProcessingResume
            || eventType === traxEvents.ProcessingeEnd) {
            return `${data.replace(/"/g, "")}`;
        } else if (eventType === traxEvents.ProcessingStart) {
            const d = sd as TraxLogProcessStart;
            if (d.name === "StoreInit") {
                return `${d.name} (${d.storeId})`;
            } else if (d.name === "Compute") {
                const R = d.isRenderer ? " R" : "";
                return `${d.name} #${d.computeCount} (${d.processorId}) P${d.processorPriority} ${d.trigger}${R}`;
            } else if (d.name === "Reconciliation") {
                return `${d.name} #${d.index} - ${d.processorCount} processor${d.processorCount !== 1 ? "s" : ""}`;
            } else if (d.name === "ArrayUpdate") {
                return `${d.name} (${d.objectId})`;
            } else {
                return `${(d as any).name}`;
            }
        } else if (eventType === traxEvents.New) {
            const d = sd as TraxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType}: ${d.objectId}`;
        } else if (eventType === traxEvents.Dispose) {
            const d = sd as TraxLogObjectLifeCycle;
            if (d.objectId === undefined) return data;
            return `${d.objectType ? d.objectType + ": " : ""}${d.objectId}`;
        } else if (eventType === traxEvents.Get) {
            const d = sd as TraxLogPropGet;
            return `${d.objectId}.${d.propName} -> ${stringify(d.propValue)}`;
        } else if (eventType === traxEvents.Set) {
            const d = sd as TraxLogPropSet;
            return `${d.objectId}.${d.propName} = ${stringify(d.toValue)} (prev: ${stringify(d.fromValue)})`;
        } else if (eventType === traxEvents.ProcessorDirty) {
            const d = sd as TraxLogProcDirty;
            return `${d.processorId} <- ${d.objectId}.${d.propName}`;
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
        return "'" + v.replace(/\'/g, "\\'") + "'"
    } else {
        return "" + v;
    }
}
