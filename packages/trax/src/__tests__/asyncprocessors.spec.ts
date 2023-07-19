import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv } from '../core';
import { Store, Trax } from '../types';
import { Person, pause, printEvents, mockGlobalConsole, resetGlobalConsole, SimpleFamilyStore } from './utils';

describe('Async processors', () => {
    let trax: Trax;

    const EVT_GET_FRIENDLY_NAME = "GetFriendlyName";

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    async function getFriendlyName(name: string, throwError = false) {
        await pause(1);
        // log an event to ease test synchronisation
        trax.log.event(EVT_GET_FRIENDLY_NAME);
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
        return trax.createStore("PStore", (store: Store<Person>) => {
            const p = store.init({ firstName, lastName: "Simpson" });

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
            const p = ps.data;
            const pr = ps.getProcessor("PrettyName")!;

            expect(p.prettyName).toBe("Simpson");
            expect(p.prettyNameLength).toBe(7);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> ''",
                "0:7 !GET - PStore/root.lastName -> 'Simpson'",
                "0:8 !SET - PStore/root.prettyName = 'Simpson' (prev: undefined)",
                "0:9 !SET - PStore/root.prettyNameLength = 7 (prev: undefined)",
                "0:10 !PCE - 0:5",
                "0:11 !PCE - 0:1",
                "0:12 !GET - PStore/root.prettyName -> 'Simpson'",
                "0:13 !GET - PStore/root.prettyNameLength -> 7",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);
        });

        it('should support 1 step generators', async () => {
            const ps = createPStore();
            const p = ps.data;
            const pr = ps.getProcessor("PrettyName")!;

            expect(pr.dirty).toBe(false); // because the compute process has been launched
            expect(p.prettyName).toBe(undefined); // not processed yet
            expect(p.prettyNameLength).toBe(undefined);
            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName"
            ]);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Homer) Simpson");
            expect(p.prettyNameLength).toBe(23);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Homer'",
                "0:7 !PCP - 0:5", // Pause
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.prettyName -> undefined",
                "0:10 !GET - PStore/root.prettyNameLength -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:5", // Resume
                "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                "2:3 !SET - PStore/root.prettyName = 'Friendly(Homer) Simpson' (prev: undefined)",
                "2:4 !SET - PStore/root.prettyNameLength = 23 (prev: undefined)",
                "2:5 !PCE - 0:5",
                "3:1 !GET - PStore/root.prettyName -> 'Friendly(Homer) Simpson'",
                "3:2 !GET - PStore/root.prettyNameLength -> 23",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);

            await trax.reconciliation(); // to move to next cycle
            expect(pr.dirty).toBe(false);
            p.firstName = "Bart";
            expect(pr.dirty).toBe(true);

            expect(p.prettyName).toBe("Friendly(Homer) Simpson"); // not re-processed yet

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Bart) Simpson");

            expect(printLogs(4)).toMatchObject([
                "4:1 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "4:2 !DRT - PStore%PrettyName <- PStore/root.firstName",
                "4:3 !GET - PStore/root.prettyName -> 'Friendly(Homer) Simpson'",
                "4:4 !PCS - !Reconciliation #1 - 1 processor",
                "4:5 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=4:4",
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

            pr.dispose();
            await trax.reconciliation(); // to move to next cycle
            expect(pr.dirty).toBe(false);
            p.firstName = "Lisa";
            expect(pr.dirty).toBe(false); // no changes
        });

        it('should support 2+ steps generators', async () => {
            const ps = createPStore("Bart", true);
            const p = ps.data;
            const pr = ps.getProcessor("PrettyName")!;

            expect(p.avatar).toBe(undefined);

            await trax.log.awaitEvent("GetAvatar");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Bart) Simpson");
            expect(p.prettyNameLength).toBe(22);
            expect(p.avatar).toBe("Avatar(Bart)");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5", // Pause
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.avatar -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:5", // Resume
                "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                "2:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                "2:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                "2:5 !PCP - 0:5", // Pause
                "3:1 GetAvatar - NO-DATA",
                "4:1 !PCR - 0:5", // Resume
                "4:2 !SET - PStore/root.avatar = 'Avatar(Bart)' (prev: undefined)",
                "4:3 !PCE - 0:5", // End
                "5:1 !GET - PStore/root.prettyName -> 'Friendly(Bart) Simpson'",
                "5:2 !GET - PStore/root.prettyNameLength -> 22",
                "5:3 !GET - PStore/root.avatar -> 'Avatar(Bart)'",
            ]);

            await trax.reconciliation(); // next cycle
            p.lastName = "SIM";

            await trax.log.awaitEvent("GetAvatar");
            expect(p.avatar).toBe("Avatar(Bart)");

            expect(printLogs(6)).toMatchObject([
                "6:1 !SET - PStore/root.lastName = 'SIM' (prev: 'Simpson')",
                "6:2 !DRT - PStore%PrettyName <- PStore/root.lastName",
                "6:3 !PCS - !Reconciliation #1 - 1 processor",
                "6:4 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=6:3",
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
            const p = ps.data;
            const pr = ps.getProcessor("PrettyName")!;

            expect(p.avatar).toBe(undefined);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
            p.firstName = "Lisa";

            await trax.log.awaitEvent("GetAvatar");
            await trax.reconciliation();

            expect(p.prettyName).toBe("Friendly(Lisa) Simpson");
            expect(p.avatar).toBe("Avatar(Lisa)");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5", // Pause
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.avatar -> undefined",
                "0:10 !SET - PStore/root.firstName = 'Lisa' (prev: 'Bart')",
                "0:11 !DRT - PStore%PrettyName <- PStore/root.firstName",
                "0:12 !PCS - !Reconciliation #1 - 1 processor",
                "0:13 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=0:12",
                "0:14 !GET - PStore/root.firstName -> 'Lisa'",
                "0:15 !PCP - 0:13", // Pause
                "0:16 !PCE - 0:12",
                "1:1 GetFriendlyName - NO-DATA", // First promise, discarded
                "2:1 GetFriendlyName - NO-DATA", // Second promise
                "3:1 !PCR - 0:13", // Resume
                "3:2 !GET - PStore/root.lastName -> 'Simpson'",
                "3:3 !SET - PStore/root.prettyName = 'Friendly(Lisa) Simpson' (prev: undefined)",
                "3:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                "3:5 !PCP - 0:13",
                "4:1 GetAvatar - NO-DATA",
                "5:1 !PCR - 0:13",
                "5:2 !SET - PStore/root.avatar = 'Avatar(Lisa)' (prev: undefined)",
                "5:3 !PCE - 0:13",
                "6:1 !GET - PStore/root.prettyName -> 'Friendly(Lisa) Simpson'",
                "6:2 !GET - PStore/root.avatar -> 'Avatar(Lisa)'",
            ]);
        });

        it('should cancel compute when processor gets disposed', async () => {
            const ps = createPStore("Bart", true);
            const p = ps.data;
            const pr = ps.getProcessor("PrettyName")!;

            expect(p.avatar).toBe(undefined);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
            pr.dispose();

            await trax.reconciliation();
            await pause(20);

            // GetAvatar will not be called
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5",
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.avatar -> undefined",
                "0:10 !DEL - PStore%PrettyName",
                "1:1 GetFriendlyName - NO-DATA",
            ]);
        });

        it('should support generator functions that dont return promises', async () => {
            const ps = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Bart", lastName: "Simpson" });

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

            expect(ps.data.prettyName).toBe(undefined);
            await trax.log.awaitEvent("Done");
            expect(ps.data.prettyName).toBe("Friendly(Bart) Simpson");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5",
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.prettyName -> undefined",
                "1:1 !PCR - 0:5",
                "1:2 !GET - PStore/root.lastName -> 'Simpson'",
                "1:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                "1:4 Done - NO-DATA",
                "1:5 !PCE - 0:5",
                "2:1 !GET - PStore/root.prettyName -> 'Friendly(Bart) Simpson'",
            ]);
        });

        it('should register dependencies of async sections', async () => {
            const miscStore = trax.createStore("Misc", {
                text: "Some Text"
            });

            const ps = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Homer", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    let fn = p.firstName, nm = "";
                    const ffn: string = yield getFriendlyName(fn);
                    nm = ffn + " " + p.lastName + " " + miscStore.data.text;
                    p.prettyName = nm;
                    trax.log.event("PrettyNameSet");
                });
            });
            const pr = ps.getProcessor("PrettyName")!;

            expect(ps.data.prettyName).toBe(undefined);
            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);

            await trax.log.awaitEvent("PrettyNameSet");

            expect(pr.dependencies).toMatchObject([
                "Misc/root.text",
                "PStore/root.firstName",
                "PStore/root.lastName",
            ]);

            expect(ps.data.prettyName).toBe("Friendly(Homer) Simpson Some Text");

            miscStore.data.text = "Blahblah";

            await trax.reconciliation();
            expect(ps.data.prettyName).toBe("Friendly(Homer) Simpson Some Text"); // unchanged yet
            await trax.log.awaitEvent("PrettyNameSet");
            expect(ps.data.prettyName).toBe("Friendly(Homer) Simpson Blahblah");
        });

        describe('Console output', () => {
            afterEach(() => {
                resetGlobalConsole();
                trax.log.consoleOutput = "None";
            });

            it('should support console output (All)', async () => {
                const logs = mockGlobalConsole();

                trax.log.consoleOutput = "All";
                const ps = createPStore("Bart", true);
                const p = ps.data;


                await trax.log.awaitEvent("GetAvatar");
                await trax.reconciliation();
                p.lastName = "SIM";
                await trax.log.awaitEvent("GetAvatar");

                expect(logs.slice(0)).toMatchObject([
                    "0:1 !PCS - !StoreInit (PStore)",
                    "0:2 !NEW - S: PStore",
                    "0:3 !NEW - O: PStore/root",
                    "0:4 !NEW - P: PStore%PrettyName",
                    "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parent:0:1",
                    "0:6 !GET - PStore/root.firstName -> 'Bart'",
                    "0:7 !PCP - 0:5",
                    "0:8 !PCE - 0:1",
                    "1:1 GetFriendlyName",
                    "2:1 !PCR - 0:5",
                    "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                    "2:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                    "2:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                    "2:5 !PCP - 0:5",
                    "3:1 GetAvatar",
                    "4:1 !PCR - 0:5",
                    "4:2 !SET - PStore/root.avatar = 'Avatar(Bart)' (prev: undefined)",
                    "4:3 !PCE - 0:5",
                    "5:1 !SET - PStore/root.lastName = 'SIM' (prev: 'Simpson')",
                    "5:2 !DRT - PStore%PrettyName <- PStore/root.lastName",
                    "5:3 !PCS - !Reconciliation #1 - 1 processor",
                    "5:4 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parent:5:3",
                    "5:5 !GET - PStore/root.firstName -> 'Bart'",
                    "5:6 !PCP - 5:4",
                    "5:7 !PCE - 5:3",
                    "6:1 GetFriendlyName",
                    "7:1 !PCR - 5:4",
                    "7:2 !GET - PStore/root.lastName -> 'SIM'",
                    "7:3 !SET - PStore/root.prettyName = 'Friendly(Bart) SIM' (prev: 'Friendly(Bart) Simpson')",
                    "7:4 !SET - PStore/root.prettyNameLength = 18 (prev: 22)",
                    "7:5 !PCP - 5:4",
                    "8:1 GetAvatar",
                    "9:1 !PCR - 5:4",
                    "9:2 !PCE - 5:4",
                ]);
            });

            it('should support console output (AllButGet)', async () => {
                const logs = mockGlobalConsole();

                trax.log.consoleOutput = "AllButGet";
                const ps = createPStore("Bart", true);
                const p = ps.data;

                await trax.log.awaitEvent("GetAvatar");
                await trax.reconciliation();
                p.lastName = "SIM";
                await trax.log.awaitEvent("GetAvatar");

                expect(logs.slice(0)).toMatchObject([
                    "0:1 !PCS - !StoreInit (PStore)",
                    "0:2 !NEW - S: PStore",
                    "0:3 !NEW - O: PStore/root",
                    "0:4 !NEW - P: PStore%PrettyName",
                    "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parent:0:1",
                    "0:7 !PCP - 0:5",
                    "0:8 !PCE - 0:1",
                    "1:1 GetFriendlyName",
                    "2:1 !PCR - 0:5",
                    "2:3 !SET - PStore/root.prettyName = 'Friendly(Bart) Simpson' (prev: undefined)",
                    "2:4 !SET - PStore/root.prettyNameLength = 22 (prev: undefined)",
                    "2:5 !PCP - 0:5",
                    "3:1 GetAvatar",
                    "4:1 !PCR - 0:5",
                    "4:2 !SET - PStore/root.avatar = 'Avatar(Bart)' (prev: undefined)",
                    "4:3 !PCE - 0:5",
                    "5:1 !SET - PStore/root.lastName = 'SIM' (prev: 'Simpson')",
                    "5:2 !DRT - PStore%PrettyName <- PStore/root.lastName",
                    "5:3 !PCS - !Reconciliation #1 - 1 processor",
                    "5:4 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parent:5:3",
                    "5:6 !PCP - 5:4",
                    "5:7 !PCE - 5:3",
                    "6:1 GetFriendlyName",
                    "7:1 !PCR - 5:4",
                    "7:3 !SET - PStore/root.prettyName = 'Friendly(Bart) SIM' (prev: 'Friendly(Bart) Simpson')",
                    "7:4 !SET - PStore/root.prettyNameLength = 18 (prev: 22)",
                    "7:5 !PCP - 5:4",
                    "8:1 GetAvatar",
                    "9:1 !PCR - 5:4",
                    "9:2 !PCE - 5:4",
                ]);

            });
        });
    });

    describe('Store.add', () => {
        it('should allow to create sync and async root object processors on init', async () => {
            const pstore = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({
                    firstName: "Homer",
                    lastName: "Simpson"
                }, {
                    prettyName: function* (person) {
                        person.prettyName = yield getFriendlyName(person.firstName);
                    },
                    prettyNameLength: (person) => {
                        person.prettyNameLength = (person.prettyName || "").length;
                    }
                });
            });
            const proot = pstore.data;
            let output = "";
            pstore.compute("Render", () => {
                output = "VIEW: " + (proot.prettyName || "[empty]");
            }, true, true);

            const rootId = "PStore/root";
            const processorId = "PStore%root[prettyName]";

            expect(trax.getTraxId(pstore.data)).toBe(rootId);
            const pr = pstore.getProcessor("root[prettyName]");
            expect(pr).not.toBe(undefined);
            expect(pr!.id).toBe(processorId);
            expect(output).toBe("VIEW: [empty]");
            expect(proot.prettyNameLength).toBe(0);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();
            expect(output).toBe("VIEW: Friendly(Homer)");
            expect(proot.prettyNameLength).toBe(15);

            proot.firstName = "HOMER";
            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();
            expect(output).toBe("VIEW: Friendly(HOMER)");
            expect(proot.prettyNameLength).toBe(15);

            expect(pr!.disposed).toBe(false);
        });

        it('should allow to create and dispose multiple processors on add', async () => {
            const fstore = trax.createStore("FStore", (store: Store<SimpleFamilyStore>) => {
                const root = store.init({});
                const f = store.add<Person>("Father", {
                    firstName: "Homer",
                    lastName: "Simpson"
                }, {
                    pn: function* (o) {
                        o.prettyName = yield getFriendlyName(o.firstName);
                    },
                    pnLength: (o) => {
                        o.prettyNameLength = (o.prettyName || "").length;
                    }
                });
                root.father = f;
            });
            const proot = fstore.data;
            let output = "";
            fstore.compute("Render", () => {
                output = "VIEW: " + (proot.father!.prettyName || "[empty]");
            }, true, true);

            expect(output).toBe("VIEW: [empty]");
            expect(proot.father!.prettyNameLength).toBe(0);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();

            expect(output).toBe("VIEW: Friendly(Homer)");
            expect(proot.father!.prettyNameLength).toBe(15);

            proot.father!.firstName = "H";
            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();
            trax.log.info("A");
            expect(output).toBe("VIEW: Friendly(H)");
            expect(proot.father!.prettyNameLength).toBe(11);

            fstore.remove(proot.father!);
            proot.father!.firstName = "HOMER";
            expect(proot.father!.firstName).toBe("HOMER");

            await trax.reconciliation();
            expect(printLogs(6)).toMatchObject([
                "6:1 !LOG - A",
                "6:2 !GET - FStore/root.father -> '[TRAX FStore/Father]'",
                "6:3 !GET - FStore/Father.prettyNameLength -> 11",
                "6:4 !GET - FStore/root.father -> '[TRAX FStore/Father]'",
                "6:5 !DEL - FStore%Father[pn]",
                "6:6 !DEL - FStore%Father[pnLength]",
                "6:7 !DEL - FStore/Father",
                "6:8 !GET - FStore/root.father -> {\"firstName\":\"H\",\"lastName\":\"Simpson\",\"prettyNameLength\":11,\"prettyName\":\"Friendly(H)\"}",
                "6:9 !GET - FStore/root.father -> {\"firstName\":\"HOMER\",\"lastName\":\"Simpson\",\"prettyNameLength\":11,\"prettyName\":\"Friendly(H)\"}",
            ]);
        });
    });

    describe('Dispose', () => {
        it('should be called when maxComputeCount is reached', async () => {
            let lastId: string[] = [], lastCount: number[] = [];

            const pstore = trax.createStore("PStore", (store: Store<Person>,) => {
                const p = store.init({ firstName: "Homer", lastName: "Simpson" });

                store.compute("PrettyName", function* (cc) {
                    cc.maxComputeCount = 2;
                    lastId.push(cc.processorId);
                    lastCount.push(cc.computeCount);
                    const ffn: string = yield getFriendlyName(p.firstName);
                    let nm = ffn + " " + p.lastName;
                    lastId.push(cc.processorId);
                    lastCount.push(cc.computeCount);
                    p.prettyName = nm;
                    p.prettyNameLength = nm.length;
                });
            });

            const processorId = "PStore%PrettyName";
            const p = pstore.data;
            const pr = pstore.getProcessor("PrettyName")!;
            expect(lastId).toMatchObject([processorId]);
            expect(pr.id).toBe(processorId);
            expect(pr.computeCount).toBe(1);
            expect(pr.disposed).toBe(false);
            expect(p.prettyName).toBe(undefined);
            expect(pstore.getProcessor("PrettyName")).toBe(pr);
            expect(trax.getProcessor(processorId)).toBe(pr);
            expect(lastCount).toMatchObject([1]);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME)
            await trax.reconciliation();
            expect(pr.computeCount).toBe(1);
            expect(pr.disposed).toBe(false);
            expect(p.prettyName).toBe("Friendly(Homer) Simpson");
            expect(pstore.getProcessor("PrettyName")).toBe(pr);
            expect(trax.getProcessor(processorId)).toBe(pr);
            expect(lastId).toMatchObject([processorId, processorId]);
            expect(lastCount).toMatchObject([1, 1]);


            pstore.data.firstName = "HOMER";

            await trax.reconciliation();
            expect(lastId).toMatchObject([processorId, processorId, processorId]);
            expect(lastCount).toMatchObject([1, 1, 2]);
            expect(pr.disposed).toBe(false);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME)
            await trax.reconciliation();
            expect(pr.computeCount).toBe(2);
            expect(lastId).toMatchObject([processorId, processorId, processorId, processorId]);
            expect(lastCount).toMatchObject([1, 1, 2, 2]);
            expect(pr.disposed).toBe(true);
            expect(p.prettyName).toBe("Friendly(HOMER) Simpson");
            expect(trax.getProcessor(processorId)).toBe(undefined);


            pstore.data.firstName = "MARGE";

            await trax.reconciliation();
            expect(pr.disposed).toBe(true);
            expect(pr.computeCount).toBe(2);
            expect(lastId).toMatchObject([processorId, processorId, processorId, processorId]);
            expect(lastCount).toMatchObject([1, 1, 2, 2]);
            expect(pr.disposed).toBe(true);
            expect(p.prettyName).toBe("Friendly(HOMER) Simpson");
            expect(trax.getProcessor(processorId)).toBe(undefined);
        });

        it('should be called when maxComputeCount is reached - store.init/store.add', async () => {
            let lastIds: string[] = [], lastCounts: number[] = [];

            const pstore = trax.createStore("PStore", (store: Store<Person>,) => {
                store.init({
                    firstName: "Homer",
                    lastName: "Simpson"
                }, {
                    prettyNames: function* (p, cc) {
                        cc.maxComputeCount = 2;
                        lastIds.push(cc.processorId);
                        lastCounts.push(cc.computeCount);
                        const ffn: string = yield getFriendlyName(p.firstName);
                        let nm = ffn + " " + p.lastName;
                        lastIds.push(cc.processorId);
                        lastCounts.push(cc.computeCount);
                        p.prettyName = nm;
                        p.prettyNameLength = nm.length;
                    }
                });
            });

            const processorId = "PStore%root[prettyNames]";
            const p = pstore.data;
            const pr = pstore.getProcessor("root[prettyNames]")!;
            expect(lastIds).toMatchObject([]); // lazy
            expect(pr.id).toBe(processorId);
            expect(pr.computeCount).toBe(0); // lazy
            expect(pr.disposed).toBe(false);
            expect(lastCounts).toMatchObject([]); // lazy
            expect(p.prettyName).toBe(undefined); // triggers the processor
            expect(pstore.getProcessor("root[prettyNames]")).toBe(pr);
            expect(trax.getProcessor(processorId)).toBe(pr);
            expect(lastCounts).toMatchObject([1]);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME)
            await trax.reconciliation();
            expect(pr.computeCount).toBe(1);
            expect(pr.disposed).toBe(false);
            expect(p.prettyName).toBe("Friendly(Homer) Simpson");
            expect(trax.getProcessor(processorId)).toBe(pr);
            expect(lastIds).toMatchObject([processorId, processorId]);
            expect(lastCounts).toMatchObject([1, 1]);

            pstore.data.firstName = "HOMER";
            await trax.reconciliation();

            // Before lazy read
            expect(lastIds).toMatchObject([processorId, processorId]);
            expect(lastCounts).toMatchObject([1, 1]);

            expect(pr.disposed).toBe(false);
            expect(p.prettyName).toBe("Friendly(Homer) Simpson");
            // After lazy read
            expect(lastIds).toMatchObject([processorId, processorId, processorId]);
            expect(lastCounts).toMatchObject([1, 1, 2]);
            expect(pr.disposed).toBe(false);

            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME)
            await trax.reconciliation();
            expect(pr.computeCount).toBe(2);
            expect(lastIds).toMatchObject([processorId, processorId, processorId, processorId]);
            expect(lastCounts).toMatchObject([1, 1, 2, 2]);
            expect(pr.disposed).toBe(true);
            expect(p.prettyName).toBe("Friendly(HOMER) Simpson");
            expect(trax.getProcessor(processorId)).toBe(undefined);

            pstore.data.firstName = "MARGE";

            await trax.reconciliation();
            expect(pr.disposed).toBe(true);
            expect(pr.computeCount).toBe(2);
            expect(lastIds).toMatchObject([processorId, processorId, processorId, processorId]);
            expect(lastCounts).toMatchObject([1, 1, 2, 2]);
            expect(pr.disposed).toBe(true);
            expect(p.prettyName).toBe("Friendly(HOMER) Simpson");
            expect(trax.getProcessor(processorId)).toBe(undefined);
        });
    });

    describe('Errors', () => {
        it('should raise an error in case of compute error before yield', async () => {
            const ps = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    throw Error("Error 1");
                });
            });
            const pr = ps.getProcessor("PrettyName")!;

            expect(ps.data.prettyName).toBe(undefined);
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !ERR - [TRAX] (PStore%PrettyName) Compute error: Error: Error 1",
                "0:7 !PCE - 0:5",
                "0:8 !ERR - [TRAX] (PStore%PrettyName) No dependencies found: processor will never be re-executed",
                "0:9 !PCE - 0:1",
                "0:10 !GET - PStore/root.prettyName -> undefined",
            ]);

            expect(pr.dependencies).toMatchObject([]);
        });

        it('should raise an error in case of compute error during yield', async () => {
            const ps = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    p.prettyName = yield getFriendlyName(p.firstName, true);
                    trax.log.event("Done");
                });
            });
            const pr = ps.getProcessor("PrettyName")!;

            expect(ps.data.prettyName).toBe(undefined);
            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5",
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.prettyName -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !ERR - [TRAX] (PStore%PrettyName) Compute error: Error: Friendly Name Error",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
        });

        it('should raise an error in case of compute error after yield', async () => {
            const ps = trax.createStore("PStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Bart", lastName: "Simpson" });

                store.compute("PrettyName", function* () {
                    p.prettyName = yield getFriendlyName(p.firstName);
                    throw Error("Error 2");
                });
            });
            const pr = ps.getProcessor("PrettyName")!;

            expect(ps.data.prettyName).toBe(undefined);
            await trax.log.awaitEvent(EVT_GET_FRIENDLY_NAME);
            await trax.reconciliation();
            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - !StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore%PrettyName",
                "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Bart'",
                "0:7 !PCP - 0:5",
                "0:8 !PCE - 0:1",
                "0:9 !GET - PStore/root.prettyName -> undefined",
                "1:1 GetFriendlyName - NO-DATA",
                "2:1 !PCR - 0:5",
                "2:2 !SET - PStore/root.prettyName = 'Friendly(Bart)' (prev: undefined)",
                "2:3 !ERR - [TRAX] (PStore%PrettyName) Compute error: Error: Error 2",
                "2:4 !PCE - 0:5",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
            ]);
        });
    });
});
