import { $EventStream, traxEvents } from "../types";

export function printEvents(log: $EventStream,ignoreCycleEvents = true): string[] {
    const arr: string[] = [];
    log.scan((evt) => {
        if (!ignoreCycleEvents || (evt.type !== traxEvents.CycleStart && evt.type !== traxEvents.CycleComplete)) {
            let data = evt.data;
            if ((evt.type === traxEvents.CycleStart || evt.type === traxEvents.CycleComplete)) {
                // item.data is a string - e.g.: '{"elapsedTime":0}'
                data = ("" + evt.data).replace(/"elapsedTime":\d+/, '"elapsedTime":0');
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
