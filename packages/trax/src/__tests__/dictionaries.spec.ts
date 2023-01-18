import { beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv } from '../core';
import { Store, Trax } from '../types';
import { DictFamilyStore, printEvents } from './utils';

describe('Dictionaries', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    describe('Primary', () => {

        function createFamilyStore(empty: boolean) {
            return trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                if (empty) {
                    store.init({
                        familyName: "Simpson",
                        members: {}
                    });
                } else {
                    store.init({
                        familyName: "Simpson",
                        members: {
                            m1: { firstName: "Homer", lastName: "Simpson" },
                            m2: { firstName: "Marge", lastName: "Simpson" }
                        }
                    });
                }
                let family = store.root;
                store.compute("Size", () => {
                    family.size = trax.getObjectKeys(family.members).length;
                });
                store.compute("Names", () => {
                    const members = family.members;
                    family.names = trax.getObjectKeys(members).map(id => members[id]?.firstName || "").join(", ");
                });
            });
        }

        it('should support creation as JSON + updates (empty)', async () => {
            const fs = createFamilyStore(true);
            const f = fs.root;
            const members = f.members;

            expect(f.size).toBe(0);
            expect(f.names).toBe("");

            await trax.reconciliation();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - S: FStore",
                "0:3 !NEW - O: FStore/root",
                "0:4 !NEW - P: FStore/%Size",
                "0:5 !PCS - Compute #1 (FStore/%Size) P1 Init - parentId=0:1",
                "0:6 !NEW - O: FStore/root*members",
                "0:7 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:8 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                "0:9 !SET - FStore/root.size = 0 (prev: undefined)",
                "0:10 !PCE - 0:5",
                "0:11 !NEW - P: FStore/%Names",
                "0:12 !PCS - Compute #1 (FStore/%Names) P2 Init - parentId=0:1",
                "0:13 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:14 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                "0:15 !SET - FStore/root.names = '' (prev: undefined)",
                "0:16 !PCE - 0:12",
                "0:17 !PCE - 0:1",
                "0:18 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:19 !GET - FStore/root.size -> 0",
                "0:20 !GET - FStore/root.names -> ''",
            ]);

            trax.log.info("Add item");
            members["m1"] = { firstName: "Homer", lastName: "Simpson" };
            expect(trax.getTraxId(members["m1"])).toBe("FStore/root*members*m1");

            await trax.reconciliation();
            expect(f.size).toBe(1);
            expect(f.names).toBe("Homer");

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - Add item",
                "1:2 !NEW - O: FStore/root*members*m1",
                "1:3 !SET - FStore/root*members.m1 = '[TRAX FStore/root*members*m1]' (prev: undefined)",
                "1:4 !DRT - FStore/%Size <- FStore/root*members.☆trax.dictionary.size☆",
                "1:5 !DRT - FStore/%Names <- FStore/root*members.☆trax.dictionary.size☆",
                "1:6 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "1:7 !PCS - Reconciliation #1 - 2 processors",
                "1:8 !PCS - Compute #2 (FStore/%Size) P1 Reconciliation - parentId=1:7",
                "1:9 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:10 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 1",
                "1:11 !SET - FStore/root.size = 1 (prev: 0)",
                "1:12 !PCE - 1:8",
                "1:13 !PCS - Compute #2 (FStore/%Names) P2 Reconciliation - parentId=1:7",
                "1:14 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:15 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 1",
                "1:16 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "1:17 !GET - FStore/root*members*m1.firstName -> 'Homer'",
                "1:18 !SET - FStore/root.names = 'Homer' (prev: '')",
                "1:19 !PCE - 1:13",
                "1:20 !PCE - 1:7",
                "2:1 !GET - FStore/root.size -> 1",
                "2:2 !GET - FStore/root.names -> 'Homer'",
            ]);

            await trax.reconciliation();
            trax.log.info("Set item undefined");
            (members as any)["m1"] = undefined;

            await trax.reconciliation();
            expect(f.names).toBe("");
            expect(f.size).toBe(1); // because m1 is still a property

            await trax.reconciliation();
            trax.log.info("Delete item");
            delete members["m1"];

            await trax.reconciliation();
            expect(f.names).toBe("");
            expect(f.size).toBe(0);

            expect(printLogs(5)).toMatchObject([
                "5:1 !LOG - Delete item",
                "5:2 !DRT - FStore/%Size <- FStore/root*members.☆trax.dictionary.size☆",
                "5:3 !DRT - FStore/%Names <- FStore/root*members.☆trax.dictionary.size☆",
                "5:4 !PCS - Reconciliation #3 - 2 processors",
                "5:5 !PCS - Compute #3 (FStore/%Size) P1 Reconciliation - parentId=5:4",
                "5:6 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "5:7 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                "5:8 !SET - FStore/root.size = 0 (prev: 1)",
                "5:9 !PCE - 5:5",
                "5:10 !PCS - Compute #4 (FStore/%Names) P2 Reconciliation - parentId=5:4",
                "5:11 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "5:12 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                "5:13 !PCE - 5:10",
                "5:14 !PCE - 5:4",
                "6:1 !GET - FStore/root.names -> ''",
                "6:2 !GET - FStore/root.size -> 0",
            ]);
        });

        it('should support creation as JSON + updates (not empty)', async () => {
            const fs = createFamilyStore(false);
            const f = fs.root;
            const members = f.members;

            expect(f.size).toBe(2);
            expect(f.names).toBe("Homer, Marge");

            await trax.reconciliation();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - S: FStore",
                "0:3 !NEW - O: FStore/root",
                "0:4 !NEW - P: FStore/%Size",
                "0:5 !PCS - Compute #1 (FStore/%Size) P1 Init - parentId=0:1",
                "0:6 !NEW - O: FStore/root*members",
                "0:7 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:8 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 2",
                "0:9 !SET - FStore/root.size = 2 (prev: undefined)",
                "0:10 !PCE - 0:5",
                "0:11 !NEW - P: FStore/%Names",
                "0:12 !PCS - Compute #1 (FStore/%Names) P2 Init - parentId=0:1",
                "0:13 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:14 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 2",
                "0:15 !NEW - O: FStore/root*members*m1",
                "0:16 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "0:17 !GET - FStore/root*members*m1.firstName -> 'Homer'",
                "0:18 !NEW - O: FStore/root*members*m2",
                "0:19 !GET - FStore/root*members.m2 -> '[TRAX FStore/root*members*m2]'",
                "0:20 !GET - FStore/root*members*m2.firstName -> 'Marge'",
                "0:21 !SET - FStore/root.names = 'Homer, Marge' (prev: undefined)",
                "0:22 !PCE - 0:12",
                "0:23 !PCE - 0:1",
                "0:24 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:25 !GET - FStore/root.size -> 2",
                "0:26 !GET - FStore/root.names -> 'Homer, Marge'",
            ]);

            trax.log.info("Add item");
            members["m3"] = { firstName: "Bart", lastName: "Simpson" };
            expect(trax.getTraxId(members["m3"])).toBe("FStore/root*members*m3");

            await trax.reconciliation();
            expect(f.size).toBe(3); // Size changed
            expect(f.names).toBe("Homer, Marge, Bart");

            await trax.reconciliation();
            trax.log.info("Update item");
            members["m1"].firstName = "HOMER";

            await trax.reconciliation();
            expect(f.size).toBe(3);
            expect(f.names).toBe("HOMER, Marge, Bart");

            expect(printLogs(3)).toMatchObject([
                "3:1 !LOG - Update item",
                "3:2 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "3:3 !SET - FStore/root*members*m1.firstName = 'HOMER' (prev: 'Homer')",
                "3:4 !DRT - FStore/%Names <- FStore/root*members*m1.firstName", // Size is not dirty
                "3:5 !PCS - Reconciliation #2 - 2 processors",
                "3:6 !PCS - Compute #3 (FStore/%Names) P2 Reconciliation - parentId=3:5",
                "3:7 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "3:8 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 3",
                "3:9 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "3:10 !GET - FStore/root*members*m1.firstName -> 'HOMER'",
                "3:11 !GET - FStore/root*members.m2 -> '[TRAX FStore/root*members*m2]'",
                "3:12 !GET - FStore/root*members*m2.firstName -> 'Marge'",
                "3:13 !GET - FStore/root*members.m3 -> '[TRAX FStore/root*members*m3]'",
                "3:14 !GET - FStore/root*members*m3.firstName -> 'Bart'",
                "3:15 !SET - FStore/root.names = 'HOMER, Marge, Bart' (prev: 'Homer, Marge, Bart')",
                "3:16 !PCE - 3:6",
                "3:17 !PCE - 3:5",
                "4:1 !GET - FStore/root.size -> 3",
                "4:2 !GET - FStore/root.names -> 'HOMER, Marge, Bart'",
            ]);
        });

    });

    describe('Computed', () => {

        function createFamilyStore(empty: boolean) {
            return trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                if (empty) {
                    store.init({
                        familyName: "Simpson",
                        members: {}
                    });
                } else {
                    store.init({
                        familyName: "Simpson",
                        members: {
                            m1: { firstName: "Homer", lastName: "Simpson" },
                            m2: { firstName: "Marge", lastName: "Simpson" }
                        }
                    });
                }
                const family = store.root;

                store.compute("Infos", () => {
                    let infos = family.infos;
                    if (!infos) {
                        // create the dictionary
                        infos = family.infos = {};
                    }
                    const members = family.members;
                    const content: DictFamilyStore["infos"] = {};

                    for (let k of trax.getObjectKeys(members)) {
                        const m = members[k];
                        if (m === undefined) {
                            // corner case - will not occur if types are not bypassed
                            (content as any)[k] = undefined;
                        } else {
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            content[k] = info;
                        }
                    }
                    trax.updateDictionary(infos, content);
                });
            });
        }

        function printInfos(infos: DictFamilyStore["infos"]) {
            if (!infos) return "";
            const arr: string[] = [];
            return trax.getObjectKeys(infos).map(k => {
                const info = infos[k];
                if (info === undefined) return k + ":XXX";
                return `${k}:${info.desc}`;
            }).join(" / ");
        }

        it('should compute a dictionary from another one (empty start)', async () => {
            const fs = createFamilyStore(true);
            const family = fs.root;
            const members = family.members;

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - S: FStore",
                "0:3 !NEW - O: FStore/root",
                "0:4 !NEW - P: FStore/%Infos",
                "0:5 !PCS - Compute #1 (FStore/%Infos) P1 Init - parentId=0:1",
                "0:6 !GET - FStore/root.infos -> undefined",
                "0:7 !NEW - O: FStore/root*infos",
                "0:8 !SET - FStore/root.infos = '[TRAX FStore/root*infos]' (prev: undefined)",
                "0:9 !NEW - O: FStore/root*members",
                "0:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:11 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                "0:12 !PCS - DictionaryUpdate - parentId=0:5",
                "0:13 !PCE - 0:12",
                "0:14 !PCE - 0:5",
                "0:15 !PCE - 0:1",
                "0:16 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
            ]);

            expect(printInfos(family.infos)).toBe("");
            await trax.reconciliation();

            trax.log.info("Size Increase");
            members["m1"] = { firstName: "Homer", lastName: "Simpson" };
            members["m2"] = { firstName: "Bart", lastName: "Simpson" };

            await trax.reconciliation();

            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:Bart Simpson");

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - Size Increase",
                "1:2 !NEW - O: FStore/root*members*m1",
                "1:3 !SET - FStore/root*members.m1 = '[TRAX FStore/root*members*m1]' (prev: undefined)",
                "1:4 !DRT - FStore/%Infos <- FStore/root*members.☆trax.dictionary.size☆",
                "1:5 !NEW - O: FStore/root*members*m2",
                "1:6 !SET - FStore/root*members.m2 = '[TRAX FStore/root*members*m2]' (prev: undefined)",
                "1:7 !PCS - Reconciliation #1 - 1 processor",
                "1:8 !PCS - Compute #2 (FStore/%Infos) P1 Reconciliation - parentId=1:7",
                "1:9 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "1:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:11 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 2",
                "1:12 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "1:13 !NEW - O: FStore/Info:root*members*m1",
                "1:14 !GET - FStore/root*members*m1.firstName -> 'Homer'",
                "1:15 !GET - FStore/root*members*m1.lastName -> 'Simpson'",
                "1:16 !SET - FStore/Info:root*members*m1.desc = 'Homer Simpson' (prev: '')",
                "1:17 !GET - FStore/root*members.m2 -> '[TRAX FStore/root*members*m2]'",
                "1:18 !NEW - O: FStore/Info:root*members*m2",
                "1:19 !GET - FStore/root*members*m2.firstName -> 'Bart'",
                "1:20 !GET - FStore/root*members*m2.lastName -> 'Simpson'",
                "1:21 !SET - FStore/Info:root*members*m2.desc = 'Bart Simpson' (prev: '')",
                "1:22 !PCS - DictionaryUpdate - parentId=1:8",
                "1:23 !GET - FStore/root*infos.☆trax.dictionary.size☆ -> 0",
                "1:24 !SET - FStore/root*infos.m1 = '[TRAX FStore/Info:root*members*m1]' (prev: undefined)",
                "1:25 !SET - FStore/root*infos.m2 = '[TRAX FStore/Info:root*members*m2]' (prev: undefined)",
                "1:26 !PCE - 1:22",
                "1:27 !PCE - 1:8",
                "1:28 !PCE - 1:7",
                "2:1 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "2:2 !GET - FStore/root*infos.☆trax.dictionary.size☆ -> 2",
                "2:3 !GET - FStore/root*infos.m1 -> '[TRAX FStore/Info:root*members*m1]'",
                "2:4 !GET - FStore/Info:root*members*m1.desc -> 'Homer Simpson'",
                "2:5 !GET - FStore/root*infos.m2 -> '[TRAX FStore/Info:root*members*m2]'",
                "2:6 !GET - FStore/Info:root*members*m2.desc -> 'Bart Simpson'",
            ]);

            await trax.reconciliation();

            trax.log.info("Update with undefined");
            (members as any)["m2"] = undefined;

            await trax.reconciliation();
            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:XXX");

            trax.log.info("Normal update");
            members["m2"] = { firstName: "Lisa", lastName: "Simpson" };

            await trax.reconciliation();
            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:Lisa Simpson");

            await trax.reconciliation();
            trax.log.info("Delete");
            delete members["m1"];

            await trax.reconciliation();
            expect(printLogs(6)).toMatchObject([
                "6:1 !LOG - Delete",
                "6:2 !DRT - FStore/%Infos <- FStore/root*members.☆trax.dictionary.size☆",
                "6:3 !PCS - Reconciliation #4 - 1 processor",
                "6:4 !PCS - Compute #5 (FStore/%Infos) P1 Reconciliation - parentId=6:3",
                "6:5 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "6:6 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "6:7 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 1",
                "6:8 !GET - FStore/root*members.m2 -> '[TRAX FStore/root*members*m2$1]'",
                "6:9 !GET - FStore/root*members*m2$1.firstName -> 'Lisa'",
                "6:10 !GET - FStore/root*members*m2$1.lastName -> 'Simpson'",
                "6:11 !PCS - DictionaryUpdate - parentId=6:4",
                "6:12 !GET - FStore/root*infos.☆trax.dictionary.size☆ -> 2",
                "6:13 !PCE - 6:11",
                "6:14 !PCE - 6:4",
                "6:15 !PCE - 6:3",
            ]);

            expect(printInfos(family.infos)).toBe("m2:Lisa Simpson");
        });

        it('should compute a dictionary from another one (non empty start)', async () => {
            const fs = createFamilyStore(false);
            const family = fs.root;
            const members = family.members;

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - S: FStore",
                "0:3 !NEW - O: FStore/root",
                "0:4 !NEW - P: FStore/%Infos",
                "0:5 !PCS - Compute #1 (FStore/%Infos) P1 Init - parentId=0:1",
                "0:6 !GET - FStore/root.infos -> undefined",
                "0:7 !NEW - O: FStore/root*infos",
                "0:8 !SET - FStore/root.infos = '[TRAX FStore/root*infos]' (prev: undefined)",
                "0:9 !NEW - O: FStore/root*members",
                "0:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:11 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 2",
                "0:12 !NEW - O: FStore/root*members*m1",
                "0:13 !GET - FStore/root*members.m1 -> '[TRAX FStore/root*members*m1]'",
                "0:14 !NEW - O: FStore/Info:root*members*m1",
                "0:15 !GET - FStore/root*members*m1.firstName -> 'Homer'",
                "0:16 !GET - FStore/root*members*m1.lastName -> 'Simpson'",
                "0:17 !SET - FStore/Info:root*members*m1.desc = 'Homer Simpson' (prev: '')",
                "0:18 !NEW - O: FStore/root*members*m2",
                "0:19 !GET - FStore/root*members.m2 -> '[TRAX FStore/root*members*m2]'",
                "0:20 !NEW - O: FStore/Info:root*members*m2",
                "0:21 !GET - FStore/root*members*m2.firstName -> 'Marge'",
                "0:22 !GET - FStore/root*members*m2.lastName -> 'Simpson'",
                "0:23 !SET - FStore/Info:root*members*m2.desc = 'Marge Simpson' (prev: '')",
                "0:24 !PCS - DictionaryUpdate - parentId=0:5",
                "0:25 !PCE - 0:24",
                "0:26 !PCE - 0:5",
                "0:27 !PCE - 0:1",
                "0:28 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",

            ]);

            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:Marge Simpson");
            await trax.reconciliation();

            trax.log.info("Size Increase");
            members["m3"] = { firstName: "Bart", lastName: "Simpson" };
            members["m4"] = { firstName: "Lisa", lastName: "Simpson" };

            await trax.reconciliation();

            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:Marge Simpson / m3:Bart Simpson / m4:Lisa Simpson");
            expect(trax.getTraxId(family.infos!["m4"])).toBe("FStore/Info:root*members*m4");

            trax.log.info("Size Increase 2");
            members["m5"] = { firstName: "Maggie", lastName: "Simpson" };

            await trax.reconciliation();

            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m2:Marge Simpson / m3:Bart Simpson / m4:Lisa Simpson / m5:Maggie Simpson");

            trax.log.info("Delete");
            delete members["m2"];
            delete members["m3"];

            await trax.reconciliation();

            expect(printInfos(family.infos)).toBe("m1:Homer Simpson / m4:Lisa Simpson / m5:Maggie Simpson");

            trax.log.info("Update");
            members["m1"].firstName = "HOMER";

            await trax.reconciliation();

            expect(printInfos(family.infos)).toBe("m1:HOMER Simpson / m4:Lisa Simpson / m5:Maggie Simpson");
            members["m5"] = { firstName: "Maggie", lastName: "Simpson" }; // no changes
        });

        describe('Errors', () => {

            it('should be raised in case of invalid updateDictionary arguments', async () => {
                trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                    store.init({
                        familyName: "Simpson",
                        members: {}
                    });
                    const family = store.root;

                    store.compute("Infos", () => {
                        let infos = family.infos;
                        if (!infos) {
                            // create the dictionary
                            infos = family.infos = {};
                        }
                        const members = family.members;
                        const content: DictFamilyStore["infos"] = {};

                        for (let k of trax.getObjectKeys(members)) {
                            const m = members[k];
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            content[k] = info;
                        }
                        trax.updateDictionary(12 as any, content);
                    });
                });

                expect(printLogs(0)).toMatchObject([
                    "0:1 !PCS - StoreInit (FStore)",
                    "0:2 !NEW - S: FStore",
                    "0:3 !NEW - O: FStore/root",
                    "0:4 !NEW - P: FStore/%Infos",
                    "0:5 !PCS - Compute #1 (FStore/%Infos) P1 Init - parentId=0:1",
                    "0:6 !GET - FStore/root.infos -> undefined",
                    "0:7 !NEW - O: FStore/root*infos",
                    "0:8 !SET - FStore/root.infos = '[TRAX FStore/root*infos]' (prev: undefined)",
                    "0:9 !NEW - O: FStore/root*members",
                    "0:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                    "0:11 !GET - FStore/root*members.☆trax.dictionary.size☆ -> 0",
                    "0:12 !ERR - [TRAX] updateDictionary: Invalid argument (object expected)",
                    "0:13 !PCE - 0:5",
                    "0:14 !PCE - 0:1",
                ]);
            });

            it('should be raised when a computed dict is updated by multiple processors (manual change)', async () => {
                const fs = trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                    store.init({
                        familyName: "Simpson",
                        members: {
                            m1: { firstName: "Homer", lastName: "Simpson" }
                        }
                    });
                    const family = store.root;

                    store.compute("Infos", () => {
                        let infos = family.infos;
                        if (!infos) {
                            // create the dictionary
                            infos = family.infos = {};
                        }
                        const members = family.members;
                        const content: DictFamilyStore["infos"] = {};

                        for (let k of trax.getObjectKeys(members)) {
                            const m = members[k];
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            content[k] = info;
                        }
                        trax.updateDictionary(infos, content);
                    });
                });

                const infos = fs.root.infos;
                expect(printInfos(infos)).toBe("m1:Homer Simpson");

                await trax.reconciliation();
                trax.log.info("Manual update");

                infos!["foo"] = { desc: "bar" };
                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - Manual update",
                    "1:2 !ERR - [TRAX] Computed content conflict: FStore/root*infos.foo can only be set by FStore/%Infos"
                ]);
            });

            it('should be raised when a computed dict is updated by multiple processors (direct change)', async () => {
                const fs = trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                    store.init({
                        familyName: "Simpson",
                        members: {
                            m1: { firstName: "Homer", lastName: "Simpson" }
                        }
                    });
                    const family = store.root;

                    store.compute("Infos", () => {
                        let infos = family.infos;
                        if (!infos) {
                            // create the dictionary
                            infos = family.infos = {};
                        }
                        const members = family.members;
                        const content: DictFamilyStore["infos"] = {};

                        for (let k of trax.getObjectKeys(members)) {
                            const m = members[k];
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            content[k] = info;
                        }
                        trax.updateDictionary(infos, content);
                    });
                });

                const infos = fs.root.infos;
                expect(printInfos(infos)).toBe("m1:Homer Simpson");

                await trax.reconciliation();
                trax.log.info("Direct processor update");

                fs.compute("Invalid", () => {
                    infos!["foo"] = { desc: "bar" };
                });
                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - Direct processor update",
                    "1:2 !NEW - P: FStore/%Invalid",
                    "1:3 !PCS - Compute #1 (FStore/%Invalid) P2 Init",
                    "1:4 !ERR - [TRAX] Computed content conflict: FStore/root*infos.foo can only be set by FStore/%Infos",
                    "1:5 !PCE - 1:3",
                    "1:6 !ERR - [TRAX] (FStore/%Invalid) No dependencies found: processor will never be re-executed",
                ]);
            });

            it('should be raised when a computed dict is updated by multiple processors (updateDictionary change)', async () => {
                const fs = trax.createStore("FStore", (store: Store<DictFamilyStore>) => {
                    store.init({
                        familyName: "Simpson",
                        members: {
                            m1: { firstName: "Homer", lastName: "Simpson" }
                        }
                    });
                    const family = store.root;

                    store.compute("Infos", () => {
                        let infos = family.infos;
                        if (!infos) {
                            // create the dictionary
                            infos = family.infos = {};
                        }
                        const members = family.members;
                        const content: DictFamilyStore["infos"] = {};

                        for (let k of trax.getObjectKeys(members)) {
                            const m = members[k];
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            content[k] = info;
                        }
                        trax.updateDictionary(infos, content);
                    });
                });

                const infos = fs.root.infos;
                expect(printInfos(infos)).toBe("m1:Homer Simpson");

                await trax.reconciliation();
                trax.log.info("Direct processor update");

                fs.compute("Invalid", () => {
                    trax.updateDictionary(infos!, { x: { desc: "bar" } })
                });
                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - Direct processor update",
                    "1:2 !NEW - P: FStore/%Invalid",
                    "1:3 !PCS - Compute #1 (FStore/%Invalid) P2 Init",
                    "1:4 !ERR - [TRAX] Computed content conflict: FStore/root*infos can only be changed by FStore/%Infos",
                    "1:5 !PCS - DictionaryUpdate - parentId=1:3",
                    "1:6 !GET - FStore/root*infos.☆trax.dictionary.size☆ -> 1",
                    "1:7 !ERR - [TRAX] Computed content conflict: FStore/root*infos.x can only be set by FStore/%Infos",
                    "1:8 !PCE - 1:5",
                    "1:9 !PCE - 1:3",
                ]);
            });
            
        });
    });

});
