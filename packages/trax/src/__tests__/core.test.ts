import { beforeEach, describe, expect, it } from 'vitest';
import { $Store, $Trax, $TrxObjectType } from '../types';
import { createTraxEnv } from '../core';
import { printEvents } from './utils';

describe('Trax Core', () => {
    let trax: $Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents);
    }

    describe('Basics', () => {
        it('should support cycleComplete', async () => {
            expect(trax.pendingChanges).toBe(false);
            trax.log.info("A");
            expect(trax.pendingChanges).toBe(false);
            await trax.cycleComplete();
            expect(trax.pendingChanges).toBe(false);

            expect(printLogs(false)).toMatchObject([
                '0:0 !CS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !CC - {"elapsedTime":0}',
            ]);

            // no changes
            await trax.cycleComplete();
            expect(trax.pendingChanges).toBe(false);
            expect(printLogs(false)).toMatchObject([
                '0:0 !CS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !CC - {"elapsedTime":0}',
            ]);

            trax.log.info("B");
            await trax.cycleComplete();
            expect(trax.pendingChanges).toBe(false);
            expect(printLogs(false)).toMatchObject([
                '0:0 !CS - {"elapsedTime":0}',
                '0:1 !LOG - "A"',
                '0:2 !CC - {"elapsedTime":0}',
                '1:0 !CS - {"elapsedTime":0}',
                '1:1 !LOG - "B"',
                '1:2 !CC - {"elapsedTime":0}',
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

            expect(trax.getTraxObjectType(undefined)).toBe($TrxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType(42)).toBe($TrxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType({})).toBe($TrxObjectType.NotATraxObject);
            expect(trax.getTraxObjectType(true)).toBe($TrxObjectType.NotATraxObject);
        });
    });

    describe('Stores', () => {
        it('should be created wih a unique id', async () => {
            const initFn = (store: $Store<any>) => {
                const root = store.initRoot({ msg: "Hello" });
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

        it('should be able to define a custom dispose behaviour', async () => {
            let traces = "";
            const initFn = (store: $Store<any>) => {
                const root = store.initRoot({ msg: "Hello" });
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
            const st = trax.createStore("MyStore", (store: $Store<any>) => {
                store.initRoot({ msg: "Hello" });
            });
            expect(trax.isTraxObject(st)).toBe(true);
        });

        it('should support init functions that don\'t return any object', async () => {
            const st = trax.createStore("MyStore", (store: $Store<any>) => {
                store.initRoot({ msg: "Hello" });
            });
            expect(st.id).toBe("MyStore");
            expect(typeof st.add).toBe("function");
            expect(trax.isTraxObject(st)).toBe(true);
            expect(trax.getTraxId(st)).toBe("MyStore");
        });

        describe('Errors', () => {
            it('must be raised when initRoot is not called during the store initialization', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.add("foo", { msg: "Hello" });
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/foo',
                    '0:3 !ERR - "[trax] (MyStore) createStore init must define a root object - see also: initRoot()"',
                    '0:4 !NEW - O: MyStore/root',
                    '0:5 !PCE - "0:1"',
                ]);
            });

            it('must be raised when initRoot is called outside the init function', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !PCE - "0:1"',
                ]);
                st.initRoot({ msg: "abc" });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !PCE - "0:1"',
                    '0:4 !ERR - "[trax] (MyStore) Store.initRoot can only be called during the store init phase"',
                ]);
            });

            it('must be raised when init functions dont return an object', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                    return 42;
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !ERR - "[trax] createStore init function must return a valid object (MyStore)"',
                    '0:4 !PCE - "0:1"',
                ]);
            });

            it('must be raised when init function throws an error', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                    throw Error("Unexpected error");
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !ERR - "[trax] createStore init error (MyStore): Error: Unexpected error"',
                    '0:4 !PCE - "0:1"',
                ]);
            });

            it('must be raised when the store dispose throws an error', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                    return {
                        dispose() {
                            throw Error("Unexpected dispose error");
                        }
                    }
                });
                st.dispose();
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !PCE - "0:1"',
                    '0:4 !ERR - "[trax] Store.dispose error (MyStore): Error: Unexpected dispose error"',
                ]);
            });

            it('must be raised if store id is provided by the init function', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                    return {
                        id: "abcd"
                    }
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !ERR - "[trax] Store id will be overridden and must not be provided by init function (MyStore)"',
                    '0:4 !PCE - "0:1"'
                ]);
            });

            it('must be raised in case of invalid id', async () => {
                const st = trax.createStore("My/Store/ABC", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                });
                expect(st.id).toBe("MyStoreABC");
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - "[trax] Invalid trax id: My/Store/ABC (changed into MyStoreABC)"',
                    '0:2 !PCS - StoreInit (MyStoreABC)',
                    '0:3 !NEW - O: MyStoreABC/root',
                    '0:4 !PCE - "0:2"'
                ]);
            });

            it('must be raised in case of invalid get parameter', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                    store.add("abc", 42);
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !ERR - "[trax] (MyStore) Store.get: Invalid init object parameter: 42"',
                    '0:4 !NEW - O: MyStore/abc',
                    '0:5 !PCE - "0:1"'
                ]);
            });

            it('must be raised if "root" is used as an id for a new object', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    store.initRoot({ msg: "Hello" });
                });
                st.add("root", {msg: "abc"});

                expect(printLogs()).toMatchObject([
                    '0:1 !PCS - StoreInit (MyStore)',
                    '0:2 !NEW - O: MyStore/root',
                    '0:3 !PCE - "0:1"',
                    '0:4 !ERR - "[trax] Store.add: Invalid id \'root\' (reserved)"'
                ]);

            });
        });
    });
});
