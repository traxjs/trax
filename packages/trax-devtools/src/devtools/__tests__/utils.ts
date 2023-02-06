import { Store, Trax } from "@traxjs/trax";

export const EVENT_GET_AVATAR_COMPLETE = "@traxjs/trax-devtools/test/getAvatarComplete";

export interface Person {
    firstName: string;
    lastName: string;
    prettyName?: string;
    prettyNameLength?: number;
    avatar?: string;
}

export async function pause(timeMs = 10) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeMs);
    });
}

async function getAvatar(name: string, trx: Trax) {
    await pause(1);
    // log an event to ease test synchronisation
    trx.log.event(EVENT_GET_AVATAR_COMPLETE);
    return `Avatar(${name})`;
}

export function createPStore(trx: Trax) {
    return trx.createStore("PStore", (store: Store<Person>) => {
        const p = store.init({ firstName: "Homer", lastName: "Simpson" });

        store.compute("PrettyName", function* () {
            let nm = p.firstName + " " + p.lastName;
            p.prettyName = nm;
            p.prettyNameLength = nm.length;
            p.avatar = yield getAvatar(p.firstName, trx);
        });
    });
}
