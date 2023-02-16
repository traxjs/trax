import { beforeEach, describe, expect, it } from 'vitest';
import { Store, Trax, TraxObjectType, trax as trx } from '../index';
import { createTraxEnv } from '../core';
import { pause, Person, printEvents, SimpleFamilyStore } from './utils';

describe('Trax Core', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    describe('Basics', () => {
        it('should support cycleComplete', async () => {
            expect(trax.pendingChanges).toBe(false);
            trax.log.info("A");
            expect(trax.pendingChanges).toBe(false);
            await trax.reconciliation();
            expect(trax.pendingChanges).toBe(false);

            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !CC - 0',
            ]);

            // no changes
            await trax.reconciliation();
            expect(trax.pendingChanges).toBe(false);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !CC - 0',
            ]);

            trax.log.info("B");
            await trax.reconciliation();
            expect(trax.pendingChanges).toBe(false);
            expect(printLogs(0, false)).toMatchObject([
                '0:0 !CS - 0',
                '0:1 !LOG - A',
                '0:2 !CC - 0',
                '1:0 !CS - 0',
                '1:1 !LOG - B',
                '1:2 !CC - 0',
            ]);

        });

        it('should discard non trax objects', async () => {
            expect(trax.isTraxObject(undefined)).toBe(false);
            expect(trax.isTraxObject(42)).toBe(false);
            expect(trax.isTraxObject({})).toBe(false);
            expect(trax.isTraxObject(true)).toBe(false);

            expect(trax.getTraxId(undefined)).toBe("");
            expect(trax.getTraxId(42)).toBe("");
            expect(trax.getTraxId({})).toBe("");
            expect(trax.getTraxId(true)).toBe("");

            expect(trax.getTraxObjectType(undefined)).toBe(TraxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType(42)).toBe(TraxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType({})).toBe(TraxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType(true)).toBe(TraxObjectType.NotATraxObject);
        });
    });

    describe('Stores', () => {
        it('should be created wih a unique id', async () => {
            const initFn = (store: Store<any>) => {
                const root = store.init({ msg: "Hello" });
                return {
                    msg: root
                }
            }
            const s1 = trax.createStore("MyStore", initFn);
            expect(s1.id).toBe("MyStore");
            expect(trax.getTraxId(s1)).toBe(""); // the store wrapper is not a trax object
            const s2 = trax.createStore("MyStore", initFn);
            expect(s2.id).toBe("MyStore1");
            const s3 = trax.createStore("MyStore", initFn);
            expect(s3.id).toBe("MyStore2");

            s1.dispose();
            s2.dispose();
            s3.dispose();

            const s4 = trax.createStore("MyStore", initFn);
            expect(s4.id).toBe("MyStore"); // no need for suffix
            const s5 = trax.createStore("MyStore", initFn);
            expect(s5.id).toBe("MyStore1");

            s4.dispose();
            const s6 = trax.createStore("MyStore", initFn);
            expect(s6.id).toBe("MyStore"); // MyStore can be reused

            const s7 = trax.createStore(["MyStore", "A", 42], initFn);
            expect(s7.id).toBe("MyStore:A:42"); // id from array
        });

        it('should support creation with no init function', async () => {
            const ps = trax.createStore("PStore", {
                firstName: "Homer",
                lastName: "Simpson"
            });
            expect(ps.root.firstName).toBe("Homer");
        });

        it('should be able to define a custom dispose behaviour', async () => {
            let traces = "";
            const initFn = (store: Store<any>) => {
                const root = store.init({ msg: "Hello" });
                return {
                    msg: root,
                    dispose() {
                        traces += store.id + ";";
                    }
                }
            }
            const s1 = trax.createStore("MyStore", initFn);
            expect(s1.id).toBe("MyStore");
            const s2 = trax.createStore("MyStore", initFn);
            expect(s2.id).toBe("MyStore1");
            s1.dispose();
            expect(traces).toBe("MyStore;")
            s2.dispose();
            expect(traces).toBe("MyStore;MyStore1;")
            const s3 = trax.createStore("MyStore", initFn);
            expect(s3.id).toBe("MyStore");
            s3.dispose();
            expect(traces).toBe("MyStore;MyStore1;MyStore;")
        });

        it('should be identified as trax objects', async () => {
            const st = trax.createStore("MyStore", (store: Store<any>) => {
                store.init({ msg: "Hello" });
            });
            expect(trax.isTraxObject(st)).toBe(true);
        });

        it('should support init functions that don\'t return any object', async () => {
            const st = trax.createStore("MyStore", (store: Store<any>) => {
                store.init({ msg: "Hello" });
            });
            expect(st.id).toBe("MyStore");
            expect(typeof st.add).toBe("function");
            expect(trax.isTraxObject(st)).toBe(true);
            expect(trax.getTraxId(st)).toBe("MyStore");
        });

        it('should properly dispose all sub-objects', async () => {
            const ps = trax.createStore("PStore", {
                firstName: "Homer",
                lastName: "Simpson"
            });
            const o1 = ps.add("O1", { value: "o1" });
            const o2 = ps.add("O2", { value: "o2" });
            const rootId = trax.getTraxId(ps.root);
            const id1 = trax.getTraxId(o1);
            const id2 = trax.getTraxId(o2);
            expect(trax.getData(rootId)).toBe(ps.root);
            expect(trax.getData(id1)).toBe(o1);
            expect(trax.getData(id2)).toBe(o2);

            ps.dispose();
            expect(trax.getData(rootId)).toBe(undefined);
            expect(trax.getData(id1)).toBe(undefined);
            expect(trax.getData(id2)).toBe(undefined);
        });

        describe('Sub Stores', () => {

            it('should support create / dispose', async () => {
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson"
                });

                const pss = ps.createStore("SubStore", (store: Store<{ msg: string }>) => {
                    const root = store.init({ msg: "" });

                    store.compute("Msg", () => {
                        root.msg = ps.root.firstName + "!";
                    });
                });
                const data = pss.root;

                const pssId = pss.id;
                expect(pssId).toBe("PStore>SubStore");
                expect(trax.getTraxId(pss)).toBe("PStore>SubStore");

                expect(pss.disposed).toBe(false);

                expect(data.msg).toBe("Homer!");

                await trax.reconciliation();
                ps.root.firstName = "Bart";
                await trax.reconciliation();
                expect(data.msg).toBe("Bart!");

                expect(trax.getStore(pssId)).toBe(pss);
                expect(pss.dispose()).toBe(true);
                expect(trax.getStore(pssId)).toBe(undefined);
                expect(pss.dispose()).toBe(false); // already disposed

                await trax.reconciliation();
                ps.root.firstName = "Lisa";
                await trax.reconciliation();
                expect(data.msg).toBe("Bart!"); // no changes
            });

            it('should be disposed when parent is disposed', async () => {
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson"
                });

                const pss = ps.createStore("SubStore", (store: Store<{ msg: string }>) => {
                    const root = store.init({ msg: "" });

                    store.compute("Msg", () => {
                        root.msg = ps.root.firstName + "!";
                    });
                });
                const data1 = ps.root;
                const data1Id = trax.getTraxId(data1);
                expect(data1Id).toBe("PStore/root");

                const data2 = pss.root;
                const data2Id = trax.getTraxId(data2);
                expect(data1Id).toBe("PStore/root");
                expect(data2Id).toBe("PStore>SubStore/root");
                expect(trax.getData(data1Id)).toBe(data1);
                expect(trax.getData(data2Id)).toBe(data2);

                const psId = ps.id;
                const pssId = pss.id;
                const pr = pss.getProcessor("Msg")!;
                expect(pr.id).toBe("PStore>SubStore%Msg");
                expect(pr.disposed).toBe(false);

                expect(trax.getStore(psId)).toBe(ps);
                expect(trax.getStore(pssId)).toBe(pss);

                ps.dispose();
                expect(trax.getStore(psId)).toBe(undefined);
                expect(trax.getStore(pssId)).toBe(undefined);
                expect(trax.getData(data1Id)).toBe(undefined);
                expect(trax.getData(data2Id)).toBe(undefined);
                expect(ps.disposed).toBe(true);
                expect(pss.disposed).toBe(true);
                expect(pr.disposed).toBe(true);
            });

            it('should support substores in substores', async () => {
                let output = "";
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson"
                });

                const pss = ps.createStore("SubStore", (store: Store<{ msg: string }>) => {
                    const root = store.init({ msg: "" });

                    store.compute("Msg", () => {
                        root.msg = ps.root.firstName + "!";
                    });

                    store.createStore("SubSubStore", (sst: Store<{ info: string }>) => {
                        const root2 = sst.init({ info: "" });

                        sst.compute("Info", () => {
                            output = root2.info = "<" + root.msg + ">";
                        });
                    })
                });

                expect(output).toBe("<Homer!>");

                await trax.reconciliation();
                ps.root.firstName = "Bart";

                await trax.reconciliation();
                expect(output).toBe("<Bart!>");

                const sst = pss.getStore("SubSubStore")!;
                expect(sst.id).toBe("PStore>SubStore>SubSubStore");
                expect(sst.disposed).toBe(false);
                expect(trax.getStore("PStore>SubStore>SubSubStore")).toBe(sst);

                sst.dispose();
                expect(sst.disposed).toBe(true);
                expect(trax.getStore("PStore>SubStore>SubSubStore")).toBe(undefined);
                expect(pss.getStore("SubSubStore")).toBe(undefined);

                await trax.reconciliation();
                ps.root.firstName = "Lisa";

                await trax.reconciliation();
                expect(output).toBe("<Bart!>"); // unchanged

                expect(pss.root.msg).toBe("Lisa!"); // not disposed
            });
        });

        describe('Wrappers', () => {
            function createPStore(throwError = false) {
                return trax.createStore("PStore", (store: Store<Person>) => {
                    const root = store.init({ firstName: "Homer", lastName: "Simpson" });

                    store.compute("PrettyName", () => {
                        root.prettyName = root.firstName + " " + root.lastName;
                    });

                    return {
                        person: root,
                        updateNameSync(value1: string, value2: string) {
                            root.firstName += value1;
                            if (throwError) {
                                throw "Something bad happened";
                            }
                            const r = root.lastName + value2 + value2;
                            root.lastName = r;
                            return r;
                        },
                        async updateNameAsync(value1: string, value2: string) {
                            root.firstName += value1;
                            await pause(1);
                            trax.log.event("@traxjs/trax/test/updateNameAsyncDone");
                            if (throwError) {
                                throw "Something bad happened";
                            }
                            root.lastName += value2 + value2;
                        },
                        updateNameAsync2: store.async(function* (value1: string, value2: string) {
                            root.firstName += value1;
                            yield pause(1);
                            trax.log.event("@traxjs/trax/test/updateNameAsync2Done");
                            if (throwError) {
                                throw "Something bad happened";
                            }
                            const r = root.lastName + value2 + value2;
                            root.lastName = r;
                            return r;
                        })
                    }
                });
            }

            it('should wrap sync functions and log calls', async () => {
                const ps = createPStore();
                expect(ps.person.firstName).toBe("Homer");

                await trax.reconciliation();
                trax.log.info("A")
                const r = ps.updateNameSync("A", "B");
                expect(r).toBe("SimpsonBB");
                trax.processChanges();
                expect(ps.person.prettyName).toBe("HomerA SimpsonBB");

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !PCS - PStore.updateNameSync()",
                    "1:3 !GET - PStore/root.firstName -> 'Homer'",
                    "1:4 !SET - PStore/root.firstName = 'HomerA' (prev: 'Homer')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.firstName",
                    "1:6 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:7 !SET - PStore/root.lastName = 'SimpsonBB' (prev: 'Simpson')",
                    "1:8 !PCE - 1:2",
                    "1:9 !PCS - !Reconciliation #1 - 1 processor",
                    "1:10 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:9",
                    "1:11 !GET - PStore/root.firstName -> 'HomerA'",
                    "1:12 !GET - PStore/root.lastName -> 'SimpsonBB'",
                    "1:13 !SET - PStore/root.prettyName = 'HomerA SimpsonBB' (prev: 'Homer Simpson')",
                    "1:14 !PCE - 1:10",
                    "1:15 !PCE - 1:9",
                    "1:16 !GET - PStore/root.prettyName -> 'HomerA SimpsonBB'",
                ]);
            });

            it('should log errors on sync function calls', async () => {
                const ps = createPStore(true);
                expect(ps.person.firstName).toBe("Homer");

                await trax.reconciliation();
                trax.log.info("A")
                ps.updateNameSync("A", "B");
                trax.processChanges();
                expect(ps.person.prettyName).toBe("HomerA Simpson"); // half processed

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !PCS - PStore.updateNameSync()",
                    "1:3 !GET - PStore/root.firstName -> 'Homer'",
                    "1:4 !SET - PStore/root.firstName = 'HomerA' (prev: 'Homer')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.firstName",
                    "1:6 !ERR - [TRAX] (PStore.updateNameSync) error: Something bad happened",
                    "1:7 !PCE - 1:2",
                    "1:8 !PCS - !Reconciliation #1 - 1 processor",
                    "1:9 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:8",
                    "1:10 !GET - PStore/root.firstName -> 'HomerA'",
                    "1:11 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:12 !SET - PStore/root.prettyName = 'HomerA Simpson' (prev: 'Homer Simpson')",
                    "1:13 !PCE - 1:9",
                    "1:14 !PCE - 1:8",
                    "1:15 !GET - PStore/root.prettyName -> 'HomerA Simpson'",
                ]);


            });

            it('should wrap async functions and log calls', async () => {
                const ps = createPStore();
                expect(ps.person.firstName).toBe("Homer");

                await trax.reconciliation();
                trax.log.info("A")
                ps.updateNameAsync("A", "B");
                await trax.log.awaitEvent("@traxjs/trax/test/updateNameAsyncDone");
                await trax.reconciliation();
                expect(ps.person.prettyName).toBe("HomerA SimpsonBB");

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !PCS - PStore.updateNameAsync()",
                    "1:3 !GET - PStore/root.firstName -> 'Homer'",
                    "1:4 !SET - PStore/root.firstName = 'HomerA' (prev: 'Homer')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.firstName",
                    "1:6 !PCE - 1:2",
                    "1:7 !PCS - !Reconciliation #1 - 1 processor",
                    "1:8 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:7",
                    "1:9 !GET - PStore/root.firstName -> 'HomerA'",
                    "1:10 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:11 !SET - PStore/root.prettyName = 'HomerA Simpson' (prev: 'Homer Simpson')",
                    "1:12 !PCE - 1:8",
                    "1:13 !PCE - 1:7",
                    "2:1 @traxjs/trax/test/updateNameAsyncDone - NO-DATA",
                    "2:2 !GET - PStore/root.lastName -> 'Simpson'",
                    "2:3 !SET - PStore/root.lastName = 'SimpsonBB' (prev: 'Simpson')",
                    "2:4 !DRT - PStore%PrettyName <- PStore/root.lastName",
                    "2:5 !PCS - !Reconciliation #2 - 1 processor",
                    "2:6 !PCS - !Compute #3 (PStore%PrettyName) P1 Reconciliation - parentId=2:5",
                    "2:7 !GET - PStore/root.firstName -> 'HomerA'",
                    "2:8 !GET - PStore/root.lastName -> 'SimpsonBB'",
                    "2:9 !SET - PStore/root.prettyName = 'HomerA SimpsonBB' (prev: 'HomerA Simpson')",
                    "2:10 !PCE - 2:6",
                    "2:11 !PCE - 2:5",
                    "3:1 !GET - PStore/root.prettyName -> 'HomerA SimpsonBB'",
                ]);
            });

            it('should log errors on async function calls', async () => {
                const ps = createPStore(true);
                expect(ps.person.firstName).toBe("Homer");

                await trax.reconciliation();
                trax.log.info("A")
                ps.updateNameAsync("A", "B");
                await trax.log.awaitEvent("@traxjs/trax/test/updateNameAsyncDone");
                await trax.reconciliation();
                expect(ps.person.prettyName).toBe("HomerA Simpson"); // half processed


                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !PCS - PStore.updateNameAsync()",
                    "1:3 !GET - PStore/root.firstName -> 'Homer'",
                    "1:4 !SET - PStore/root.firstName = 'HomerA' (prev: 'Homer')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.firstName",
                    "1:6 !PCE - 1:2",
                    "1:7 !PCS - !Reconciliation #1 - 1 processor",
                    "1:8 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:7",
                    "1:9 !GET - PStore/root.firstName -> 'HomerA'",
                    "1:10 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:11 !SET - PStore/root.prettyName = 'HomerA Simpson' (prev: 'Homer Simpson')",
                    "1:12 !PCE - 1:8",
                    "1:13 !PCE - 1:7",
                    "2:1 @traxjs/trax/test/updateNameAsyncDone - NO-DATA",
                    "3:1 !ERR - [TRAX] (PStore.updateNameAsync) error: Something bad happened",
                    "4:1 !GET - PStore/root.prettyName -> 'HomerA Simpson'",
                ]);
            });

            it('should wrap generator functions and return async functions', async () => {
                const ps = createPStore();
                expect(ps.person.firstName).toBe("Homer");

                await trax.reconciliation();
                trax.log.info("A")
                const r = await ps.updateNameAsync2("A", "B");

                expect(r).toBe("SimpsonBB");
                expect(ps.person.prettyName).toBe("HomerA SimpsonBB");

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !PCS - PStore.updateNameAsync2()",
                    "1:3 !GET - PStore/root.firstName -> 'Homer'",
                    "1:4 !SET - PStore/root.firstName = 'HomerA' (prev: 'Homer')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.firstName",
                    "1:6 !PCP - 1:2",
                    "1:7 !PCS - !Reconciliation #1 - 1 processor",
                    "1:8 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:7",
                    "1:9 !GET - PStore/root.firstName -> 'HomerA'",
                    "1:10 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:11 !SET - PStore/root.prettyName = 'HomerA Simpson' (prev: 'Homer Simpson')",
                    "1:12 !PCE - 1:8",
                    "1:13 !PCE - 1:7",
                    "2:1 !PCR - 1:2",
                    "2:2 @traxjs/trax/test/updateNameAsync2Done - NO-DATA",
                    "2:3 !GET - PStore/root.lastName -> 'Simpson'",
                    "2:4 !SET - PStore/root.lastName = 'SimpsonBB' (prev: 'Simpson')",
                    "2:5 !DRT - PStore%PrettyName <- PStore/root.lastName",
                    "2:6 !PCE - 1:2",
                    "2:7 !PCS - !Reconciliation #2 - 1 processor",
                    "2:8 !PCS - !Compute #3 (PStore%PrettyName) P1 Reconciliation - parentId=2:7",
                    "2:9 !GET - PStore/root.firstName -> 'HomerA'",
                    "2:10 !GET - PStore/root.lastName -> 'SimpsonBB'",
                    "2:11 !SET - PStore/root.prettyName = 'HomerA SimpsonBB' (prev: 'HomerA Simpson')",
                    "2:12 !PCE - 2:8",
                    "2:13 !PCE - 2:7",
                    "3:1 !GET - PStore/root.prettyName -> 'HomerA SimpsonBB'",
                ]);
            });

            it('should provide means to support async init', async () => {
                const ps = trax.createStore("PStore", (store: Store<Person>) => {
                    const root = store.init({ firstName: "Homer", lastName: "Simpson" });

                    store.compute("PrettyName", () => {
                        root.prettyName = root.firstName + " " + root.lastName;
                    });

                    let initialized = false;

                    store.async("Init", function* () {
                        // allows to perform asyn operation to initialize the store
                        // e.g. call a server / read from local storage / etc.
                        yield pause(1);
                        initialized = true;
                        root.avatar = "AVATAR";
                        root.lastName += "!"; // will trigger PrettyName update
                        trax.log.event("@traxjs/trax/test/core/asyncInitDone");
                    })();

                    return {
                        person: root,
                        get initialized() {
                            return initialized;
                        },
                        updateNameSync(value1: string, value2: string) {
                            root.firstName += value1;
                            const r = root.lastName + value2 + value2;
                            root.lastName = r;
                            return r;
                        }
                    }
                });
                expect(ps.person.prettyName).toBe("Homer Simpson");
                expect(ps.person.avatar).toBe(undefined);
                expect(ps.initialized).toBe(false);

                await trax.log.awaitEvent("@traxjs/trax/test/core/asyncInitDone");
                await trax.reconciliation();
                expect(ps.person.prettyName).toBe("Homer Simpson!");
                expect(ps.person.avatar).toBe("AVATAR");
                expect(ps.initialized).toBe(true);

                expect(printLogs(0)).toMatchObject([
                    "0:1 !PCS - !StoreInit (PStore)",
                    "0:2 !NEW - S: PStore",
                    "0:3 !NEW - O: PStore/root",
                    "0:4 !NEW - P: PStore%PrettyName",
                    "0:5 !PCS - !Compute #1 (PStore%PrettyName) P1 Init - parentId=0:1",
                    "0:6 !GET - PStore/root.firstName -> 'Homer'",
                    "0:7 !GET - PStore/root.lastName -> 'Simpson'",
                    "0:8 !SET - PStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                    "0:9 !PCE - 0:5",
                    "0:10 !PCS - PStore.Init() - parentId=0:1",
                    "0:11 !PCP - 0:10",
                    "0:12 !PCE - 0:1",
                    "0:13 !GET - PStore/root.prettyName -> 'Homer Simpson'",
                    "0:14 !GET - PStore/root.avatar -> undefined",
                    "1:1 !PCR - 0:10",
                    "1:2 !SET - PStore/root.avatar = 'AVATAR' (prev: undefined)",
                    "1:3 !GET - PStore/root.lastName -> 'Simpson'",
                    "1:4 !SET - PStore/root.lastName = 'Simpson!' (prev: 'Simpson')",
                    "1:5 !DRT - PStore%PrettyName <- PStore/root.lastName",
                    "1:6 @traxjs/trax/test/core/asyncInitDone - NO-DATA",
                    "1:7 !PCE - 0:10",
                    "1:8 !PCS - !Reconciliation #1 - 1 processor",
                    "1:9 !PCS - !Compute #2 (PStore%PrettyName) P1 Reconciliation - parentId=1:8",
                    "1:10 !GET - PStore/root.firstName -> 'Homer'",
                    "1:11 !GET - PStore/root.lastName -> 'Simpson!'",
                    "1:12 !SET - PStore/root.prettyName = 'Homer Simpson!' (prev: 'Homer Simpson')",
                    "1:13 !PCE - 1:9",
                    "1:14 !PCE - 1:8",
                    "2:1 !GET - PStore/root.prettyName -> 'Homer Simpson!'",
                    "2:2 !GET - PStore/root.avatar -> 'AVATAR'",
                ]);
            });
        });

        describe('Errors', () => {

            it('must be raised when init is not called during the store initialization', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.add("foo", { msg: "Hello" });
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/foo',
                    '0:4 !ERR - [TRAX] (MyStore) createStore init must define a root object - see also: init()',
                    '0:5 !NEW - O: MyStore/root',
                    '0:6 !PCE - 0:1',
                ]);
            });

            it('must be raised if we try to remove the root object', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello Ford" });
                });
                st.remove(st.root);
                expect(trax.isTraxObject(st.root)).toBe(true);
                expect(printLogs()).toMatchObject([
                    "0:1 !PCS - !StoreInit (MyStore)",
                    "0:2 !NEW - S: MyStore",
                    "0:3 !NEW - O: MyStore/root",
                    "0:4 !PCE - 0:1",
                    "0:5 !ERR - [TRAX] (MyStore/root) Root objects cannot be disposed through store.remove()",
                ]);
            });

            it('must be raised when init is called outside the init function', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !PCE - 0:1',
                ]);
                st.init({ msg: "abc" });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !PCE - 0:1',
                    '0:5 !ERR - [TRAX] (MyStore) Store.init can only be called during the store init phase',
                ]);
            });

            it('must be raised when init functions dont return an object', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                    return 42;
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !ERR - [TRAX] createStore init function must return a valid object (MyStore)',
                    '0:5 !PCE - 0:1',
                ]);
            });

            it('must be raised when init function throws an error', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                    throw Error("Unexpected error");
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !ERR - [TRAX] createStore init error (MyStore): Error: Unexpected error',
                    '0:5 !PCE - 0:1',
                ]);
            });

            it('must be raised when the store dispose throws an error', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                    return {
                        dispose() {
                            throw Error("Unexpected dispose error");
                        }
                    }
                });
                st.dispose();
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !PCE - 0:1',
                    "0:5 !PCS - MyStore.dispose()",
                    "0:6 !ERR - [TRAX] (MyStore.dispose) error: Error: Unexpected dispose error",
                    "0:7 !PCE - 0:5",
                    "0:8 !DEL - MyStore/root",
                    "0:9 !DEL - MyStore",
                ]);
            });

            it('must be raised if store id is provided by the init function', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                    return {
                        id: "abcd"
                    }
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !ERR - [TRAX] Store id will be overridden and must not be provided by init function (MyStore)',
                    '0:5 !PCE - 0:1'
                ]);
            });

            it('must be raised in case of invalid id', async () => {
                const st = trax.createStore("My/Store/ABC", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                });
                expect(st.id).toBe("MyStoreABC");
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - [TRAX] Invalid trax id: My/Store/ABC (changed into MyStoreABC)',
                    '0:2 !PCS - !StoreInit (MyStoreABC)',
                    "0:3 !NEW - S: MyStoreABC",
                    '0:4 !NEW - O: MyStoreABC/root',
                    '0:5 !PCE - 0:2'
                ]);

                await trax.reconciliation();
                st.add("AB>CD", { foo: "bar" });
                expect(printLogs(1)).toMatchObject([
                    "1:1 !ERR - [TRAX] Invalid trax id: AB>CD (changed into ABCD)",
                    "1:2 !NEW - O: MyStoreABC/ABCD",
                ]);

                await trax.reconciliation();
                st.add("AB%C%D", { foo: "bar" });
                expect(printLogs(2)).toMatchObject([
                    "2:1 !ERR - [TRAX] Invalid trax id: AB%C%D (changed into ABCD)",
                ]);
            });

            it('must be raised in case of invalid add parameter', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                    store.add("abc", 42);
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - !StoreInit (MyStore)',
                    "0:2 !NEW - S: MyStore",
                    '0:3 !NEW - O: MyStore/root',
                    '0:4 !ERR - [TRAX] (MyStore) Store.add(abc): Invalid init object parameter: [number]',
                    '0:5 !NEW - O: MyStore/abc',
                    '0:6 !PCE - 0:1'
                ]);
            });

            it('must be raised if "root" is used as an id for a new object', async () => {
                const st = trax.createStore("MyStore", (store: Store<any>) => {
                    store.init({ msg: "Hello" });
                });
                const o = st.add("root", { msg: "abc" });
                const id = trax.getTraxId(o); // e.g. MyStore/87524
                expect(id.match(/^MyStore\/\d+$/)).not.toBe(null);

                expect(printLogs()).toMatchObject([
                    "0:1 !PCS - !StoreInit (MyStore)",
                    "0:2 !NEW - S: MyStore",
                    "0:3 !NEW - O: MyStore/root",
                    "0:4 !PCE - 0:1",
                    "0:5 !ERR - [TRAX] Store.add: Invalid id 'root' (reserved)",
                    "0:6 !NEW - O: " + id,
                ]);
            });

            it('must be raised if stores are used after being disposed', async () => {
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson"
                });

                await trax.reconciliation();
                ps.dispose();
                const o = ps.add("Foo", { bar: 123 });

                expect(printLogs(1)).toMatchObject([
                    "1:1 !DEL - PStore/root",
                    "1:2 !DEL - PStore",
                    "1:3 !ERR - [TRAX] (PStore) Stores cannot be used after being disposed",
                ]);
            });

            it('must be raise if delete is called for SubStores', async () => {
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson"
                });

                const pss = ps.createStore("SubStore", (store: Store<{ msg: string }>) => {
                    const root = store.init({ msg: "" });

                    store.compute("Msg", () => {
                        root.msg = ps.root.firstName + "!";
                    });
                });

                await trax.reconciliation();
                ps.remove(pss);

                expect(printLogs(1)).toMatchObject([
                    "1:1 !ERR - [TRAX] (PStore>SubStore) Stores cannot be disposed through store.remove()",
                ]);
            });

            it('must be raise if delete is called for Processors', async () => {
                const ps = trax.createStore("PStore", {
                    firstName: "Homer",
                    lastName: "Simpson",
                    misc: ""
                });

                const pr = ps.compute("Misc", () => {
                    const root = ps.root;
                    root.misc = root.firstName + " " + root.lastName;
                })

                await trax.reconciliation();
                ps.remove(pr);

                expect(printLogs(1)).toMatchObject([
                    "1:1 !ERR - [TRAX] (PStore%Misc) Processors cannot be disposed through store.remove()",
                ]);
            });
        });
    });

    describe('Reconciliation', () => {
        it('should support manual trigger (sync)', async () => {
            const st = trax.createStore("MyStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Homer", lastName: "Simpson" });
                store.compute("PrettyName", () => {
                    const nm = p.firstName + " " + p.lastName;
                    p.prettyName = nm;
                    p.prettyNameLength = nm.length;
                });
            });

            trax.log.info("A");
            expect(trax.pendingChanges).toBe(false);
            trax.processChanges(); // no effect (no changes)
            trax.log.info("B");

            st.root.lastName = "SIMPSON";
            trax.log.info("C");
            expect(trax.pendingChanges).toBe(true);
            trax.processChanges();
            expect(trax.pendingChanges).toBe(false);
            trax.log.info("D");
            trax.processChanges(); // no effect (no changes)

            await trax.reconciliation();

            expect(printLogs(0, false)).toMatchObject([
                "0:0 !CS - 0",
                "0:1 !PCS - !StoreInit (MyStore)",
                "0:2 !NEW - S: MyStore",
                "0:3 !NEW - O: MyStore/root",
                "0:4 !NEW - P: MyStore%PrettyName",
                "0:5 !PCS - !Compute #1 (MyStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - MyStore/root.firstName -> 'Homer'",
                "0:7 !GET - MyStore/root.lastName -> 'Simpson'",
                "0:8 !SET - MyStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:9 !SET - MyStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:10 !PCE - 0:5",
                "0:11 !PCE - 0:1",
                "0:12 !LOG - A",
                "0:13 !LOG - B",
                "0:14 !SET - MyStore/root.lastName = 'SIMPSON' (prev: 'Simpson')",
                "0:15 !DRT - MyStore%PrettyName <- MyStore/root.lastName",
                "0:16 !LOG - C",
                "0:17 !PCS - !Reconciliation #1 - 1 processor",
                "0:18 !PCS - !Compute #2 (MyStore%PrettyName) P1 Reconciliation - parentId=0:17",
                "0:19 !GET - MyStore/root.firstName -> 'Homer'",
                "0:20 !GET - MyStore/root.lastName -> 'SIMPSON'",
                "0:21 !SET - MyStore/root.prettyName = 'Homer SIMPSON' (prev: 'Homer Simpson')",
                "0:22 !PCE - 0:18",
                "0:23 !PCE - 0:17",
                "0:24 !LOG - D",
                "0:25 !CC - 0",
            ]);

        });

        it('should support automatic trigger (async)', async () => {
            const st = trax.createStore("MyStore", (store: Store<Person>) => {
                const p = store.init({ firstName: "Homer", lastName: "Simpson" });
                store.compute("PrettyName", () => {
                    const nm = p.firstName + " " + p.lastName;
                    p.prettyName = nm;
                    p.prettyNameLength = nm.length;
                });
            });

            const p = st.root;

            trax.log.info("A");
            expect(trax.pendingChanges).toBe(false);
            p.lastName = "SIMPSON";
            expect(trax.pendingChanges).toBe(true);

            trax.log.info("B");
            await trax.reconciliation();
            trax.log.info("C");

            expect(trax.pendingChanges).toBe(false);
            p.firstName = "Bart";
            expect(trax.pendingChanges).toBe(true);
            p.lastName = "Simpson";

            await trax.reconciliation();
            expect(p.prettyName).toBe("Bart Simpson");


            expect(printLogs(0, false)).toMatchObject([
                "0:0 !CS - 0",
                "0:1 !PCS - !StoreInit (MyStore)",
                "0:2 !NEW - S: MyStore",
                "0:3 !NEW - O: MyStore/root",
                "0:4 !NEW - P: MyStore%PrettyName",
                "0:5 !PCS - !Compute #1 (MyStore%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - MyStore/root.firstName -> 'Homer'",
                "0:7 !GET - MyStore/root.lastName -> 'Simpson'",
                "0:8 !SET - MyStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:9 !SET - MyStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:10 !PCE - 0:5",
                "0:11 !PCE - 0:1",
                "0:12 !LOG - A",
                "0:13 !SET - MyStore/root.lastName = 'SIMPSON' (prev: 'Simpson')",
                "0:14 !DRT - MyStore%PrettyName <- MyStore/root.lastName",
                "0:15 !LOG - B",
                "0:16 !PCS - !Reconciliation #1 - 1 processor",
                "0:17 !PCS - !Compute #2 (MyStore%PrettyName) P1 Reconciliation - parentId=0:16",
                "0:18 !GET - MyStore/root.firstName -> 'Homer'",
                "0:19 !GET - MyStore/root.lastName -> 'SIMPSON'",
                "0:20 !SET - MyStore/root.prettyName = 'Homer SIMPSON' (prev: 'Homer Simpson')",
                "0:21 !PCE - 0:17",
                "0:22 !PCE - 0:16",
                "0:23 !CC - 0",
                "1:0 !CS - 0",
                "1:1 !LOG - C",
                "1:2 !SET - MyStore/root.firstName = 'Bart' (prev: 'Homer')",
                "1:3 !DRT - MyStore%PrettyName <- MyStore/root.firstName",
                "1:4 !SET - MyStore/root.lastName = 'Simpson' (prev: 'SIMPSON')",
                "1:5 !PCS - !Reconciliation #2 - 1 processor",
                "1:6 !PCS - !Compute #3 (MyStore%PrettyName) P1 Reconciliation - parentId=1:5",
                "1:7 !GET - MyStore/root.firstName -> 'Bart'",
                "1:8 !GET - MyStore/root.lastName -> 'Simpson'",
                "1:9 !SET - MyStore/root.prettyName = 'Bart Simpson' (prev: 'Homer SIMPSON')",
                "1:10 !SET - MyStore/root.prettyNameLength = 12 (prev: 13)",
                "1:11 !PCE - 1:6",
                "1:12 !PCE - 1:5",
                "1:13 !CC - 0",
                "2:0 !CS - 0",
                "2:1 !GET - MyStore/root.prettyName -> 'Bart Simpson'",
            ]);

        });
    });

    describe('Main trax', () => {
        it('should be accessible from index.ts', async () => {
            expect(typeof trx.createStore).toBe("function");
        });
    });
});
