import { Store, trax } from "@traxjs/trax";

export interface ListItem {
    description: string;
    urgent: boolean;
}

export interface ListData {
    items: ListItem[];
    nbrOfUrgentItems: number;
}

export type ListStore = ReturnType<typeof createListStore>;

export function createListStore() {
    return trax.createStore("ListStore", (store: Store<ListData>) => {
        const data = store.init({
            items: [],
            nbrOfUrgentItems: 0
        });
        const items = data.items;
        let count = 0;

        store.compute("UrgentItems", () => {
            data.nbrOfUrgentItems = data.items.filter(itm => itm.urgent).length;
        });

        return {
            data,
            addItem() {
                count++;
                items.push({
                    description: "Item #" + count,
                    urgent: count % 3 === 1
                });
            },
            removeItem(item: ListItem) {
                const idx = items.indexOf(item);
                if (idx > -1) {
                    items.splice(idx, 1);
                }
            },
            clear() {
                items.splice(0, items.length);
            }
        }
    });
}
