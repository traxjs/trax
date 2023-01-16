import { beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv } from '../core';
import { $Store, $Trax } from '../types';
import { $ArrayFamilyStore, printEvents } from './utils';


describe('Arrays', () => {
    let trax: $Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    /**
     * 2 kind of arrays
     * - computed: its items are added/sorted/filterd/removed by a processor
     * - primary: its items are manually managed outside processors (primary values) 
     */

    describe('Primary', () => {

        function createFamilyStore(empty: boolean) {
            return trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                if (empty) {
                    store.initRoot({
                        familyName: "Simpson",
                        members: []
                    });
                } else {
                    store.initRoot({
                        familyName: "Simpson",
                        members: [{
                            firstName: "Homer",
                            lastName: "Simpson"
                        }, {
                            firstName: "Marge",
                            lastName: "Simpson"
                        }]
                    });
                }
                let family = store.root;
                store.compute("Size", () => {
                    family.size = family.members.length;
                });
                store.compute("Names", () => {
                    family.names = family.members.map((m) => m.firstName).join(", ");
                })
            });
        }

        it('should support creation as JSON + push updates (empty)', async () => {
            const fs = createFamilyStore(true);
            const f = fs.root;

            expect(f.members.length).toBe(0);
            expect(f.size).toBe(0);
            expect(f.names).toBe("");

            await trax.reconciliation();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - O: FStore/root",
                "0:3 !NEW - P: FStore/%Size",
                "0:4 !PCS - Compute #1 (FStore/%Size) P1 Init - parentId=0:1",
                "0:5 !NEW - A: FStore/root*members",
                "0:6 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:7 !GET - FStore/root*members.length -> 0",
                "0:8 !SET - FStore/root.size = 0 (prev: undefined)",
                "0:9 !PCE - 0:4",
                "0:10 !NEW - P: FStore/%Names",
                "0:11 !PCS - Compute #1 (FStore/%Names) P2 Init - parentId=0:1",
                "0:12 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:13 !GET - FStore/root*members.map -> '[Function]'",
                "0:14 !GET - FStore/root*members.length -> 0",
                "0:15 !SET - FStore/root.names = '' (prev: undefined)",
                "0:16 !PCE - 0:11",
                "0:17 !PCE - 0:1",
                "0:18 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:19 !GET - FStore/root*members.length -> 0",
                "0:20 !GET - FStore/root.size -> 0",
                "0:21 !GET - FStore/root.names -> ''",
            ]);

            // add item
            trax.log.info("A");
            f.members.push({ firstName: "Homer", lastName: "Simpson" });
            await trax.reconciliation();
            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:3 !GET - FStore/root*members.push -> '[Function]'",
                "1:4 !GET - FStore/root*members.length -> 0",
                "1:5 !NEW - O: FStore/root*members*0",
                "1:6 !SET - FStore/root*members.0 = '[TRAX FStore/root*members*0]' (prev: undefined)",
                "1:7 !DRT - FStore/%Size <- FStore/root*members.length",
                "1:8 !DRT - FStore/%Names <- FStore/root*members.length",
                "1:9 !PCS - Reconciliation #1 - 2 processors",
                "1:10 !PCS - Compute #2 (FStore/%Size) P1 Reconciliation - parentId=1:9",
                "1:11 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:12 !GET - FStore/root*members.length -> 1",
                "1:13 !SET - FStore/root.size = 1 (prev: 0)",
                "1:14 !PCE - 1:10",
                "1:15 !PCS - Compute #2 (FStore/%Names) P2 Reconciliation - parentId=1:9",
                "1:16 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:17 !GET - FStore/root*members.map -> '[Function]'",
                "1:18 !GET - FStore/root*members.length -> 1",
                "1:19 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "1:20 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "1:21 !SET - FStore/root.names = 'Homer' (prev: '')",
                "1:22 !PCE - 1:15",
                "1:23 !PCE - 1:9",
            ]);

            await trax.reconciliation();
            trax.log.info("B");
            expect(f.members.length).toBe(1);
            expect(f.size).toBe(1);
            expect(f.names).toBe("Homer");

            expect(printLogs(2)).toMatchObject([
                "2:1 !LOG - B",
                "2:2 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "2:3 !GET - FStore/root*members.length -> 1",
                "2:4 !GET - FStore/root.size -> 1",
                "2:5 !GET - FStore/root.names -> 'Homer'",
            ]);

            f.members.push({ firstName: "Marge", lastName: "Simpson" });
            f.members.push({ firstName: "Bart", lastName: "Simpson" });
            f.members.push({ firstName: "Lisa", lastName: "Simpson" });
            f.members.push({ firstName: "Maggie", lastName: "Simpson" });
            await trax.reconciliation();
            expect(f.size).toBe(5);
            expect(f.names).toBe("Homer, Marge, Bart, Lisa, Maggie");
        });

        it('should support creation as JSON + push updates (non empty)', async () => {
            const fs = createFamilyStore(false);
            const f = fs.root;

            expect(f.size).toBe(2);
            expect(f.names).toBe("Homer, Marge");

            await trax.reconciliation();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (FStore)",
                "0:2 !NEW - O: FStore/root",
                "0:3 !NEW - P: FStore/%Size",
                "0:4 !PCS - Compute #1 (FStore/%Size) P1 Init - parentId=0:1",
                "0:5 !NEW - A: FStore/root*members",
                "0:6 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:7 !GET - FStore/root*members.length -> 2",
                "0:8 !SET - FStore/root.size = 2 (prev: undefined)",
                "0:9 !PCE - 0:4",
                "0:10 !NEW - P: FStore/%Names",
                "0:11 !PCS - Compute #1 (FStore/%Names) P2 Init - parentId=0:1",
                "0:12 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "0:13 !GET - FStore/root*members.map -> '[Function]'",
                "0:14 !GET - FStore/root*members.length -> 2",
                "0:15 !NEW - O: FStore/root*members*0",
                "0:16 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "0:17 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "0:18 !NEW - O: FStore/root*members*1",
                "0:19 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "0:20 !GET - FStore/root*members*1.firstName -> 'Marge'",
                "0:21 !SET - FStore/root.names = 'Homer, Marge' (prev: undefined)",
                "0:22 !PCE - 0:11",
                "0:23 !PCE - 0:1",
                "0:24 !GET - FStore/root.size -> 2",
                "0:25 !GET - FStore/root.names -> 'Homer, Marge'",
            ]);

            // add item
            trax.log.info("A");
            f.members.push({ firstName: "Bart", lastName: "Simpson" });
            f.members.push({ firstName: "Lisa", lastName: "Simpson" });
            f.members.push({ firstName: "Maggie", lastName: "Simpson" });
            await trax.reconciliation();
            expect(f.size).toBe(5);
            expect(f.names).toBe("Homer, Marge, Bart, Lisa, Maggie");

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:3 !GET - FStore/root*members.push -> '[Function]'",
                "1:4 !GET - FStore/root*members.length -> 2",
                "1:5 !NEW - O: FStore/root*members*2",
                "1:6 !SET - FStore/root*members.2 = '[TRAX FStore/root*members*2]' (prev: undefined)",
                "1:7 !DRT - FStore/%Size <- FStore/root*members.length",
                "1:8 !DRT - FStore/%Names <- FStore/root*members.length",
                "1:9 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:10 !GET - FStore/root*members.push -> '[Function]'",
                "1:11 !GET - FStore/root*members.length -> 3",
                "1:12 !NEW - O: FStore/root*members*3",
                "1:13 !SET - FStore/root*members.3 = '[TRAX FStore/root*members*3]' (prev: undefined)",
                "1:14 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:15 !GET - FStore/root*members.push -> '[Function]'",
                "1:16 !GET - FStore/root*members.length -> 4",
                "1:17 !NEW - O: FStore/root*members*4",
                "1:18 !SET - FStore/root*members.4 = '[TRAX FStore/root*members*4]' (prev: undefined)",
                "1:19 !PCS - Reconciliation #1 - 2 processors",
                "1:20 !PCS - Compute #2 (FStore/%Size) P1 Reconciliation - parentId=1:19",
                "1:21 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:22 !GET - FStore/root*members.length -> 5",
                "1:23 !SET - FStore/root.size = 5 (prev: 2)",
                "1:24 !PCE - 1:20",
                "1:25 !PCS - Compute #2 (FStore/%Names) P2 Reconciliation - parentId=1:19",
                "1:26 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:27 !GET - FStore/root*members.map -> '[Function]'",
                "1:28 !GET - FStore/root*members.length -> 5",
                "1:29 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "1:30 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "1:31 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "1:32 !GET - FStore/root*members*1.firstName -> 'Marge'",
                "1:33 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "1:34 !GET - FStore/root*members*2.firstName -> 'Bart'",
                "1:35 !GET - FStore/root*members.3 -> '[TRAX FStore/root*members*3]'",
                "1:36 !GET - FStore/root*members*3.firstName -> 'Lisa'",
                "1:37 !GET - FStore/root*members.4 -> '[TRAX FStore/root*members*4]'",
                "1:38 !GET - FStore/root*members*4.firstName -> 'Maggie'",
                "1:39 !SET - FStore/root.names = 'Homer, Marge, Bart, Lisa, Maggie' (prev: 'Homer, Marge')",
                "1:40 !PCE - 1:25",
                "1:41 !PCE - 1:19",
                "2:1 !GET - FStore/root.size -> 5",
                "2:2 !GET - FStore/root.names -> 'Homer, Marge, Bart, Lisa, Maggie'",
            ]);
        });

        it('should support creation as JSON + manual updates (empty)', async () => {
            const fs = createFamilyStore(true);
            const f = fs.root;

            expect(f.members.length).toBe(0);
            expect(f.size).toBe(0);
            expect(f.names).toBe("");

            await trax.reconciliation();
            // add item
            trax.log.info("A");
            f.members[0] = { firstName: "Homer", lastName: "Simpson" };
            // keep 1 empty
            f.members[2] = { firstName: "Marge", lastName: "Simpson" };
            await trax.reconciliation();
            expect(f.size).toBe(3);
            expect(f.names).toBe("Homer, , Marge");
            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:3 !NEW - O: FStore/root*members*0",
                "1:4 !SET - FStore/root*members.0 = '[TRAX FStore/root*members*0]' (prev: undefined)",
                "1:5 !DRT - FStore/%Size <- FStore/root*members.length",
                "1:6 !DRT - FStore/%Names <- FStore/root*members.length",
                "1:7 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:8 !NEW - O: FStore/root*members*2",
                "1:9 !SET - FStore/root*members.2 = '[TRAX FStore/root*members*2]' (prev: undefined)",
                "1:10 !PCS - Reconciliation #1 - 2 processors",
                "1:11 !PCS - Compute #2 (FStore/%Size) P1 Reconciliation - parentId=1:10",
                "1:12 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:13 !GET - FStore/root*members.length -> 3",
                "1:14 !SET - FStore/root.size = 3 (prev: 0)",
                "1:15 !PCE - 1:11",
                "1:16 !PCS - Compute #2 (FStore/%Names) P2 Reconciliation - parentId=1:10",
                "1:17 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:18 !GET - FStore/root*members.map -> '[Function]'",
                "1:19 !GET - FStore/root*members.length -> 3",
                "1:20 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "1:21 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "1:22 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "1:23 !GET - FStore/root*members*2.firstName -> 'Marge'",
                "1:24 !SET - FStore/root.names = 'Homer, , Marge' (prev: '')",
                "1:25 !PCE - 1:16",
                "1:26 !PCE - 1:10",
                "2:1 !GET - FStore/root.size -> 3",
                "2:2 !GET - FStore/root.names -> 'Homer, , Marge'",
            ]);

        });

        it('should support splice', async () => {
            const fs = createFamilyStore(false);
            const f = fs.root;
            const members = f.members;
            members.push({ firstName: "Bart", lastName: "Simpson" });
            members.push({ firstName: "Lisa", lastName: "Simpson" });
            members.push({ firstName: "Maggie", lastName: "Simpson" });

            await trax.reconciliation();
            expect(f.size).toBe(5);
            expect(f.names).toBe("Homer, Marge, Bart, Lisa, Maggie");

            await trax.reconciliation();
            trax.log.info("A");
            members.splice(1, 2); // removal of 2 elements

            await trax.reconciliation();
            expect(f.size).toBe(3);
            expect(f.names).toBe("Homer, Lisa, Maggie");

            trax.log.info("B");
            members.splice(1, 0, { firstName: "MARGE", lastName: "S" }, { firstName: "BART", lastName: "S" }); // removal of 0 and add of 2 elements

            await trax.reconciliation();
            expect(f.size).toBe(5);
            expect(f.names).toBe("Homer, MARGE, BART, Lisa, Maggie");
        });

        it('should support creation through add() - empty array', async () => {
            const fs = createFamilyStore(false);
            const f = fs.root;

            let output = "";
            const pr = fs.compute("Summary", () => {
                if (f.infos) {
                    output = f.infos.map(info => info.desc).join("; ");
                } else {
                    output = "";
                }
            });

            expect(pr.computeCount).toBe(1);

            await trax.reconciliation();
            trax.log.info("A");
            const infos = fs.add<{ desc: string }[]>("Infos", []);
            f.infos = infos;

            await trax.reconciliation();
            expect(output).toBe("");
            expect(pr.computeCount).toBe(2);
            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !NEW - A: FStore/Infos",
                "1:3 !SET - FStore/root.infos = '[TRAX FStore/Infos]' (prev: undefined)",
                "1:4 !DRT - FStore/%Summary <- FStore/root.infos",
                "1:5 !PCS - Reconciliation #1 - 3 processors",
                "1:6 !PCS - Compute #2 (FStore/%Summary) P3 Reconciliation - parentId=1:5",
                "1:7 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "1:8 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "1:9 !GET - FStore/Infos.map -> '[Function]'",
                "1:10 !GET - FStore/Infos.length -> 0",
                "1:11 !PCE - 1:6",
                "1:12 !PCE - 1:5",
            ]);

            trax.log.info("B");
            infos.push({ desc: "AAA" }, { desc: "BBB" });
            await trax.reconciliation();
            expect(output).toBe('AAA; BBB');
            expect(pr.computeCount).toBe(3);
            expect(printLogs(2)).toMatchObject([
                "2:1 !LOG - B",
                "2:2 !GET - FStore/Infos.push -> '[Function]'",
                "2:3 !GET - FStore/Infos.length -> 0",
                "2:4 !NEW - O: FStore/Infos*0",
                "2:5 !SET - FStore/Infos.0 = '[TRAX FStore/Infos*0]' (prev: undefined)",
                "2:6 !DRT - FStore/%Summary <- FStore/Infos.length",
                "2:7 !NEW - O: FStore/Infos*1",
                "2:8 !SET - FStore/Infos.1 = '[TRAX FStore/Infos*1]' (prev: undefined)",
                "2:9 !PCS - Reconciliation #2 - 3 processors",
                "2:10 !PCS - Compute #3 (FStore/%Summary) P3 Reconciliation - parentId=2:9",
                "2:11 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "2:12 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "2:13 !GET - FStore/Infos.map -> '[Function]'",
                "2:14 !GET - FStore/Infos.length -> 2",
                "2:15 !GET - FStore/Infos.0 -> '[TRAX FStore/Infos*0]'",
                "2:16 !GET - FStore/Infos*0.desc -> 'AAA'",
                "2:17 !GET - FStore/Infos.1 -> '[TRAX FStore/Infos*1]'",
                "2:18 !GET - FStore/Infos*1.desc -> 'BBB'",
                "2:19 !PCE - 2:10",
                "2:20 !PCE - 2:9",
            ]);
        });

        it('should support creation through add() - non empty array', async () => {
            const fs = createFamilyStore(false);
            const f = fs.root;

            let output = "";
            const pr = fs.compute("Summary", () => {
                if (f.infos) {
                    output = f.infos.map(info => info.desc).join("; ");
                } else {
                    output = "";
                }
            });

            expect(pr.computeCount).toBe(1);
            await trax.reconciliation();
            trax.log.info("A");
            const infos = fs.add<{ desc: string }[]>("Infos", [{ desc: "AAA" }]);
            f.infos = infos;

            await trax.reconciliation();
            expect(output).toBe("AAA");
            expect(pr.computeCount).toBe(2);
            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !NEW - A: FStore/Infos",
                "1:3 !SET - FStore/root.infos = '[TRAX FStore/Infos]' (prev: undefined)",
                "1:4 !DRT - FStore/%Summary <- FStore/root.infos",
                "1:5 !PCS - Reconciliation #1 - 3 processors",
                "1:6 !PCS - Compute #2 (FStore/%Summary) P3 Reconciliation - parentId=1:5",
                "1:7 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "1:8 !GET - FStore/root.infos -> '[TRAX FStore/Infos]'",
                "1:9 !GET - FStore/Infos.map -> '[Function]'",
                "1:10 !GET - FStore/Infos.length -> 1",
                "1:11 !NEW - O: FStore/Infos*0",
                "1:12 !GET - FStore/Infos.0 -> '[TRAX FStore/Infos*0]'",
                "1:13 !GET - FStore/Infos*0.desc -> 'AAA'",
                "1:14 !PCE - 1:6",
                "1:15 !PCE - 1:5",
            ]);
        });

        describe('Arrays of Arrays', () => {
            it('should support creation as JSON (empty)', async () => {
                let output = "";
                const fs = trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    const f = store.initRoot({
                        familyName: "Simpson",
                        members: [],
                        misc: []
                    });

                    store.compute("MiscRender", () => {
                        if (!f.misc) {
                            output = "--";
                        } else {
                            output = f.misc.map(arr => arr.map(item => item.desc).join(";")).join("/") || "-";
                        }
                    });
                });
                const f = fs.root;

                await trax.reconciliation();

                expect(output).toBe("-");
                trax.log.info("A");
                f.misc!.push([{ desc: "AAA" }, { desc: "BBB" }]);
                f.misc!.push([{ desc: "CCC" }, { desc: "DDD" }]);

                await trax.reconciliation();
                expect(output).toBe("AAA;BBB/CCC;DDD")

                expect(printLogs(0)).toMatchObject([
                    "0:1 !PCS - StoreInit (FStore)",
                    "0:2 !NEW - O: FStore/root",
                    "0:3 !NEW - P: FStore/%MiscRender",
                    "0:4 !PCS - Compute #1 (FStore/%MiscRender) P1 Init - parentId=0:1",
                    "0:5 !NEW - A: FStore/root*misc",
                    "0:6 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "0:7 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "0:8 !GET - FStore/root*misc.map -> '[Function]'",
                    "0:9 !GET - FStore/root*misc.length -> 0",
                    "0:10 !PCE - 0:4",
                    "0:11 !PCE - 0:1",
                    "1:1 !LOG - A",
                    "1:2 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "1:3 !GET - FStore/root*misc.push -> '[Function]'",
                    "1:4 !GET - FStore/root*misc.length -> 0",
                    "1:5 !NEW - A: FStore/root*misc*0",
                    "1:6 !SET - FStore/root*misc.0 = '[TRAX FStore/root*misc*0]' (prev: undefined)",
                    "1:7 !DRT - FStore/%MiscRender <- FStore/root*misc.length",
                    "1:8 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "1:9 !GET - FStore/root*misc.push -> '[Function]'",
                    "1:10 !GET - FStore/root*misc.length -> 1",
                    "1:11 !NEW - A: FStore/root*misc*1",
                    "1:12 !SET - FStore/root*misc.1 = '[TRAX FStore/root*misc*1]' (prev: undefined)",
                    "1:13 !PCS - Reconciliation #1 - 1 processor",
                    "1:14 !PCS - Compute #2 (FStore/%MiscRender) P1 Reconciliation - parentId=1:13",
                    "1:15 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "1:16 !GET - FStore/root.misc -> '[TRAX FStore/root*misc]'",
                    "1:17 !GET - FStore/root*misc.map -> '[Function]'",
                    "1:18 !GET - FStore/root*misc.length -> 2",
                    "1:19 !GET - FStore/root*misc.0 -> '[TRAX FStore/root*misc*0]'",
                    "1:20 !GET - FStore/root*misc*0.map -> '[Function]'",
                    "1:21 !GET - FStore/root*misc*0.length -> 2",
                    "1:22 !NEW - O: FStore/root*misc*0*0",
                    "1:23 !GET - FStore/root*misc*0.0 -> '[TRAX FStore/root*misc*0*0]'",
                    "1:24 !GET - FStore/root*misc*0*0.desc -> 'AAA'",
                    "1:25 !NEW - O: FStore/root*misc*0*1",
                    "1:26 !GET - FStore/root*misc*0.1 -> '[TRAX FStore/root*misc*0*1]'",
                    "1:27 !GET - FStore/root*misc*0*1.desc -> 'BBB'",
                    "1:28 !GET - FStore/root*misc.1 -> '[TRAX FStore/root*misc*1]'",
                    "1:29 !GET - FStore/root*misc*1.map -> '[Function]'",
                    "1:30 !GET - FStore/root*misc*1.length -> 2",
                    "1:31 !NEW - O: FStore/root*misc*1*0",
                    "1:32 !GET - FStore/root*misc*1.0 -> '[TRAX FStore/root*misc*1*0]'",
                    "1:33 !GET - FStore/root*misc*1*0.desc -> 'CCC'",
                    "1:34 !NEW - O: FStore/root*misc*1*1",
                    "1:35 !GET - FStore/root*misc*1.1 -> '[TRAX FStore/root*misc*1*1]'",
                    "1:36 !GET - FStore/root*misc*1*1.desc -> 'DDD'",
                    "1:37 !PCE - 1:14",
                    "1:38 !PCE - 1:13",
                ]);

                f.misc!.push([{ desc: "EEE" }]);

                await trax.reconciliation();
                expect(output).toBe("AAA;BBB/CCC;DDD/EEE")
            });

            it('should support creation as JSON (non empty)', async () => {
                let output = "";
                const fs = trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    const f = store.initRoot({
                        familyName: "Simpson",
                        members: [],
                        misc: [
                            [{ desc: "AAA" }, { desc: "BBB" }],
                            [{ desc: "CCC" }, { desc: "DDD" }]
                        ]
                    });

                    store.compute("MiscRender", () => {
                        if (!f.misc) {
                            output = "--";
                        } else {
                            output = f.misc.map(arr => arr.map(item => item.desc).join(";")).join("/") || "-";
                        }
                    });
                });
                const f = fs.root;

                expect(output).toBe("AAA;BBB/CCC;DDD")

                f.misc!.push([{ desc: "EEE" }]);
                expect(trax.getTraxId(f.misc![0][1])).toBe("FStore/root*misc*0*1");

                await trax.reconciliation();
                expect(output).toBe("AAA;BBB/CCC;DDD/EEE")
            });

            it('should support creation through add()', async () => {
                let output = "";
                const fs = trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    const f = store.initRoot({
                        familyName: "Simpson",
                        members: [],
                        misc: []
                    });

                    store.compute("MiscRender", () => {
                        if (!f.misc) {
                            output = "--";
                        } else {
                            output = f.misc.map(arr => arr.map(item => item.desc).join(";")).join("/") || "-";
                        }
                    });
                });
                const f = fs.root;

                await trax.reconciliation();

                expect(output).toBe("-");
                trax.log.info("A");
                const line0 = fs.add("Line0", [{ desc: "AAA" }, { desc: "BBB" }]);
                const line1 = fs.add("Line1", [{ desc: "CCC" }, { desc: "DDD" }]);
                f.misc!.push(line0);
                f.misc!.push(line1);

                await trax.reconciliation();
                expect(output).toBe("AAA;BBB/CCC;DDD")
                expect(trax.getTraxId(f.misc![0][1])).toBe("FStore/Line0*1");
                expect(trax.getTraxId(f.misc![1][0])).toBe("FStore/Line1*0");
            });
        });
    });

    // describe('Computed', () => {

    // });

    // errors when a computed array content is updated by multiple processors ?

});
