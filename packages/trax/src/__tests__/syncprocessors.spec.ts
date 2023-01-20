import { beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv, traxMD } from '../core';
import { Store, Trax, TraxProcessor } from '../types';
import { Person, SimpleFamilyStore, printEvents, ArrayFamilyStore } from './utils';

describe('Sync Processors', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    interface Values {
        v1: string;
        v2: string;
        v3: string;
    }

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    function createPStore(addPrettyNameProcessor = true) {
        return trax.createStore("PStore", (store: Store<Person>) => {
            const p = store.init({ firstName: "Homer", lastName: "Simpson" });

            if (addPrettyNameProcessor) {
                store.compute("PrettyName", () => {
                    let nm = "";
                    if (p.firstName) {
                        nm = p.firstName + " " + p.lastName;
                    } else {
                        nm = p.lastName;
                    }
                    p.prettyName = nm;
                    p.prettyNameLength = nm.length;
                });
            }
        });
    }

    describe('Compute', () => {
        it('should be able to output non trax values', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "";

            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });

            expect(output).toBe("Homer Simpson");
            expect(pr.autoCompute).toBe(true);
            expect(pr.computeCount).toBe(1);
            expect(pr.dirty).toBe(false);
            expect(pr.priority).toBe(1);

            trax.log.info("-----------------------------");
            p.firstName = "Bart";
            expect(pr.dirty).toBe(true);
            await trax.reconciliation();
            expect(output).toBe("Bart Simpson");
            expect(pr.computeCount).toBe(2);
            expect(pr.dirty).toBe(false);

            trax.log.info("END");

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !PCE - 0:1",
                "0:5 !NEW - P: PStore/%Render",
                "0:6 !PCS - Compute #1 (PStore/%Render) P1 Init",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !PCE - 0:6",
                "0:10 !LOG - -----------------------------",
                "0:11 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "0:12 !DRT - PStore/%Render <- PStore/root.firstName",
                "0:13 !PCS - Reconciliation #1 - 1 processor",
                "0:14 !PCS - Compute #2 (PStore/%Render) P1 Reconciliation - parentId=0:13",
                "0:15 !GET - PStore/root.firstName -> 'Bart'",
                "0:16 !GET - PStore/root.lastName -> 'Simpson'",
                "0:17 !PCE - 0:14",
                "0:18 !PCE - 0:13",
                "1:1 !LOG - END",
            ]);

            expect(pr.dependencies).toMatchObject([
                "PStore/root.firstName",
                "PStore/root.lastName"
            ]);

        });

        it('should support to be forced event if processor is not dirty', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "";
            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });

            expect(output).toBe("Homer Simpson");
            await trax.reconciliation();
            expect(pr.dirty).toBe(false);
            trax.log.info("A");
            pr.compute(); // not exected
            trax.log.info("B");
            pr.compute(true);
            trax.log.info("C");

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - A",
                "1:2 !LOG - B",
                "1:3 !PCS - Compute #2 (PStore/%Render) P1 DirectCall",
                "1:4 !GET - PStore/root.firstName -> 'Homer'",
                "1:5 !GET - PStore/root.lastName -> 'Simpson'",
                "1:6 !PCE - 1:3",
                "1:7 !LOG - C",
            ]);
        });

        it('should support array ids', async () => {
            const ps = trax.createStore(["Some", "Store", 42], (store: Store<Person>) => {
                store.init({ firstName: "Homer", lastName: "Simpson" });
            });

            expect(ps.id).toBe("Some:Store:42");
            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (Some:Store:42)",
                "0:2 !NEW - S: Some:Store:42",
                "0:3 !NEW - O: Some:Store:42/root",
                "0:4 !PCE - 0:1",
            ]);
        });

        it('should return processors that have already been created', async () => {
            const ps = createPStore();
            const pr = ps.compute("PrettyName", () => {
                // do something here - not called as the previous processor will be used for this id
            });

            expect(typeof pr.compute).toBe("function");

            ps.root.firstName = "Bart";
            await trax.reconciliation();
            expect(ps.root.prettyName).toBe("Bart Simpson");

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%PrettyName",
                "0:5 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Homer'",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !SET - PStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:10 !SET - PStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:11 !PCE - 0:5",
                "0:12 !PCE - 0:1",
                "0:13 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "0:14 !DRT - PStore/%PrettyName <- PStore/root.firstName",
                "0:15 !PCS - Reconciliation #1 - 1 processor",
                "0:16 !PCS - Compute #2 (PStore/%PrettyName) P1 Reconciliation - parentId=0:15",
                "0:17 !GET - PStore/root.firstName -> 'Bart'",
                "0:18 !GET - PStore/root.firstName -> 'Bart'",
                "0:19 !GET - PStore/root.lastName -> 'Simpson'",
                "0:20 !SET - PStore/root.prettyName = 'Bart Simpson' (prev: 'Homer Simpson')",
                "0:21 !SET - PStore/root.prettyNameLength = 12 (prev: 13)",
                "0:22 !PCE - 0:16",
                "0:23 !PCE - 0:15",
                "1:1 !GET - PStore/root.prettyName -> 'Bart Simpson'",
            ]);
        });

        it('should support manual compute and onDirty callbacks', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "", onDirtyCount = 0;

            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            }, false);

            pr.onDirty = () => {
                onDirtyCount++;
            }

            expect(pr.dirty).toBe(true);
            expect(onDirtyCount).toBe(0);
            expect(pr.autoCompute).toBe(false);
            expect(output).toBe(""); // not computed
            expect(pr.computeCount).toBe(0);

            trax.log.info("A");
            await trax.reconciliation();

            expect(pr.dirty).toBe(true);
            expect(output).toBe("");
            pr.compute();
            expect(output).toBe("Homer Simpson");
            expect(pr.dirty).toBe(false);
            expect(pr.computeCount).toBe(1);
            expect(onDirtyCount).toBe(0);

            trax.log.info("B");
            await trax.reconciliation();
            p.firstName = "Bart";
            expect(onDirtyCount).toBe(1);
            p.lastName = "SIMPSON";
            expect(onDirtyCount).toBe(1);
            expect(pr.dirty).toBe(true);
            expect(pr.computeCount).toBe(1);

            pr.compute();
            expect(output).toBe("Bart SIMPSON");
            expect(pr.dirty).toBe(false);
            expect(pr.computeCount).toBe(2);

            p.firstName = "BART";
            expect(onDirtyCount).toBe(2);
            expect(pr.dirty).toBe(true);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !PCE - 0:1",
                "0:5 !NEW - P: PStore/%Render",
                "0:6 !LOG - A",
                "1:1 !PCS - Compute #1 (PStore/%Render) P1 DirectCall",
                "1:2 !GET - PStore/root.firstName -> 'Homer'",
                "1:3 !GET - PStore/root.lastName -> 'Simpson'",
                "1:4 !PCE - 1:1",
                "1:5 !LOG - B",
                "2:1 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "2:2 !DRT - PStore/%Render <- PStore/root.firstName",
                "2:3 !SET - PStore/root.lastName = 'SIMPSON' (prev: 'Simpson')",
                "2:4 !PCS - Compute #2 (PStore/%Render) P1 DirectCall",
                "2:5 !GET - PStore/root.firstName -> 'Bart'",
                "2:6 !GET - PStore/root.lastName -> 'SIMPSON'",
                "2:7 !PCE - 2:4",
                "2:8 !SET - PStore/root.firstName = 'BART' (prev: 'Bart')",
                "2:9 !DRT - PStore/%Render <- PStore/root.firstName",
            ]);
        });

        it('should support auto compute and onDirty callbacks', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "", onDirtyCount = 0;

            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });

            pr.onDirty = () => {
                onDirtyCount++;
            }

            expect(pr.dirty).toBe(false);
            expect(onDirtyCount).toBe(0);
            expect(pr.autoCompute).toBe(true);
            expect(output).toBe("Homer Simpson");
            expect(pr.computeCount).toBe(1);

            trax.log.info("A");
            await trax.reconciliation();

            expect(pr.dirty).toBe(false);
            pr.compute(); // no effect
            expect(output).toBe("Homer Simpson");
            expect(pr.dirty).toBe(false);
            expect(pr.computeCount).toBe(1);
            expect(onDirtyCount).toBe(0);

            trax.log.info("B");
            await trax.reconciliation();
            p.firstName = "Bart";
            expect(onDirtyCount).toBe(1);
            p.lastName = "SIMPSON";
            expect(onDirtyCount).toBe(1);
            expect(pr.dirty).toBe(true);
            expect(pr.computeCount).toBe(1);

            trax.log.info("C");
            await trax.reconciliation();
            expect(output).toBe("Bart SIMPSON");
            expect(pr.dirty).toBe(false);
            expect(pr.computeCount).toBe(2);
            expect(onDirtyCount).toBe(1);

            trax.log.info("D");
            p.firstName = "BART";
            expect(onDirtyCount).toBe(2);
            expect(pr.dirty).toBe(true);

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !PCE - 0:1",
                "0:5 !NEW - P: PStore/%Render",
                "0:6 !PCS - Compute #1 (PStore/%Render) P1 Init",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !PCE - 0:6",
                "0:10 !LOG - A",
                "1:1 !LOG - B",
                "2:1 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "2:2 !DRT - PStore/%Render <- PStore/root.firstName",
                "2:3 !SET - PStore/root.lastName = 'SIMPSON' (prev: 'Simpson')",
                "2:4 !LOG - C",
                "2:5 !PCS - Reconciliation #1 - 1 processor",
                "2:6 !PCS - Compute #2 (PStore/%Render) P1 Reconciliation - parentId=2:5",
                "2:7 !GET - PStore/root.firstName -> 'Bart'",
                "2:8 !GET - PStore/root.lastName -> 'SIMPSON'",
                "2:9 !PCE - 2:6",
                "2:10 !PCE - 2:5",
                "3:1 !LOG - D",
                "3:2 !SET - PStore/root.firstName = 'BART' (prev: 'Bart')",
                "3:3 !DRT - PStore/%Render <- PStore/root.firstName",
            ]);
        });

        it('should support conditional processing', async () => {
            const ps = createPStore();
            const p = ps.root;

            expect(p.prettyName).toBe("Homer Simpson");
            p.firstName = "";
            expect(p.prettyName).toBe("Homer Simpson");
            await trax.reconciliation();
            expect(p.prettyName).toBe("Simpson");


            trax.log.info("A");
            const ccp = trax.reconciliation();

            p.firstName = "Bart";
            p.lastName = "S";
            await ccp;
            expect(p.prettyName).toBe("Bart S");

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%PrettyName",
                "0:5 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Homer'",
                "0:7 !GET - PStore/root.firstName -> 'Homer'", // read twice in the processor
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !SET - PStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:10 !SET - PStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:11 !PCE - 0:5",
                "0:12 !PCE - 0:1",
                "0:13 !GET - PStore/root.prettyName -> 'Homer Simpson'",
                "0:14 !SET - PStore/root.firstName = '' (prev: 'Homer')",
                "0:15 !DRT - PStore/%PrettyName <- PStore/root.firstName",
                "0:16 !GET - PStore/root.prettyName -> 'Homer Simpson'",
                "0:17 !PCS - Reconciliation #1 - 1 processor",
                "0:18 !PCS - Compute #2 (PStore/%PrettyName) P1 Reconciliation - parentId=0:17",
                "0:19 !GET - PStore/root.firstName -> ''",
                "0:20 !GET - PStore/root.lastName -> 'Simpson'",
                "0:21 !SET - PStore/root.prettyName = 'Simpson' (prev: 'Homer Simpson')",
                "0:22 !SET - PStore/root.prettyNameLength = 7 (prev: 13)",
                "0:23 !PCE - 0:18",
                "0:24 !PCE - 0:17",
                "1:1 !GET - PStore/root.prettyName -> 'Simpson'",
                "1:2 !LOG - A",
                "1:3 !SET - PStore/root.firstName = 'Bart' (prev: '')",
                "1:4 !DRT - PStore/%PrettyName <- PStore/root.firstName",
                "1:5 !SET - PStore/root.lastName = 'S' (prev: 'Simpson')",
                "1:6 !PCS - Reconciliation #2 - 1 processor",
                "1:7 !PCS - Compute #3 (PStore/%PrettyName) P1 Reconciliation - parentId=1:6",
                "1:8 !GET - PStore/root.firstName -> 'Bart'",
                "1:9 !GET - PStore/root.firstName -> 'Bart'",
                "1:10 !GET - PStore/root.lastName -> 'S'",
                "1:11 !SET - PStore/root.prettyName = 'Bart S' (prev: 'Simpson')",
                "1:12 !SET - PStore/root.prettyNameLength = 6 (prev: 7)",
                "1:13 !PCE - 1:7",
                "1:14 !PCE - 1:6",
                "2:1 !GET - PStore/root.prettyName -> 'Bart S'",
            ]);
        });

        it('should support conditional processing and clean previous listeners (multiple objects)', async () => {
            const fs = trax.createStore("FStore", (s: Store<ArrayFamilyStore>) => {
                const data = s.init({
                    familyName: "",
                    members: [
                        { firstName: "Homer", lastName: "Simpson" },
                        { firstName: "Marge", lastName: "Simpson" }
                    ]
                });

                s.compute("Names", () => {
                    // display even or odd names depending on the members length
                    const members = data.members;
                    const len = members.length;
                    const arr: string[] = [];
                    for (let i = len % 2; i < len; i += 2) {
                        arr.push(members[i].firstName);
                    }
                    data.names = arr.join(", ");
                });
            });

            const data = fs.root;
            const members = data.members;
            const namesPr = fs.getProcessor("Names")!;
            expect(data.names).toBe("Homer");
            expect(hasListener(members[0], namesPr)).toBe(true);
            expect(hasListener(members[1], namesPr)).toBe(false);

            await trax.reconciliation();
            trax.log.info("A");
            members.push({ firstName: "Bart", lastName: "Simpson" });
            trax.processChanges();
            expect(data.names).toBe("Marge");
            expect(hasListener(members[0], namesPr)).toBe(false);
            expect(hasListener(members[1], namesPr)).toBe(true);
            expect(hasListener(members[2], namesPr)).toBe(false);

            members.push({ firstName: "Lisa", lastName: "Simpson" });
            trax.processChanges();
            expect(data.names).toBe("Homer, Bart");
            expect(hasListener(members[0], namesPr)).toBe(true);
            expect(hasListener(members[1], namesPr)).toBe(false);
            expect(hasListener(members[2], namesPr)).toBe(true);
            expect(hasListener(members[3], namesPr)).toBe(false);

            function hasListener(o: any, pr: TraxProcessor) {
                return (o[traxMD].propListeners as Set<TraxProcessor>)?.has(pr) || false;
            }
        });

        it('should support dependencies from multiple objects and auto-wrap objects set as JSON', async () => {
            const fst = trax.createStore("SimpleFamilyStore", (store: Store<SimpleFamilyStore>) => {
                store.init({
                    father: {
                        firstName: "Homer",
                        lastName: "Simpson"
                    }
                });
            });
            const family = fst.root;

            await trax.reconciliation(); // skip first cycle

            fst.root.child1 = fst.add<Person>("Bart", {
                firstName: "Bart",
                lastName: "Simpson"
            });

            fst.root.child2 = fst.add<Person>("Lisa", {
                firstName: "Lisa",
                lastName: "Simpson"
            });

            fst.compute("ChildNames", () => {
                const names: string[] = [];
                for (const nm of ["child1", "child2", "child3"]) {
                    const child = family[nm] as Person;
                    if (child) {
                        names.push(child.firstName);
                    }
                }
                family.childNames = names.join(", ");
            });

            expect(family.childNames).toBe("Bart, Lisa");

            family.child3 = { // will be automatically wrapped
                firstName: "Maggie",
                lastName: "Simpson"
            }

            expect(family.childNames).toBe("Bart, Lisa"); // not reprocessed yet
            await trax.reconciliation();

            expect(family.childNames).toBe("Bart, Lisa, Maggie");


            expect(printLogs(1)).toMatchObject([
                "1:1 !NEW - O: SimpleFamilyStore/Bart",
                "1:2 !SET - SimpleFamilyStore/root.child1 = '[TRAX SimpleFamilyStore/Bart]' (prev: undefined)",
                "1:3 !NEW - O: SimpleFamilyStore/Lisa",
                "1:4 !SET - SimpleFamilyStore/root.child2 = '[TRAX SimpleFamilyStore/Lisa]' (prev: undefined)",
                "1:5 !NEW - P: SimpleFamilyStore/%ChildNames",
                "1:6 !PCS - Compute #1 (SimpleFamilyStore/%ChildNames) P1 Init",
                "1:7 !GET - SimpleFamilyStore/root.child1 -> '[TRAX SimpleFamilyStore/Bart]'",
                "1:8 !GET - SimpleFamilyStore/Bart.firstName -> 'Bart'",
                "1:9 !GET - SimpleFamilyStore/root.child2 -> '[TRAX SimpleFamilyStore/Lisa]'",
                "1:10 !GET - SimpleFamilyStore/Lisa.firstName -> 'Lisa'",
                "1:11 !GET - SimpleFamilyStore/root.child3 -> undefined",
                "1:12 !SET - SimpleFamilyStore/root.childNames = 'Bart, Lisa' (prev: undefined)",
                "1:13 !PCE - 1:6",
                "1:14 !GET - SimpleFamilyStore/root.childNames -> 'Bart, Lisa'",
                "1:15 !NEW - O: SimpleFamilyStore/root*child3",
                "1:16 !SET - SimpleFamilyStore/root.child3 = '[TRAX SimpleFamilyStore/root*child3]' (prev: undefined)",
                "1:17 !DRT - SimpleFamilyStore/%ChildNames <- SimpleFamilyStore/root.child3",
                "1:18 !GET - SimpleFamilyStore/root.childNames -> 'Bart, Lisa'",
                "1:19 !PCS - Reconciliation #1 - 1 processor",
                "1:20 !PCS - Compute #2 (SimpleFamilyStore/%ChildNames) P1 Reconciliation - parentId=1:19",
                "1:21 !GET - SimpleFamilyStore/root.child1 -> '[TRAX SimpleFamilyStore/Bart]'",
                "1:22 !GET - SimpleFamilyStore/Bart.firstName -> 'Bart'",
                "1:23 !GET - SimpleFamilyStore/root.child2 -> '[TRAX SimpleFamilyStore/Lisa]'",
                "1:24 !GET - SimpleFamilyStore/Lisa.firstName -> 'Lisa'",
                "1:25 !GET - SimpleFamilyStore/root.child3 -> '[TRAX SimpleFamilyStore/root*child3]'",
                "1:26 !GET - SimpleFamilyStore/root*child3.firstName -> 'Maggie'",
                "1:27 !SET - SimpleFamilyStore/root.childNames = 'Bart, Lisa, Maggie' (prev: 'Bart, Lisa')",
                "1:28 !PCE - 1:20",
                "1:29 !PCE - 1:19",
                "2:1 !GET - SimpleFamilyStore/root.childNames -> 'Bart, Lisa, Maggie'",
            ]);
        });

        it('should create processors that can be retrieved throug store.get()', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "";

            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });

            let prg = ps.get("Render");
            expect(prg).toBe(undefined);
            prg = ps.getProcessor("Render")!;
            expect(prg).toBe(pr);

            prg = ps.getProcessor("Render2");
            expect(prg).toBe(undefined);
        });

        it('should support multiple parallel processors with imbalanded branches', async () => {
            interface ValueObject {
                value: string;
            }
            interface ValueSet {
                v0: ValueObject;
                v1: ValueObject;
                v2: ValueObject;
                v3: ValueObject;
                v4: ValueObject;
                v5: ValueObject;
            }

            const st = trax.createStore("PStore", (store: Store<ValueSet>) => {
                const v = store.init({
                    v0: { value: "v0initValue" },
                    v1: { value: "v1initValue" },
                    v2: { value: "v2initValue" },
                    v3: { value: "v3initValue" },
                    v4: { value: "v4initValue" },
                    v5: { value: "v5initValue" },
                });

                const v0 = v.v0;
                const v1 = v.v1;
                const v2 = v.v2;
                const v3 = v.v3;
                const v4 = v.v4;
                const v5 = v.v5;

                // v0 -> P1 -> v1 -> P3 -> v3 -> P4 -> v4 -> P5 -> v5
                //    -> P2 -> v2 -------------------------> P5 -> v5
                store.compute("P1", () => {
                    v1.value = `P1(${v0.value})`;
                })

                store.compute("P2", () => {
                    v2.value = `P2(${v0.value})`;
                });

                store.compute("P3", () => {
                    v3.value = `P3(${v1.value})`;
                });

                store.compute("P4", () => {
                    v4.value = `P4(${v3.value})`;
                });

                store.compute("P5", () => {
                    v5.value = `P5(${v4.value}+${v2.value})`;
                });
            });

            const v = st.root;

            expect(v.v5.value).toBe("P5(P4(P3(P1(v0initValue)))+P2(v0initValue))");

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - O: PStore/root*v0",
                "0:5 !GET - PStore/root.v0 -> '[TRAX PStore/root*v0]'",
                "0:6 !NEW - O: PStore/root*v1",
                "0:7 !GET - PStore/root.v1 -> '[TRAX PStore/root*v1]'",
                "0:8 !NEW - O: PStore/root*v2",
                "0:9 !GET - PStore/root.v2 -> '[TRAX PStore/root*v2]'",
                "0:10 !NEW - O: PStore/root*v3",
                "0:11 !GET - PStore/root.v3 -> '[TRAX PStore/root*v3]'",
                "0:12 !NEW - O: PStore/root*v4",
                "0:13 !GET - PStore/root.v4 -> '[TRAX PStore/root*v4]'",
                "0:14 !NEW - O: PStore/root*v5",
                "0:15 !GET - PStore/root.v5 -> '[TRAX PStore/root*v5]'",
                "0:16 !NEW - P: PStore/%P1",
                "0:17 !PCS - Compute #1 (PStore/%P1) P1 Init - parentId=0:1",
                "0:18 !GET - PStore/root*v0.value -> 'v0initValue'",
                "0:19 !SET - PStore/root*v1.value = 'P1(v0initValue)' (prev: 'v1initValue')",
                "0:20 !PCE - 0:17",
                "0:21 !NEW - P: PStore/%P2",
                "0:22 !PCS - Compute #1 (PStore/%P2) P2 Init - parentId=0:1",
                "0:23 !GET - PStore/root*v0.value -> 'v0initValue'",
                "0:24 !SET - PStore/root*v2.value = 'P2(v0initValue)' (prev: 'v2initValue')",
                "0:25 !PCE - 0:22",
                "0:26 !NEW - P: PStore/%P3",
                "0:27 !PCS - Compute #1 (PStore/%P3) P3 Init - parentId=0:1",
                "0:28 !GET - PStore/root*v1.value -> 'P1(v0initValue)'",
                "0:29 !SET - PStore/root*v3.value = 'P3(P1(v0initValue))' (prev: 'v3initValue')",
                "0:30 !PCE - 0:27",
                "0:31 !NEW - P: PStore/%P4",
                "0:32 !PCS - Compute #1 (PStore/%P4) P4 Init - parentId=0:1",
                "0:33 !GET - PStore/root*v3.value -> 'P3(P1(v0initValue))'",
                "0:34 !SET - PStore/root*v4.value = 'P4(P3(P1(v0initValue)))' (prev: 'v4initValue')",
                "0:35 !PCE - 0:32",
                "0:36 !NEW - P: PStore/%P5",
                "0:37 !PCS - Compute #1 (PStore/%P5) P5 Init - parentId=0:1",
                "0:38 !GET - PStore/root*v4.value -> 'P4(P3(P1(v0initValue)))'",
                "0:39 !GET - PStore/root*v2.value -> 'P2(v0initValue)'",
                "0:40 !SET - PStore/root*v5.value = 'P5(P4(P3(P1(v0initValue)))+P2(v0initValue))' (prev: 'v5initValue')",
                "0:41 !PCE - 0:37",
                "0:42 !PCE - 0:1",
                "0:43 !GET - PStore/root.v5 -> '[TRAX PStore/root*v5]'",
                "0:44 !GET - PStore/root*v5.value -> 'P5(P4(P3(P1(v0initValue)))+P2(v0initValue))'",
            ]);

            await trax.reconciliation();
            trax.log.info("-----------------")
            v.v0.value = "NEWV0";
            await trax.reconciliation();

            expect(v.v5.value).toBe("P5(P4(P3(P1(NEWV0)))+P2(NEWV0))");

            expect(printLogs(1)).toMatchObject([
                "1:1 !LOG - -----------------",
                "1:2 !GET - PStore/root.v0 -> '[TRAX PStore/root*v0]'",
                "1:3 !SET - PStore/root*v0.value = 'NEWV0' (prev: 'v0initValue')",
                "1:4 !DRT - PStore/%P1 <- PStore/root*v0.value",
                "1:5 !DRT - PStore/%P2 <- PStore/root*v0.value",
                "1:6 !PCS - Reconciliation #1 - 5 processors",
                "1:7 !PCS - Compute #2 (PStore/%P1) P1 Reconciliation - parentId=1:6",
                "1:8 !GET - PStore/root*v0.value -> 'NEWV0'",
                "1:9 !SET - PStore/root*v1.value = 'P1(NEWV0)' (prev: 'P1(v0initValue)')",
                "1:10 !DRT - PStore/%P3 <- PStore/root*v1.value",
                "1:11 !PCE - 1:7",
                "1:12 !PCS - Compute #2 (PStore/%P2) P2 Reconciliation - parentId=1:6",
                "1:13 !GET - PStore/root*v0.value -> 'NEWV0'",
                "1:14 !SET - PStore/root*v2.value = 'P2(NEWV0)' (prev: 'P2(v0initValue)')",
                "1:15 !DRT - PStore/%P5 <- PStore/root*v2.value",
                "1:16 !PCE - 1:12",
                "1:17 !PCS - Compute #2 (PStore/%P3) P3 Reconciliation - parentId=1:6",
                "1:18 !GET - PStore/root*v1.value -> 'P1(NEWV0)'",
                "1:19 !SET - PStore/root*v3.value = 'P3(P1(NEWV0))' (prev: 'P3(P1(v0initValue))')",
                "1:20 !DRT - PStore/%P4 <- PStore/root*v3.value",
                "1:21 !PCE - 1:17",
                "1:22 !PCS - Compute #2 (PStore/%P4) P4 Reconciliation - parentId=1:6",
                "1:23 !GET - PStore/root*v3.value -> 'P3(P1(NEWV0))'",
                "1:24 !SET - PStore/root*v4.value = 'P4(P3(P1(NEWV0)))' (prev: 'P4(P3(P1(v0initValue)))')",
                "1:25 !PCE - 1:22",
                "1:26 !PCS - Compute #2 (PStore/%P5) P5 Reconciliation - parentId=1:6",
                "1:27 !GET - PStore/root*v4.value -> 'P4(P3(P1(NEWV0)))'",
                "1:28 !GET - PStore/root*v2.value -> 'P2(NEWV0)'",
                "1:29 !SET - PStore/root*v5.value = 'P5(P4(P3(P1(NEWV0)))+P2(NEWV0))' (prev: 'P5(P4(P3(P1(v0initValue)))+P2(v0initValue))')",
                "1:30 !PCE - 1:26",
                "1:31 !PCE - 1:6",
                "2:1 !GET - PStore/root.v5 -> '[TRAX PStore/root*v5]'",
                "2:2 !GET - PStore/root*v5.value -> 'P5(P4(P3(P1(NEWV0)))+P2(NEWV0))'",
            ]);

            // TODO: dispose store and check that processor count is back to 0
        });

        it('should support multiple parallel processors and dispose', async () => {
            const st = trax.createStore("PStore", (store: Store<Values>) => {
                const v = store.init({
                    v1: "A",
                    v2: "B",
                    v3: "C",
                });

                store.compute("P1", () => {
                    v.v2 = "P1(" + v.v1 + ")";
                });
                store.compute("P2", () => {
                    v.v3 = "P2(" + v.v1 + ")";
                });
            });
            const v = st.root;
            const p1 = st.getProcessor("P1")!;
            const p2 = st.getProcessor("P2")!;

            await trax.reconciliation();
            expect(v.v2).toBe("P1(A)");
            expect(v.v3).toBe("P2(A)");
            expect(p1.dependencies).toMatchObject([
                "PStore/root.v1",
            ]);

            v.v1 = "X";
            await trax.reconciliation();
            expect(v.v2).toBe("P1(X)");
            expect(v.v3).toBe("P2(X)");

            p1.dispose();
            expect(p1.dependencies).toMatchObject([]);

            v.v1 = "Y";
            await trax.reconciliation();
            expect(v.v2).toBe("P1(X)");
            expect(v.v3).toBe("P2(Y)");

            p2.dispose();

            v.v1 = "Z";
            await trax.reconciliation();
            expect(v.v2).toBe("P1(X)");
            expect(v.v3).toBe("P2(Y)");
        });

        it('should allow to create renderer processors', async () => {
            const ps = createPStore();
            const p = ps.root;

            let output = "";
            const r = ps.compute("Render", () => {
                if ((p as any).then === undefined) {
                    // this test is to ensure dependencies on then are not logged
                    output = p.firstName + " " + p.lastName;
                }
            }, false, true);

            expect(ps.getProcessor("PrettyName")!.isRenderer).toBe(false);
            expect(r.isRenderer).toBe(true);
            r.compute();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%PrettyName",
                "0:5 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Homer'",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !SET - PStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:10 !SET - PStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:11 !PCE - 0:5",
                "0:12 !PCE - 0:1",
                "0:13 !NEW - P: PStore/%Render",
                "0:14 !PCS - Compute #1 (PStore/%Render) P2 DirectCall R",
                "0:15 !GET - PStore/root.firstName -> 'Homer'",
                "0:16 !GET - PStore/root.lastName -> 'Simpson'",
                "0:17 !PCE - 0:14",
            ]);
            expect(output).toBe("Homer Simpson");
        });

        it('should support processors with dependencies on different stores', async () => {
            const ps = trax.createStore("PStore", (s: Store<Person>) => {
                s.init({ firstName: "Homer", lastName: "Simpson" });
            });
            const main = ps.root;

            const fs = trax.createStore("FStore", (s: Store<ArrayFamilyStore>) => {
                const data = s.init({
                    familyName: "",
                    members: [
                        { firstName: "Homer", lastName: "Simpson" },
                        { firstName: "Marge", lastName: "Simpson" }
                    ]
                });

                s.compute("Names", () => {
                    // display even or odd names depending on the members length
                    const members = data.members;
                    data.names = members.map((m) => {
                        return (m.firstName === main.firstName) ? "MAIN" : m.firstName;
                    }).join(", ");
                });
            });

            const data = fs.root;
            const namesPr = fs.getProcessor("Names")!;

            expect(data.names).toBe("MAIN, Marge");
            main.firstName = "Marge";
            trax.processChanges();
            expect(data.names).toBe("Homer, MAIN");

            await trax.reconciliation(); // move to next cycle
            trax.log.info("A");

            // disposing the main store will not trigger a change in namesPr
            // this has to be managed manually
            expect(namesPr.dirty).toBe(false);
            ps.dispose();
            expect(namesPr.dirty).toBe(false);
        });
    });

    describe('Dispose', () => {
        it('should support deletion through dispose()', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "";
            let pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });

            await trax.reconciliation();
            expect(output).toBe("Homer Simpson");
            p.firstName = "Bart";
            await trax.reconciliation();
            expect(output).toBe("Bart Simpson");
            p.firstName = "Maggie"; // dirty

            expect(ps.getProcessor("Render")).toBe(pr);
            expect(trax.getProcessor("PStore/%Render")).toBe(pr);
            expect(pr.disposed).toBe(false);
            let r = pr.dispose(); // deleted while dirty
            expect(r).toBe(true);
            expect(pr.disposed).toBe(true);
            expect(ps.getProcessor("Render")).toBe(undefined);
            expect(trax.getProcessor("PStore/%Render")).toBe(undefined);

            r = pr.dispose();
            expect(r).toBe(false);
            trax.log.info("Delete complete");

            trax.log.info("Before Change");
            p.firstName = "Lisa";
            trax.log.info("After Change");
            await trax.reconciliation();
            expect(output).toBe("Bart Simpson"); // No changes
            await trax.reconciliation();

            // create again
            pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            });
            expect(ps.getProcessor("Render")).toBe(pr);
            expect(trax.getProcessor("PStore/%Render")).toBe(pr);
            expect(output).toBe("Lisa Simpson");
            await trax.reconciliation();

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !PCE - 0:1",
                "0:5 !NEW - P: PStore/%Render",
                "0:6 !PCS - Compute #1 (PStore/%Render) P1 Init",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !PCE - 0:6",
                "1:1 !SET - PStore/root.firstName = 'Bart' (prev: 'Homer')",
                "1:2 !DRT - PStore/%Render <- PStore/root.firstName",
                "1:3 !PCS - Reconciliation #1 - 1 processor", // 1 active processor
                "1:4 !PCS - Compute #2 (PStore/%Render) P1 Reconciliation - parentId=1:3",
                "1:5 !GET - PStore/root.firstName -> 'Bart'",
                "1:6 !GET - PStore/root.lastName -> 'Simpson'",
                "1:7 !PCE - 1:4",
                "1:8 !PCE - 1:3",
                "2:1 !SET - PStore/root.firstName = 'Maggie' (prev: 'Bart')",
                "2:2 !DRT - PStore/%Render <- PStore/root.firstName",
                "2:3 !DEL - P: PStore/%Render",
                "2:4 !LOG - Delete complete",
                "2:5 !LOG - Before Change",
                "2:6 !SET - PStore/root.firstName = 'Lisa' (prev: 'Maggie')",
                "2:7 !LOG - After Change",
                "2:8 !PCS - Reconciliation #2 - 0 processors", // no more active processor
                "2:9 !PCE - 2:8",
                "3:1 !NEW - P: PStore/%Render",
                "3:2 !PCS - Compute #1 (PStore/%Render) P2 Init",
                "3:3 !GET - PStore/root.firstName -> 'Lisa'",
                "3:4 !GET - PStore/root.lastName -> 'Simpson'",
                "3:5 !PCE - 3:2",
            ]);
        });

        // TODO dispose dependency -> trigger processor dirty
    });

    describe('Errors', () => {
        it('should raise an error in case of compute error', async () => {
            const ps = createPStore(false);
            const p = ps.root;
            await trax.reconciliation();

            let pr = ps.compute("Render", () => {
                let x = p.firstName;
                throw Error("Unexpected error");
            });

            expect(printLogs(1)).toMatchObject([
                "1:1 !NEW - P: PStore/%Render",
                "1:2 !PCS - Compute #1 (PStore/%Render) P1 Init",
                "1:3 !GET - PStore/root.firstName -> 'Homer'",
                "1:4 !ERR - [TRAX] (PStore/%Render) Compute error: Error: Unexpected error",
                "1:5 !PCE - 1:2",
            ]);
        });

        it('should raise an error in case of onDirty callback error', async () => {
            const ps = createPStore(false);
            const p = ps.root;

            let output = "";
            const pr = ps.compute("Render", () => {
                output = p.firstName + " " + p.lastName;
            }, false);

            pr.onDirty = () => {
                throw Error("[onDirty] Unexpected error");
            }
            await trax.reconciliation();

            expect(pr.dirty).toBe(true);
            expect(pr.autoCompute).toBe(false);
            pr.compute();

            trax.log.info("A");
            p.firstName = "Lisa"; // will trigger error
            trax.log.info("B");

            expect(printLogs(1)).toMatchObject([
                "1:1 !PCS - Compute #1 (PStore/%Render) P1 DirectCall",
                "1:2 !GET - PStore/root.firstName -> 'Homer'",
                "1:3 !GET - PStore/root.lastName -> 'Simpson'",
                "1:4 !PCE - 1:1",
                "1:5 !LOG - A",
                "1:6 !SET - PStore/root.firstName = 'Lisa' (prev: 'Homer')",
                "1:7 !DRT - PStore/%Render <- PStore/root.firstName",
                "1:8 !ERR - [TRAX] (PStore/%Render) onDirty callback execution error: Error: [onDirty] Unexpected error",
                "1:9 !LOG - B",
            ]);
        });

        it('should raise an error if 2 processors try to compute the same property', async () => {
            const ps = createPStore();

            await trax.reconciliation();
            ps.compute("PrettyName2", () => {
                const p = ps.root;
                p.prettyName = p.firstName;
            });
            trax.log.info("DONE");

            expect(printLogs()).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%PrettyName",
                "0:5 !PCS - Compute #1 (PStore/%PrettyName) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.firstName -> 'Homer'",
                "0:7 !GET - PStore/root.firstName -> 'Homer'",
                "0:8 !GET - PStore/root.lastName -> 'Simpson'",
                "0:9 !SET - PStore/root.prettyName = 'Homer Simpson' (prev: undefined)",
                "0:10 !SET - PStore/root.prettyNameLength = 13 (prev: undefined)",
                "0:11 !PCE - 0:5",
                "0:12 !PCE - 0:1",
                "1:1 !NEW - P: PStore/%PrettyName2",
                "1:2 !PCS - Compute #1 (PStore/%PrettyName2) P2 Init",
                "1:3 !GET - PStore/root.firstName -> 'Homer'",
                "1:4 !ERR - [TRAX] Computed property conflict: PStore/root.prettyName can only be set by PStore/%PrettyName",
                "1:5 !PCE - 1:2",
                "1:6 !LOG - DONE",

            ]);
        });

        it('should detect circular dependencies', async () => {

            const st = trax.createStore("PStore", (store: Store<Values>) => {
                const v = store.init({
                    v1: "A",
                    v2: "B",
                    v3: "C",
                });

                store.compute("P1", () => {
                    v.v2 = "P1(" + v.v1 + ")";
                });
                store.compute("P2", () => {
                    v.v3 = "P2(" + v.v2 + ")";
                });
                store.compute("P3", () => {
                    v.v1 = "P3(" + v.v3 + ")";
                });
            });

            await trax.reconciliation();

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%P1",
                "0:5 !PCS - Compute #1 (PStore/%P1) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.v1 -> 'A'",
                "0:7 !SET - PStore/root.v2 = 'P1(A)' (prev: 'B')",
                "0:8 !PCE - 0:5",
                "0:9 !NEW - P: PStore/%P2",
                "0:10 !PCS - Compute #1 (PStore/%P2) P2 Init - parentId=0:1",
                "0:11 !GET - PStore/root.v2 -> 'P1(A)'",
                "0:12 !SET - PStore/root.v3 = 'P2(P1(A))' (prev: 'C')",
                "0:13 !PCE - 0:10",
                "0:14 !NEW - P: PStore/%P3",
                "0:15 !PCS - Compute #1 (PStore/%P3) P3 Init - parentId=0:1",
                "0:16 !GET - PStore/root.v3 -> 'P2(P1(A))'",
                "0:17 !SET - PStore/root.v1 = 'P3(P2(P1(A)))' (prev: 'A')",
                "0:18 !DRT - PStore/%P1 <- PStore/root.v1",
                "0:19 !PCE - 0:15",
                "0:20 !PCE - 0:1",
                "0:21 !PCS - Reconciliation #1 - 3 processors",
                "0:22 !PCS - Compute #2 (PStore/%P1) P1 Reconciliation - parentId=0:21",
                "0:23 !GET - PStore/root.v1 -> 'P3(P2(P1(A)))'",
                "0:24 !SET - PStore/root.v2 = 'P1(P3(P2(P1(A))))' (prev: 'P1(A)')",
                "0:25 !DRT - PStore/%P2 <- PStore/root.v2",
                "0:26 !PCE - 0:22",
                "0:27 !PCS - Compute #2 (PStore/%P2) P2 Reconciliation - parentId=0:21",
                "0:28 !GET - PStore/root.v2 -> 'P1(P3(P2(P1(A))))'",
                "0:29 !SET - PStore/root.v3 = 'P2(P1(P3(P2(P1(A)))))' (prev: 'P2(P1(A))')",
                "0:30 !DRT - PStore/%P3 <- PStore/root.v3",
                "0:31 !PCE - 0:27",
                "0:32 !PCS - Compute #2 (PStore/%P3) P3 Reconciliation - parentId=0:21",
                "0:33 !GET - PStore/root.v3 -> 'P2(P1(P3(P2(P1(A)))))'",
                "0:34 !SET - PStore/root.v1 = 'P3(P2(P1(P3(P2(P1(A))))))' (prev: 'P3(P2(P1(A)))')",
                "0:35 !DRT - PStore/%P1 <- PStore/root.v1",
                "0:36 !PCE - 0:32",
                "0:37 !ERR - [TRAX] (PStore/%P1) Circular reference: Processors cannot run twice during reconciliation",
                "0:38 !PCE - 0:21",
            ]);
        });

        it('should be raised if autoCompute processor doesn\'t have any dependency at init', async () => {
            const st = trax.createStore("PStore", (store: Store<Values>) => {
                const v = store.init({
                    v1: "A",
                    v2: "B",
                    v3: "C",
                });

                store.compute("P1", () => {
                    v.v2 = "P1(" + v.v1 + ")";
                });
                store.compute("P2", () => {
                    // do nothing
                });
            });

            expect(printLogs(0)).toMatchObject([
                "0:1 !PCS - StoreInit (PStore)",
                "0:2 !NEW - S: PStore",
                "0:3 !NEW - O: PStore/root",
                "0:4 !NEW - P: PStore/%P1",
                "0:5 !PCS - Compute #1 (PStore/%P1) P1 Init - parentId=0:1",
                "0:6 !GET - PStore/root.v1 -> 'A'",
                "0:7 !SET - PStore/root.v2 = 'P1(A)' (prev: 'B')",
                "0:8 !PCE - 0:5",
                "0:9 !NEW - P: PStore/%P2",
                "0:10 !PCS - Compute #1 (PStore/%P2) P2 Init - parentId=0:1",
                "0:11 !PCE - 0:10",
                "0:12 !ERR - [TRAX] (PStore/%P2) No dependencies found: processor will never be re-executed",
                "0:13 !PCE - 0:1",
            ]);
        });
    });
});
