import { trax } from '@traxjs/trax';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { User } from '../types';
import { createUserStore, LOG_USER_STORE_GET_USERS, UserStore } from '../userstore';

describe('Message Store', () => {
    let store: UserStore, subId: any, getUsersCount = 0;

    beforeEach(() => {
        store = createUserStore();
        getUsersCount = 0;
    });

    beforeAll(() => {
        subId = trax.log.subscribe(LOG_USER_STORE_GET_USERS, (e) => {
            getUsersCount++;
        });
    });

    afterAll(() => {
        trax.log.unsubscribe(subId);
    });

    async function pause(timeMs = 10) {
        return new Promise((resolve) => {
            setTimeout(resolve, timeMs);
        });
    }

    function printUsers(users: (User | null)[]) {
        const r: string[] = [];
        for (const user of users) {
            if (user) {
                r.push(`${user.id}/${user.name}/${user.status}/${user.avatar}`)
            } else {
                r.push('Unknown User');
            }
        }
        return r;
    }

    it('should allow to get several users', async () => {
        const p1 = store.getUser("U1");
        const p2 = store.getUser("U3");
        const p3 = store.getUser("U9"); // invalid
        const p4 = store.getUser("U3");

        const r = await Promise.all([p1, p2, p3, p4]);
        expect(printUsers(r)).toMatchObject([
            "U1/Homer Simpson/Away/homer.png",
            "U3/Bart Simpson/OOO/bart.png",
            "Unknown User",
            "U3/Bart Simpson/OOO/bart.png",
        ]);
        expect(getUsersCount).toBe(1);
        expect(r[1]).toBe(r[3]);
        const u3 = await store.getUser("U3");
        expect(r[1]).toBe(u3);
        expect(getUsersCount).toBe(1); // served from cache

        const u4 = await store.getUser("U4"); // new user
        expect(u4?.name).toBe("Lisa Simpson");
        expect(getUsersCount).toBe(2); // new request
    });

    it('should mutualise requests made during server calls', async () => {
        const p1 = store.getUser("U1");
        const p2 = store.getUser("U3");

        await trax.log.awaitEvent(LOG_USER_STORE_GET_USERS);
        const p3 = store.getUser("U3");
        const r = await Promise.all([p1, p2, p3]);
        expect(printUsers(r)).toMatchObject([
            "U1/Homer Simpson/Away/homer.png",
            "U3/Bart Simpson/OOO/bart.png",
            "U3/Bart Simpson/OOO/bart.png",
        ]);
        expect(r[1]).toBe(r[2]);
        expect(getUsersCount).toBe(1);
        await pause(20); // to ensure no other call is done
        expect(getUsersCount).toBe(1);
    });

    it('should allow to update a user', async () => {
        const u1 = await store.getUser("U1");

        expect(u1?.name).toBe("Homer Simpson");
        await store.updateUser({
            id: "U1",
            name: "HOMER",
            avatar: "XXX.png",
            status: "OOO"
        })

        await trax.reconciliation();
        expect(u1?.name).toBe("HOMER");
        expect(u1?.avatar).toBe("XXX.png");
        expect(u1?.status).toBe("OOO");

        await store.updateUser({
            id: "U3",
            name: "BART",
        });
        const u3 = await store.getUser("U3");
        expect(u3!.name).toBe("BART");
        expect(u3!.avatar).toBe("bart.png");
    });

});