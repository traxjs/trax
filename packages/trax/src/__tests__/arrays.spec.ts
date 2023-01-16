import { beforeEach, describe, expect, it } from 'vitest';
import { f } from 'vitest/dist/index-761e769b';
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

    describe('Computed', () => {
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
                store.compute("Desc", () => {
                    // Compute Misc content from members
                    let infos = family.infos;
                    if (!infos) {
                        // create the array
                        infos = family.infos = [];
                    }
                    let content = family.members.map((m) => {
                        const info = store.add(["Info", m], { desc: "" });
                        info.desc = m.firstName + " " + m.lastName;
                        return info;
                    });
                    // sort by desc
                    content = content.sort((c1, c2) => c1.desc === c2.desc ? 0 : c1.desc > c2.desc ? 1 : -1);
                    trax.updateArray(infos, content);
                });
            });
        }

        function printInfos(infos: $ArrayFamilyStore["infos"]) {
            return infos?.map(info => info.desc).join(";");
        }

        it('should compute array from another one (empty start)', async () => {
            const fs = createFamilyStore(true);
            const family = fs.root;
            const members = family.members;

            expect(family.infos?.length).toBe(0);
            await trax.reconciliation();

            trax.log.info("Size Increase");
            members.push({ firstName: "Homer", lastName: "Simpson" });
            members.push({ firstName: "Bart", lastName: "Simpson" });

            await trax.reconciliation();

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - Size Increase",
                "1:2 !GET - FStore/root*members.push -> '[Function]'",
                "1:3 !GET - FStore/root*members.length -> 0",
                "1:4 !NEW - O: FStore/root*members*0",
                "1:5 !SET - FStore/root*members.0 = '[TRAX FStore/root*members*0]' (prev: undefined)",
                "1:6 !DRT - FStore/%Desc <- FStore/root*members.length",
                "1:7 !GET - FStore/root*members.push -> '[Function]'",
                "1:8 !GET - FStore/root*members.length -> 1",
                "1:9 !NEW - O: FStore/root*members*1",
                "1:10 !SET - FStore/root*members.1 = '[TRAX FStore/root*members*1]' (prev: undefined)",
                "1:11 !PCS - Reconciliation #1 - 1 processor",
                "1:12 !PCS - Compute #2 (FStore/%Desc) P1 Reconciliation - parentId=1:11",
                "1:13 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "1:14 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:15 !GET - FStore/root*members.map -> '[Function]'",
                "1:16 !GET - FStore/root*members.length -> 2",
                "1:17 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "1:18 !NEW - O: FStore/Info:root*members*0",
                "1:19 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "1:20 !GET - FStore/root*members*0.lastName -> 'Simpson'",
                "1:21 !SET - FStore/Info:root*members*0.desc = 'Homer Simpson' (prev: '')",
                "1:22 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "1:23 !NEW - O: FStore/Info:root*members*1",
                "1:24 !GET - FStore/root*members*1.firstName -> 'Bart'",
                "1:25 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "1:26 !SET - FStore/Info:root*members*1.desc = 'Bart Simpson' (prev: '')",
                "1:27 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "1:28 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:29 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "1:30 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:31 !PCS - ArrayUpdate (FStore/root*infos) - parentId=1:12",
                "1:32 !GET - FStore/root*infos.length -> 0",
                "1:33 !SET - FStore/root*infos.0 = '[TRAX FStore/Info:root*members*1]' (prev: undefined)",
                "1:34 !SET - FStore/root*infos.1 = '[TRAX FStore/Info:root*members*0]' (prev: undefined)",
                "1:35 !PCE - 1:31",
                "1:36 !PCE - 1:12",
                "1:37 !PCE - 1:11",
            ]);

            const infos = family.infos;
            expect(infos?.length).toBe(2);
            expect(printInfos(infos)).toBe("Bart Simpson;Homer Simpson"); // Bart first (cf. sort)

            await trax.reconciliation(); // to get a new log cycle
            trax.log.info("Size Increase 2");
            members.push({ firstName: "Marge", lastName: "Simpson" });

            await trax.reconciliation();

            expect(printLogs(3)).toMatchObject([
                "3:1 !LOG - Size Increase 2",
                "3:2 !GET - FStore/root*members.push -> '[Function]'",
                "3:3 !GET - FStore/root*members.length -> 2",
                "3:4 !NEW - O: FStore/root*members*2",
                "3:5 !SET - FStore/root*members.2 = '[TRAX FStore/root*members*2]' (prev: undefined)",
                "3:6 !DRT - FStore/%Desc <- FStore/root*members.length",
                "3:7 !PCS - Reconciliation #2 - 1 processor",
                "3:8 !PCS - Compute #3 (FStore/%Desc) P1 Reconciliation - parentId=3:7",
                "3:9 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "3:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "3:11 !GET - FStore/root*members.map -> '[Function]'",
                "3:12 !GET - FStore/root*members.length -> 3",
                "3:13 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'", // already exists: no new
                "3:14 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "3:15 !GET - FStore/root*members*0.lastName -> 'Simpson'",
                "3:16 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "3:17 !GET - FStore/root*members*1.firstName -> 'Bart'",
                "3:18 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "3:19 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "3:20 !NEW - O: FStore/Info:root*members*2", // new info item
                "3:21 !GET - FStore/root*members*2.firstName -> 'Marge'",
                "3:22 !GET - FStore/root*members*2.lastName -> 'Simpson'",
                "3:23 !SET - FStore/Info:root*members*2.desc = 'Marge Simpson' (prev: '')",
                "3:24 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "3:25 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:26 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "3:27 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:28 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "3:29 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "3:30 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "3:31 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "3:32 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "3:33 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:34 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "3:35 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:36 !PCS - ArrayUpdate (FStore/root*infos) - parentId=3:8",
                "3:37 !GET - FStore/root*infos.length -> 2",
                "3:38 !SET - FStore/root*infos.2 = '[TRAX FStore/Info:root*members*2]' (prev: undefined)",
                "3:39 !PCE - 3:36",
                "3:40 !PCE - 3:8",
                "3:41 !PCE - 3:7",
            ]);

            expect(printInfos(infos)).toBe("Bart Simpson;Homer Simpson;Marge Simpson");

            await trax.reconciliation(); // to get a new log cycle
            trax.log.info("Size Decrease");
            members.splice(0, 1);

            await trax.reconciliation();

            expect(printLogs(5)).toMatchObject([
                "5:1 !LOG - Size Decrease",
                "5:2 !GET - FStore/root*members.splice -> '[Function]'",
                "5:3 !GET - FStore/root*members.length -> 3",
                "5:4 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "5:5 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "5:6 !SET - FStore/root*members.0 = '[TRAX FStore/root*members*1]' (prev: '[TRAX FStore/root*members*0]')",
                "5:7 !DRT - FStore/%Desc <- FStore/root*members.0",
                "5:8 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "5:9 !SET - FStore/root*members.1 = '[TRAX FStore/root*members*2]' (prev: '[TRAX FStore/root*members*1]')",
                "5:10 !SET - FStore/root*members.length = 2 (prev: 3)",
                "5:11 !PCS - Reconciliation #3 - 1 processor",
                "5:12 !PCS - Compute #4 (FStore/%Desc) P1 Reconciliation - parentId=5:11",
                "5:13 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "5:14 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "5:15 !GET - FStore/root*members.map -> '[Function]'",
                "5:16 !GET - FStore/root*members.length -> 2",
                "5:17 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*1]'",
                "5:18 !GET - FStore/root*members*1.firstName -> 'Bart'",
                "5:19 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "5:20 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*2]'",
                "5:21 !GET - FStore/root*members*2.firstName -> 'Marge'",
                "5:22 !GET - FStore/root*members*2.lastName -> 'Simpson'",
                "5:23 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "5:24 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "5:25 !GET - FStore/Info:root*members*2.desc -> 'Marge Simpson'",
                "5:26 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "5:27 !PCS - ArrayUpdate (FStore/root*infos) - parentId=5:12",
                "5:28 !GET - FStore/root*infos.length -> 3",
                "5:29 !SET - FStore/root*infos.1 = '[TRAX FStore/Info:root*members*2]' (prev: '[TRAX FStore/Info:root*members*0]')",
                "5:30 !SET - FStore/root*infos.2 = undefined (prev: '[TRAX FStore/Info:root*members*2]')",
                "5:31 !GET - FStore/root*infos.splice -> '[Function]'",
                "5:32 !GET - FStore/root*infos.length -> 3",
                "5:33 !GET - FStore/root*infos.2 -> undefined",
                "5:34 !SET - FStore/root*infos.length = 2 (prev: 3)",
                "5:35 !PCE - 5:27",
                "5:36 !PCE - 5:12",
                "5:37 !PCE - 5:11",
            ]);

            expect(printInfos(infos)).toBe("Bart Simpson;Marge Simpson");

            await trax.reconciliation(); // to get a new log cycle
            trax.log.info("Update with no size changes");
            members[1].firstName = "Alex";

            await trax.reconciliation();

            expect(printLogs(7)).toMatchObject([
                "7:1 !LOG - Update with no size changes",
                "7:2 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*2]'",
                "7:3 !SET - FStore/root*members*2.firstName = 'Alex' (prev: 'Marge')",
                "7:4 !DRT - FStore/%Desc <- FStore/root*members*2.firstName",
                "7:5 !PCS - Reconciliation #4 - 1 processor",
                "7:6 !PCS - Compute #5 (FStore/%Desc) P1 Reconciliation - parentId=7:5",
                "7:7 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "7:8 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "7:9 !GET - FStore/root*members.map -> '[Function]'",
                "7:10 !GET - FStore/root*members.length -> 2",
                "7:11 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*1]'",
                "7:12 !GET - FStore/root*members*1.firstName -> 'Bart'",
                "7:13 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "7:14 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*2]'",
                "7:15 !GET - FStore/root*members*2.firstName -> 'Alex'",
                "7:16 !GET - FStore/root*members*2.lastName -> 'Simpson'",
                "7:17 !SET - FStore/Info:root*members*2.desc = 'Alex Simpson' (prev: 'Marge Simpson')",
                "7:18 !GET - FStore/Info:root*members*2.desc -> 'Alex Simpson'",
                "7:19 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "7:20 !GET - FStore/Info:root*members*2.desc -> 'Alex Simpson'",
                "7:21 !GET - FStore/Info:root*members*1.desc -> 'Bart Simpson'",
                "7:22 !PCS - ArrayUpdate (FStore/root*infos) - parentId=7:6",
                "7:23 !GET - FStore/root*infos.length -> 2",
                "7:24 !SET - FStore/root*infos.0 = '[TRAX FStore/Info:root*members*2]' (prev: '[TRAX FStore/Info:root*members*1]')",
                "7:25 !SET - FStore/root*infos.1 = '[TRAX FStore/Info:root*members*1]' (prev: '[TRAX FStore/Info:root*members*2]')",
                "7:26 !PCE - 7:22",
                "7:27 !PCE - 7:6",
                "7:28 !PCE - 7:5",
            ]);

            expect(printInfos(infos)).toBe("Alex Simpson;Bart Simpson");
        });

        it('should compute array from another one (non empty start)', async () => {
            const fs = createFamilyStore(false);
            const family = fs.root;
            const members = family.members;
            const infos = family.infos;

            expect(family.infos?.length).toBe(2);
            await trax.reconciliation();

            expect(printInfos(infos)).toBe("Homer Simpson;Marge Simpson");

            trax.log.info("Size Increase");
            members.push({ firstName: "Bart", lastName: "Simpson" });

            await trax.reconciliation();

            expect(printLogs(1)).toMatchObject([
                "1:1 !GET - FStore/root*infos.map -> '[Function]'",
                "1:2 !GET - FStore/root*infos.length -> 2",
                "1:3 !GET - FStore/root*infos.0 -> '[TRAX FStore/Info:root*members*0]'",
                "1:4 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:5 !GET - FStore/root*infos.1 -> '[TRAX FStore/Info:root*members*1]'",
                "1:6 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:7 !LOG - Size Increase",
                "1:8 !GET - FStore/root*members.push -> '[Function]'",
                "1:9 !GET - FStore/root*members.length -> 2",
                "1:10 !NEW - O: FStore/root*members*2",
                "1:11 !SET - FStore/root*members.2 = '[TRAX FStore/root*members*2]' (prev: undefined)",
                "1:12 !DRT - FStore/%Desc <- FStore/root*members.length",
                "1:13 !PCS - Reconciliation #1 - 1 processor",
                "1:14 !PCS - Compute #2 (FStore/%Desc) P1 Reconciliation - parentId=1:13",
                "1:15 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "1:16 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "1:17 !GET - FStore/root*members.map -> '[Function]'",
                "1:18 !GET - FStore/root*members.length -> 3",
                "1:19 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "1:20 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "1:21 !GET - FStore/root*members*0.lastName -> 'Simpson'",
                "1:22 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "1:23 !GET - FStore/root*members*1.firstName -> 'Marge'",
                "1:24 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "1:25 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "1:26 !NEW - O: FStore/Info:root*members*2",
                "1:27 !GET - FStore/root*members*2.firstName -> 'Bart'",
                "1:28 !GET - FStore/root*members*2.lastName -> 'Simpson'",
                "1:29 !SET - FStore/Info:root*members*2.desc = 'Bart Simpson' (prev: '')",
                "1:30 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:31 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:32 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:33 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:34 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:35 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:36 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:37 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:38 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:39 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:40 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:41 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "1:42 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:43 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:44 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "1:45 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "1:46 !PCS - ArrayUpdate (FStore/root*infos) - parentId=1:14",
                "1:47 !GET - FStore/root*infos.length -> 2",
                "1:48 !SET - FStore/root*infos.0 = '[TRAX FStore/Info:root*members*2]' (prev: '[TRAX FStore/Info:root*members*0]')",
                "1:49 !SET - FStore/root*infos.1 = '[TRAX FStore/Info:root*members*0]' (prev: '[TRAX FStore/Info:root*members*1]')",
                "1:50 !SET - FStore/root*infos.2 = '[TRAX FStore/Info:root*members*1]' (prev: undefined)",
                "1:51 !PCE - 1:46",
                "1:52 !PCE - 1:14",
                "1:53 !PCE - 1:13",
            ]);

            expect(printInfos(infos)).toBe("Bart Simpson;Homer Simpson;Marge Simpson");

            await trax.reconciliation();

            trax.log.info("No changes");
            members[0].firstName = "HOMER";
            members[0].firstName = "Homer"; // revert

            await trax.reconciliation();

            expect(printLogs(3)).toMatchObject([
                "3:1 !LOG - No changes",
                "3:2 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "3:3 !SET - FStore/root*members*0.firstName = 'HOMER' (prev: 'Homer')",
                "3:4 !DRT - FStore/%Desc <- FStore/root*members*0.firstName",
                "3:5 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "3:6 !SET - FStore/root*members*0.firstName = 'Homer' (prev: 'HOMER')",
                "3:7 !PCS - Reconciliation #2 - 1 processor",
                "3:8 !PCS - Compute #3 (FStore/%Desc) P1 Reconciliation - parentId=3:7",
                "3:9 !GET - FStore/root.infos -> '[TRAX FStore/root*infos]'",
                "3:10 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                "3:11 !GET - FStore/root*members.map -> '[Function]'",
                "3:12 !GET - FStore/root*members.length -> 3",
                "3:13 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                "3:14 !GET - FStore/root*members*0.firstName -> 'Homer'",
                "3:15 !GET - FStore/root*members*0.lastName -> 'Simpson'",
                "3:16 !GET - FStore/root*members.1 -> '[TRAX FStore/root*members*1]'",
                "3:17 !GET - FStore/root*members*1.firstName -> 'Marge'",
                "3:18 !GET - FStore/root*members*1.lastName -> 'Simpson'",
                "3:19 !GET - FStore/root*members.2 -> '[TRAX FStore/root*members*2]'",
                "3:20 !GET - FStore/root*members*2.firstName -> 'Bart'",
                "3:21 !GET - FStore/root*members*2.lastName -> 'Simpson'",
                "3:22 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:23 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:24 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:25 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:26 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:27 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:28 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:29 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:30 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:31 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:32 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:33 !GET - FStore/Info:root*members*1.desc -> 'Marge Simpson'",
                "3:34 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:35 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:36 !GET - FStore/Info:root*members*2.desc -> 'Bart Simpson'",
                "3:37 !GET - FStore/Info:root*members*0.desc -> 'Homer Simpson'",
                "3:38 !PCS - ArrayUpdate (FStore/root*infos) - parentId=3:8",
                "3:39 !GET - FStore/root*infos.length -> 3", // No changes
                "3:40 !PCE - 3:38",
                "3:41 !PCE - 3:8",
                "3:42 !PCE - 3:7",
            ]);
        });

        describe('Errors', () => {
            it('should be raised in case of invalid updateArray arguments', async () => {
                trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    store.initRoot({
                        familyName: "Simpson",
                        members: []
                    });
                    let family = store.root;
                    store.compute("Desc", () => {
                        // Compute Misc content from members
                        let infos = family.infos;
                        if (!infos) {
                            // create the array
                            infos = family.infos = [];
                        }
                        let content = family.members.map((m) => {
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            return info;
                        });
                        trax.updateArray(infos, { foo: "bar" } as any);
                    });
                });

                expect(printLogs(0)).toMatchObject([
                    "0:1 !PCS - StoreInit (FStore)",
                    "0:2 !NEW - O: FStore/root",
                    "0:3 !NEW - P: FStore/%Desc",
                    "0:4 !PCS - Compute #1 (FStore/%Desc) P1 Init - parentId=0:1",
                    "0:5 !GET - FStore/root.infos -> undefined",
                    "0:6 !NEW - A: FStore/root*infos",
                    "0:7 !SET - FStore/root.infos = '[TRAX FStore/root*infos]' (prev: undefined)",
                    "0:8 !NEW - A: FStore/root*members",
                    "0:9 !GET - FStore/root.members -> '[TRAX FStore/root*members]'",
                    "0:10 !GET - FStore/root*members.map -> '[Function]'",
                    "0:11 !GET - FStore/root*members.length -> 0",
                    "0:12 !ERR - [TRAX] updateAray: Invalid argument (array expected)",
                    "0:13 !PCE - 0:4",
                    "0:14 !PCE - 0:1",
                ]);
            });

            it('should be raised when a computed array is updates by multiple processors (direct change)', async () => {
                const fs = trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    store.initRoot({
                        familyName: "Simpson",
                        members: [{
                            firstName: "Bart", lastName: "Simpson"
                        }]
                    });
                    let family = store.root;
                    store.compute("Infos", () => {
                        // Compute Misc content from members
                        let infos = family.infos;
                        if (!infos) {
                            // create the array
                            infos = family.infos = [];
                        }
                        let content = family.members.map((m) => {
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            return info;
                        });
                        trax.updateArray(infos, content);
                    });
                });
                const family = fs.root;
                const members = family.members;
                const infos = family.infos;

                expect(printInfos(family.infos)).toBe("Bart Simpson");
                await trax.reconciliation();
                trax.log.info("A");

                // create a new processor
                fs.compute("Invalid", () => {
                    if (members.length) {
                        infos![0] = { desc: "D: " + members[0]?.firstName };
                    }
                });
                await trax.reconciliation();

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !NEW - P: FStore/%Invalid",
                    "1:3 !PCS - Compute #1 (FStore/%Invalid) P2 Init",
                    "1:4 !GET - FStore/root*members.length -> 1",
                    "1:5 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                    "1:6 !GET - FStore/root*members*0.firstName -> 'Bart'",
                    "1:7 !ERR - [TRAX] Computed content conflict: FStore/root*infos.0 can only be set by FStore/%Infos",
                    "1:8 !PCE - 1:3",
                ]);
            });

            it('should be raised when a computed array is updates by multiple processors (updateArray change)', async () => {
                const fs = trax.createStore("FStore", (store: $Store<$ArrayFamilyStore>) => {
                    store.initRoot({
                        familyName: "Simpson",
                        members: [{
                            firstName: "Bart", lastName: "Simpson"
                        }]
                    });
                    let family = store.root;
                    store.compute("Infos", () => {
                        // Compute Misc content from members
                        let infos = family.infos;
                        if (!infos) {
                            // create the array
                            infos = family.infos = [];
                        }
                        let content = family.members.map((m) => {
                            const info = store.add(["Info", m], { desc: "" });
                            info.desc = m.firstName + " " + m.lastName;
                            return info;
                        });
                        trax.updateArray(infos, content);
                    });
                });
                const family = fs.root;
                const members = family.members;
                const infos = family.infos;

                expect(printInfos(family.infos)).toBe("Bart Simpson");
                await trax.reconciliation();
                trax.log.info("A");

                // create a new processor
                fs.compute("Info2", () => {
                    const content: any[] = [];
                    if (members.length) {
                        content.push({ desc: "D: " + members[0]?.firstName });
                    }
                    trax.updateArray(infos!, content);
                });
                await trax.reconciliation();

                expect(printLogs(1)).toMatchObject([
                    "1:1 !LOG - A",
                    "1:2 !NEW - P: FStore/%Info2",
                    "1:3 !PCS - Compute #1 (FStore/%Info2) P2 Init",
                    "1:4 !GET - FStore/root*members.length -> 1",
                    "1:5 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                    "1:6 !GET - FStore/root*members*0.firstName -> 'Bart'",
                    "1:7 !ERR - [TRAX] Computed content conflict: FStore/root*infos can only be changed by FStore/%Infos",
                    "1:8 !PCS - ArrayUpdate (FStore/root*infos) - parentId=1:3",
                    "1:9 !GET - FStore/root*infos.length -> 1",
                    "1:10 !ERR - [TRAX] Computed content conflict: FStore/root*infos.0 can only be set by FStore/%Infos",
                    "1:11 !PCE - 1:8",
                    "1:12 !PCE - 1:3",
                ]);

                fs.delete(fs.get("Infos", true));
                await trax.reconciliation();

                trax.log.info("B");
                members[0].firstName = "Maggie";

                await trax.reconciliation();
                expect(printLogs(3)).toMatchObject([
                    "3:1 !LOG - B",
                    "3:2 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                    "3:3 !SET - FStore/root*members*0.firstName = 'Maggie' (prev: 'Bart')",
                    "3:4 !DRT - FStore/%Info2 <- FStore/root*members*0.firstName",
                    "3:5 !PCS - Reconciliation #1 - 1 processor",
                    "3:6 !PCS - Compute #2 (FStore/%Info2) P2 Reconciliation - parentId=3:5",
                    "3:7 !GET - FStore/root*members.length -> 1",
                    "3:8 !GET - FStore/root*members.0 -> '[TRAX FStore/root*members*0]'",
                    "3:9 !GET - FStore/root*members*0.firstName -> 'Maggie'",
                    "3:10 !PCS - ArrayUpdate (FStore/root*infos) - parentId=3:6",
                    "3:11 !GET - FStore/root*infos.length -> 1",
                    "3:12 !NEW - O: FStore/root*infos*0",
                    "3:13 !SET - FStore/root*infos.0 = '[TRAX FStore/root*infos*0]' (prev: '[TRAX FStore/Info:root*members*0]')",
                    "3:14 !PCE - 3:10",
                    "3:15 !PCE - 3:6",
                    "3:16 !PCE - 3:5",
                ]);

                expect(printInfos(family.infos)).toBe("D: Maggie");
            });
        });
    });

});
