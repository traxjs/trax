import { beforeEach, describe, expect, it } from 'vitest';
import { $Store, $Trax } from '../types';
import { createTraxEnv } from '../core';
import { printEvents } from './utils';

interface $Person {
    name: string;
    age?: number;
    displayName?: string;
}

interface $SimpleFamilyStore {
    name: string; // computed
    father?: $Person;
    mother?: $Person;
    child1?: $Person;
    child2?: $Person;
    child3?: $Person;
}

describe('Trax Objects', () => {
    let trax: $Trax, fst: $Store<$SimpleFamilyStore>;

    beforeEach(() => {
        trax = createTraxEnv();
        fst = trax.createStore("SimpleFamilyStore", (store: $Store<$SimpleFamilyStore>) => {
            store.initRoot({
                name: "",
                father: {
                    name: "Homer"
                }
            });
        });
    });

    function printLogs(ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents);
    }

    describe('Basics', () => {
        it('must proxy the root object', async () => {
            const r1 = fst.get<$SimpleFamilyStore>("root");
            expect(r1.father!.name).toBe("Homer");

            const r2 = fst.get<$SimpleFamilyStore>("root");
            expect(r1).toBe(r2);
            expect(r2.name).toBe("");

            expect(trax.getTraxId(r1)).toBe("SimpleFamilyStore/root");

            expect(printLogs()).toMatchObject([
                '0:1 !PCS - StoreInit (SimpleFamilyStore)',
                '0:2 !NEW - O: SimpleFamilyStore/root',
                '0:3 !PCE - "0:1"',
                '1:1 !GET - SimpleFamilyStore/root.father -> {"name":"Homer"}',
                '1:2 !GET - SimpleFamilyStore/root.name -> ""'
            ]);
        });
    });

});
