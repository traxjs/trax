import { beforeEach, describe, expect, it } from 'vitest';
import { Store, Trax } from '../types';
import { createTraxEnv, tmd } from '../core';
import { SimpleFamilyStore, printEvents } from './utils';


describe('Trax Objects', () => {
    let trax: Trax, fst: Store<SimpleFamilyStore>;

    beforeEach(() => {
        trax = createTraxEnv();
        fst = trax.createStore("SimpleFamilyStore", (store: Store<SimpleFamilyStore>) => {
            store.init({
                childNames: "",
                father: {
                    firstName: "Homer",
                    lastName: ""
                }
            });
        });
    });

    function printLogs(ignoreCycleEvents = true, minCycleId = 1): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    describe('Basics', () => {
        it('must get the root object and wrap sub-objects', async () => {
            const r1 = fst.get<SimpleFamilyStore>("root")!;
            expect(r1.father!.firstName).toBe("Homer");

            const r2 = fst.get<SimpleFamilyStore>("root")!;
            expect(r1).toBe(r2);
            expect(r2.childNames).toBe("");

            expect(trax.getTraxId(r1)).toBe("SimpleFamilyStore/root");

            expect(printLogs(true, 0)).toMatchObject([
                '0:1 !PCS - !StoreInit (SimpleFamilyStore)',
                '0:2 !NEW - S: SimpleFamilyStore',
                '0:3 !NEW - O: SimpleFamilyStore/root',
                '0:4 !PCE - 0:1',
                // Note: the following logs are on cycle 1 because the store was initialised in beforeEach
                "1:1 !NEW - O: SimpleFamilyStore/root*father",
                "1:2 !GET - SimpleFamilyStore/root.father -> '[TRAX SimpleFamilyStore/root*father]'",
                "1:3 !GET - SimpleFamilyStore/root*father.firstName -> 'Homer'",
                "1:4 !GET - SimpleFamilyStore/root.childNames -> ''",
            ]);
        });

        it('must support object wrapping', async () => {
            let o1 = fst.add("foo", { foo: "bar" });

            expect(trax.isTraxObject(o1)).toBe(true);
            expect(trax.isTraxObject({ foo: "bar" })).toBe(false);
            expect(trax.getTraxId(o1)).toBe("SimpleFamilyStore/foo");

            let o2 = fst.add("bar", { foo: "bar2" });
            expect(trax.isTraxObject(o2)).toBe(true);
            expect(trax.getTraxId(o2)).toBe("SimpleFamilyStore/bar");

            expect(printLogs()).toMatchObject([
                '1:1 !NEW - O: SimpleFamilyStore/foo',
                '1:2 !NEW - O: SimpleFamilyStore/bar',
            ]);
        });

        it('must support using other trax objects to build advance ids (same store)', async () => {
            let o1 = fst.add([fst.root, "foo"], { foo: "bar" });
            expect(trax.getTraxId(o1)).toBe("SimpleFamilyStore/root:foo");

            // this will generate an error
            let o2 = fst.add([{ blah: "blah" }, "foo"], { foo: "bar" });
            const id = trax.getTraxId(o2); // e.g. SimpleFamilyStore/17686:foo
            const m = id.match(/^SimpleFamilyStore\/\d+\:foo$/);
            expect(m).not.toBe(null);

            expect(printLogs()).toMatchObject([
                "1:1 !NEW - O: SimpleFamilyStore/root:foo",
                "1:2 !ERR - [TRAX] Invalid id param: not a trax object",
                "1:3 !NEW - O: " + id
            ]);
        });

        it('must support using other trax objects to build advance ids (different store)', async () => {
            const st = trax.createStore("AnotherStore", (store: Store<{ msg: string }>) => {
                store.init({ msg: "Hello World" })
            })

            let o = fst.add([st.root, "foo"], { foo: "bar" });
            expect(trax.getTraxId(o)).toBe("SimpleFamilyStore/AnotherStore-root:foo");

            expect(printLogs()).toMatchObject([
                "1:1 !PCS - !StoreInit (AnotherStore)",
                "1:2 !NEW - S: AnotherStore",
                "1:3 !NEW - O: AnotherStore/root",
                "1:4 !PCE - 1:1",
                "1:5 !NEW - O: SimpleFamilyStore/AnotherStore-root:foo",
            ]);
        });

        it('must return the same object and ignore new default values', async () => {
            let o1 = fst.add("foo", { foo: "bar" });
            let o2 = fst.add("foo", { blah: "baz" });
            let o3 = fst.get("foo");

            expect(o2).toBe(o1);
            expect(o3).toBe(o1);
            expect(o2.blah).toBe(undefined);
            expect((o2 as any).foo).toBe("bar");
        });

        it('must support delete and create new objects if previous id was deleted', async () => {
            let o1 = fst.add("foo", { foo: "bar" });

            const md1a = tmd(o1)!;
            expect(md1a.id).toBe("SimpleFamilyStore/foo");
            let dr = fst.remove(o1);
            expect(dr).toBe(true);
            const md1b = tmd(o1);
            expect(md1b).toBe(undefined);
            dr = fst.remove(o1);
            expect(dr).toBe(false);

            let o2 = fst.add(["foo", "bar"], { foo: "bar" });
            expect(o2 !== o1).toBe(true);

            dr = fst.remove({});
            expect(dr).toBe(false);

            dr = fst.remove(["foo", "bar"]);
            expect(dr).toBe(false);
            dr = fst.remove(o2);
            expect(dr).toBe(true);

            let o3 = fst.add("x", { foo: 123 });
            dr = fst.remove(o3);
            expect(dr).toBe(true);
            fst.add("x", { foo: 123 });
            dr = fst.remove(o3);
            expect(dr).toBe(false);

            expect(printLogs()).toMatchObject([
                "1:1 !NEW - O: SimpleFamilyStore/foo",
                "1:2 !DEL - SimpleFamilyStore/foo",
                "1:3 !NEW - O: SimpleFamilyStore/foo:bar",
                "1:4 !DEL - SimpleFamilyStore/foo:bar",
                "1:5 !NEW - O: SimpleFamilyStore/x",
                "1:6 !DEL - SimpleFamilyStore/x",
                "1:7 !NEW - O: SimpleFamilyStore/x",
            ]);
        });

        it('must support JSON.stringify and not expose any specific property', async () => {
            let o = fst.add("foo", { foo: "bar" });
            expect(JSON.stringify(o)).toBe('{"foo":"bar"}');
            expect(tmd(o)!.id).toBe("SimpleFamilyStore/foo");
        });

        it('must not re-wrap deleted data objects', async () => {
            let f = fst.add("ford", { name: { firstName: "Ford", lastName: "Prefect" }, planet: "Betelgeuse V" });
            expect(f.name.firstName).toBe("Ford");
            fst.remove(f.name);

            trax.log.info("A");
            f.name.firstName = "FORD"
            expect(f.name.firstName).toBe("FORD");

            expect(printLogs()).toMatchObject([
                "1:1 !NEW - O: SimpleFamilyStore/ford",
                "1:2 !NEW - O: SimpleFamilyStore/ford*name",
                "1:3 !GET - SimpleFamilyStore/ford.name -> '[TRAX SimpleFamilyStore/ford*name]'",
                "1:4 !GET - SimpleFamilyStore/ford*name.firstName -> 'Ford'",
                "1:5 !GET - SimpleFamilyStore/ford.name -> '[TRAX SimpleFamilyStore/ford*name]'",
                "1:6 !DEL - SimpleFamilyStore/ford*name",
                "1:7 !LOG - A",
                "1:8 !GET - SimpleFamilyStore/ford.name -> {\"firstName\":\"Ford\",\"lastName\":\"Prefect\"}",
                "1:9 !GET - SimpleFamilyStore/ford.name -> {\"firstName\":\"FORD\",\"lastName\":\"Prefect\"}",
            ]);
        });

        it('must log GET and SET until object is deleted', async () => {
            let p = fst.add("HS", { firstName: "Homer", lastName: "Simpson" });

            let name1 = p.firstName + " " + p.lastName;
            expect(name1).toBe("Homer Simpson");

            p.lastName = "SIMPSON";
            fst.remove(p);

            let name2 = p.firstName + " " + p.lastName;
            expect(name2).toBe("Homer SIMPSON");

            p.lastName = "Simpson";
            expect(p.lastName).toBe("Simpson");

            trax.log.info("END");

            expect(printLogs()).toMatchObject([
                '1:1 !NEW - O: SimpleFamilyStore/HS',
                '1:2 !GET - SimpleFamilyStore/HS.firstName -> \'Homer\'',
                '1:3 !GET - SimpleFamilyStore/HS.lastName -> \'Simpson\'',
                '1:4 !SET - SimpleFamilyStore/HS.lastName = \'SIMPSON\' (prev: \'Simpson\')',
                '1:5 !DEL - SimpleFamilyStore/HS',
                '1:6 !LOG - END'
            ]);
        });
    });

});
