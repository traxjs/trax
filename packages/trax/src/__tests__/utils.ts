import { formatEventData } from "../eventstream";
import { EventStream, traxEvents } from "../index";

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

const console1 = globalThis.console;

export function mockGlobalConsole() {
    const logs:string[] = [];
    globalThis.console = Object.create(console1, {
        log: {
            writable: true,
            configurable: true,
            value: (...args: any[]) => {
                logs.push(args[0]);
            }
        }
    });
    return logs;
}

export function resetGlobalConsole() {
    globalThis.console = console1;
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
            let data = formatEventData(evt.type, evt.data);
            let pid = "";
            if (evt.parentId) {
                pid = " - parentId=" + evt.parentId;
            }
            arr.push(`${evt.id} ${evt.type} - ${data || "NO-DATA"}${pid}`);
        }
    });
    return arr;
}
