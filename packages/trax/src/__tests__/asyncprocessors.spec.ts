import { beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv } from '../core';
import { $Store, $Trax } from '../types';
import { $Person, pause, printEvents } from './utils';

describe('Async processors', () => {
    let trax: $Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    async function getFriendlyName(name: string, throwError = false) {
        await pause(1);
        // log an event to ease test synchronisation
        trax.log.event("GetFriendlyName");
        if (throwError) {
            throw Error("Friendly Name Error");
        }
        return `Friendly(${name})`;
    }

    async function getAvatar(name: string) {
        await pause(1);
        // log an event to ease test synchronisation
        trax.log.event("GetAvatar");
        return `Avatar(${name})`;
    }

    function createPStore(firstName = "Homer", includeAvatar = false) {
        return trax.createStore("PStore", (store: $Store<$Person>) => {
            const p = store.initRoot({ firstName, lastName: "Simpson" });

            store.compute("PrettyName", function* () {
                let fn = p.firstName, nm = "";
                if (fn) {
                    const ffn: string = yield getFriendlyName(fn);
                    nm = ffn + " " + p.lastName;
                } else {
                    nm = p.lastName;
                }
                p.prettyName = nm;
                p.prettyNameLength = nm.length;
                if (includeAvatar) {
                    p.avatar = yield getAvatar(fn);
                }
            });
        });
    }

    describe('Compute', () => {
        it('should support 0 step generators', async () => {
            const ps = createPStore("");
            const p = ps.root;
            const pr = ps.get("PrettyName", true);

            expect(p.prettyName).toBe("Simpson");
            expect(p.prettyNameLength).toBe(7);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> ''",
                "0:6 !GET - PStore/root.lastName -> 'Simpson'",
                "0:7 !SET - PStore/root.prettyName = 'Simpson' (prev: undefined)",
                "0:8 !SET - PStore/root.prettyNameLength = 7 (prev: undefined)",
                "0:9 !PCE - 0:4",
                "0:10 !PCE - 0:1",
                "0:11 !GET - PStore/root.prettyName -> 'Simpson'",
                "0:12 !GET - PStore/root.prettyNameLength -> 7",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);
        });

        it('should support 1 step generators', async () => {
            const ps = createPStore();
            const p = ps.root;
            const pr = ps.get("PrettyName", true);

            expect(pr.isDirty).toBe(false); // because the compute process has been launched
            expect(p.prettyName).toBe(undefined); // not processed yet
            expect(p.prettyNameLength).toBe(undefined);
            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName"
            ]);

            await trax.log.await("GetFriendlyName");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Homer) Simpson");
            expect(p.prettyNameLength).toBe(23);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Homer'",
                "0:6 !PCP - 0:4", // Pause
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.prettyName -> undefined",
                "0:9 !GET - PStore/root.prettyNameLength -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:4", // Resume
                "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                "2:3 !SET - PStore/root.prettyName = 'Friendly(Homer) Simpson' (prev: undefined)",
                "2:4 !SET - PStore/root.prettyNameLength = 23 (prev: undefined)",
                "2:5 !PCE - 0:4",
                "3:1 !GET - PStore/root.prettyName -> 'Friendly(Homer) Simpson'",
                "3:2 !GET - PStore/root.prettyNameLength -> 23",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);

            await trax.reconciliation(); // to move to next cycle
            expect(pr.isDirty).toBe(false);
            p.firstName = "Bart";
            expect(pr.isDirty).toBe(true);

            expect(p.prettyName).toBe("Friendly(Homer) Simpson"); // not re-processed yet

            await trax.log.await("GetFriendlyName");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Bart) Simpson");

            expect(printLogs(4)).toMatchObject([
                "4:1 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "4:2 !DRT - PStore/%PrettyName <- PStore/root.firstName",
                "4:3 !GET - PStore/root.prettyName -> 'Friendly(Homer) Simpson'",
                "4:4 !PCS - Reconciliation #1 - 1 processor",
                "4:5 !PCS - Compute #2 (PStore/%PrettyName) P1 Reconciliation - parentId=4:4",
                "4:6 !GET - PStore/root.firstName -> 'Bart'",
                "4:7 !PCP - 4:5",
                "4:8 !PCE - 4:4",
                "5:1 GetFriendlyName - NO-DATA",
                "6:1 !PCR - 4:5",
                "6:2 !GET - PStore/root.lastName -> 'Simpson'",
                "6:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: 'Friendly(Homer) Simpson')",
                "6:4 !SET - PStore/root.prettyNameLength = 22 (prev: 23)",
                "6:5 !PCE - 4:5",
                "7:1 !GET - PStore/root.prettyName -> 'Friendly(Bart) Simpson'",
            ]);

            ps.delete(pr);
            await trax.reconciliation(); // to move to next cycle
            expect(pr.isDirty).toBe(false);
            p.firstName = "Lisa";
            expect(pr.isDirty).toBe(false); // no changes
        });

        it('should support 2+ steps generators', async () => {
            const ps = createPStore("Bart", true);
            const p = ps.root;
            const pr = ps.get("PrettyName", true);

            expect(p.avatar).toBe(undefined);

            await trax.log.await("GetAvatar");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Bart) Simpson");
            expect(p.prettyNameLength).toBe(22);
            expect(p.avatar).toBe("Avatar(Bart)");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Bart'",
                "0:6 !PCP - 0:4", // Pause
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.avatar -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:4", // Resume
                "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                "2:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                "2:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                "2:5 !PCP - 0:4", // Pause
                "3:1 GetAvatar - NO-DATA",
                "4:1 !PCR - 0:4", // Resume
                "4:2 !SET - PStore/root.avatar = 'Avatar(Bart)' (prev: undefined)",
                "4:3 !PCE - 0:4", // End
                "5:1 !GET - PStore/root.prettyName -> 'Friendly(Bart) Simpson'",
                "5:2 !GET - PStore/root.prettyNameLength -> 22",
                "5:3 !GET - PStore/root.avatar -> 'Avatar(Bart)'",
            ]);

            await trax.reconciliation(); // next cycle
            p.lastName = "SIM";

            await trax.log.await("GetAvatar");
            expect(p.avatar).toBe("Avatar(Bart)");

            expect(printLogs(6)).toMatchObject([
                "6:1 !SET - PStore/root.lastName = 'SIM' (prev: 'Simpson')",
                "6:2 !DRT - PStore/%PrettyName <- PStore/root.lastName",
                "6:3 !PCS - Reconciliation #1 - 1 processor",
                "6:4 !PCS - Compute #2 (PStore/%PrettyName) P1 Reconciliation - parentId=6:3",
                "6:5 !GET - PStore/root.firstName -> 'Bart'",
                "6:6 !PCP - 6:4", // Pause
                "6:7 !PCE - 6:3",
                "7:1 GetFriendlyName - NO-DATA",
                "8:1 !PCR - 6:4", // Resume
                "8:2 !GET - PStore/root.lastName -> 'SIM'",
                "8:3 !SET - PStore/root.prettyName = 'Friendly(Bart) SIM' (prev: 'Friendly(Bart) Simpson')",
                "8:4 !SET - PStore/root.prettyNameLength = 18 (prev: 22)",
                "8:5 !PCP - 6:4", // Pause
                "9:1 GetAvatar - NO-DATA",
                "10:1 !PCR - 6:4", // Resume (no changes after that)
                "10:2 !PCE - 6:4", // End
                "10:3 !GET - PStore/root.avatar -> 'Avatar(Bart)'",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);
        });

        it('should cancel and restart compute if dependencies change during compute', async () => {
            const ps = createPStore("Bart", true);
            const p = ps.root;
            const pr = ps.get("PrettyName", true);

            expect(p.avatar).toBe(undefined);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
            p.firstName = "Lisa";

            await trax.log.await("GetAvatar");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Lisa) Simpson");
            expect(p.avatar).toBe("Avatar(Lisa)");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Bart'",
                "0:6 !PCP - 0:4", // Pause
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.avatar -> undefined",
                "0:9 !SET - PStore/root.firstName = 'Lisa' (prev: 'Bart')",
                "0:10 !DRT - PStore/%PrettyName <- PStore/root.firstName",
                "0:11 !PCS - Reconciliation #1 - 1 processor",
                "0:12 !PCS - Compute #2 (PStore/%PrettyName) P1 Reconciliation - parentId=0:11",
                "0:13 !GET - PStore/root.firstName -> 'Lisa'",
                "0:14 !PCP - 0:12", // Pause
                "0:15 !PCE - 0:11",
                "1:1 GetFriendlyName - NO-DATA", // First promise, discarded
                "2:1 GetFriendlyName - NO-DATA", // Second promise
                "3:1 !PCR - 0:12", // Resume
                "3:2 !GET - PStore/root.lastName -> 'Simpson'",
                "3:3 !SET - PStore/root.prettyName = 'Friendly(Lisa) Simpson' (prev: undefined)",
                "3:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                "3:5 !PCP - 0:12",
                "4:1 GetAvatar - NO-DATA",
                "5:1 !PCR - 0:12",
                "5:2 !SET - PStore/root.avatar = 'Avatar(Lisa)' (prev: undefined)",
                "5:3 !PCE - 0:12",
                "6:1 !GET - PStore/root.prettyName -> 'Friendly(Lisa) Simpson'",
                "6:2 !GET - PStore/root.avatar -> 'Avatar(Lisa)'",
            ]);
        });

        it('should support generator functions that dont return promises', async () => {
            const ps = trax.createStore("PStore", (store: $Store<$Person>) => {
                const p = store.initRoot({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    let fn = p.firstName, nm = "";
                    if (fn) {
                        const ffn: string = yield `Friendly(${fn})` as any;
                        nm = ffn + " " + p.lastName;
                    } else {
                        nm = p.lastName;
                    }
                    p.prettyName = nm;
                    trax.log.event("Done");
                });
            });

            expect(ps.root.prettyName).toBe(undefined);
            await trax.log.await("Done");
            expect(ps.root.prettyName).toBe("Friendly(Bart) Simpson");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Bart'",
                "0:6 !PCP - 0:4",
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.prettyName -> undefined",
                "1:1 !PCR - 0:4",
                "1:2 !GET - PStore/root.lastName -> 'Simpson'",
                "1:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                "1:4 Done - NO-DATA",
                "1:5 !PCE - 0:4",
                "2:1 !GET - PStore/root.prettyName -> 'Friendly(Bart) Simpson'",
            ]);
        });
    });

    describe('Errors', () => {
        it('should raise an error in case of compute error before yield', async () => {
            const ps = trax.createStore("PStore", (store: $Store<$Person>) => {
                const p = store.initRoot({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    throw Error("Error 1");
                });
            });
            const pr = ps.get("PrettyName", true);

            expect(ps.root.prettyName).toBe(undefined);
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !ERR - [TRAX] (PStore/%PrettyName) Compute error: Error: Error 1",
                "0:6 !PCE - 0:4",
                "0:7 !ERR - [TRAX] (PStore/%PrettyName) No dependencies found: processor will never be re-executed",
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.prettyName -> undefined",
            ]);

            expect(pr.dependencies).toMatchObject([]);
        });

        it('should raise an error in case of compute error during yield', async () => {
            const ps = trax.createStore("PStore", (store: $Store<$Person>) => {
                const p = store.initRoot({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    p.prettyName = yield getFriendlyName(p.firstName, true);
                    trax.log.event("Done");
                });
            });
            const pr = ps.get("PrettyName", true);

            expect(ps.root.prettyName).toBe(undefined);
            await trax.log.await("GetFriendlyName");
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Bart'",
                "0:6 !PCP - 0:4",
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.prettyName -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !ERR - [TRAX] (PStore/%PrettyName) Compute error: Error: Friendly Name Error",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
        });

        it('should raise an error in case of compute error after yield', async () => {
            const ps = trax.createStore("PStore", (store: $Store<$Person>) => {
                const p = store.initRoot({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    p.prettyName = yield getFriendlyName(p.firstName);
                    throw Error("Error 2");
                });
            });
            const pr = ps.get("PrettyName", true);

            expect(ps.root.prettyName).toBe(undefined);
            await trax.log.await("GetFriendlyName");
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - O: PStore/root",
                "0:3 !NEW - P: PStore/%PrettyName",
                "0:4 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:5 !GET - PStore/root.firstName -> 'Bart'",
                "0:6 !PCP - 0:4",
                "0:7 !PCE - 0:1",
                "0:8 !GET - PStore/root.prettyName -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:4",
                "2:2 !SET - PStore/root.prettyName = 'Friendly(Bart)' (prev: undefined)",
                "2:3 !ERR - [TRAX] (PStore/%PrettyName) Compute error: Error: Error 2",
                "2:4 !PCE - 0:4",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
        });
    });
});