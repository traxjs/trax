import { beforeEach, describe, expect, it } from 'vitest';
import { $Store, $Trax } from '../types';
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

    describe('Stores', () => {
        it('should be created wih a unique id', async () => {
            const initFn = (store: $Store<any>) => {
                const root = store.getObject("root", { msg: "Hello" });
                return {
                    msg: root
                }
            }
            const s1 = trax.createStore("MyStore", initFn);
            expect(s1.id).toBe("MyStore");
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
                const root = store.getObject("root", { msg: "Hello" });
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

        it('should support init functions that don\'t return any object', async () => {
            const st = trax.createStore("MyStore", (store: $Store<any>) => {
                const root = store.getObject("root", { msg: "Hello" });
            });
            expect(st.id).toBe("MyStore");
            expect(typeof st.dispose).toBe("function");
        });

        describe('Errors', () => {
            it('must be raised when init functions dont return an object', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    const root = store.getObject("root", { msg: "Hello" });
                    return 42;
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - "[trax] createStore init function must return a valid object (MyStore)"',
                ]);
            });

            it('must be raised when init function throws an error', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    const root = store.getObject("root", { msg: "Hello" });
                    throw Error("Unexpected error");
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - "[trax] createStore init error (MyStore): Error: Unexpected error"',
                ]);
            });

            it('must be raised when the store dispose throws an error', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    const root = store.getObject("root", { msg: "Hello" });
                    return {
                        dispose() {
                            throw Error("Unexpected dispose error");
                        }
                    }
                });
                st.dispose();
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - "[trax] Store.dispose error (MyStore): Error: Unexpected dispose error"',
                ]);
            });

            it('must be raised if store id is provided by the init function', async () => {
                const st = trax.createStore("MyStore", (store: $Store<any>) => {
                    const root = store.getObject("root", { msg: "Hello" });
                    return {
                        id: "abcd"
                    }
                });
                expect(printLogs()).toMatchObject([
                    '0:1 !ERR - "[trax] Store id will be overridden and must not be provided by init function (MyStore)"',
                ]);
            });
        });
    });
});
