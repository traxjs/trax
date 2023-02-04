import { beforeEach, describe, expect, it } from 'vitest';
import { createTraxEnv } from '../core';
import { Trax } from '../types';
import { printEvents } from './utils';

/**
 * Ref Props are props that should be considered as references
 * and should not be auto-wrapped
 * This behaviour is controlled through a naming convention: the property name must start
 * with 1 or more $ signs
 */
describe('Ref Props', () => {
    let trax: Trax;

    beforeEach(() => {
        trax = createTraxEnv();
    });

    function printLogs(minCycleId = 0, ignoreCycleEvents = true): string[] {
        return printEvents(trax.log, ignoreCycleEvents, minCycleId);
    }

    interface Person {
        name: string;
        $parents?: {
            father: string;
            mother: string;
        }
    }

    interface Person1 {
        name: string;
        $family: Person[];
    }

    interface Person21 {
        name: string;
        $$family: Person[];
    }

    interface Person22 {
        name: string;
        $$family: Person[][];
    }

    interface Person3 {
        name: string;
        $$$family: Person[][];
    }

    it('should be supported for sub-objects (level 1)', async () => {
        const ps = trax.createStore<Person>("PStore", {
            name: "Bart",
            $parents: {
                father: "Homer",
                mother: "Marge"
            }
        });
        const p = ps.root;

        let output = "";
        ps.compute("Render", () => {
            const parents = p.$parents;
            output = `${p.name} / ${parents!.father} & ${parents!.mother}`;
        });

        expect(output).toBe("Bart / Homer & Marge");

        await trax.reconciliation();
        trax.log.info("A");
        p.name = "BART";

        await trax.reconciliation();
        expect(output).toBe("BART / Homer & Marge");

        trax.log.info("B");
        p.$parents!.father = "HOMER";
        await trax.reconciliation();

        trax.log.info("C");
        expect(output).toBe("BART / Homer & Marge"); // no changes
        p.name = "Bart";

        await trax.reconciliation();
        expect(output).toBe("Bart / HOMER & Marge"); // re-processed because of Bart change

        expect(printLogs(1)).toMatchObject([
            "1:1 !LOG - A",
            "1:2 !SET - PStore/root.name = 'BART' (prev: 'Bart')",
            "1:3 !DRT - PStore/%Render <- PStore/root.name",
            "1:4 !PCS - !Reconciliation #1 - 1 processor",
            "1:5 !PCS - !Compute #2 (PStore/%Render) P1 Reconciliation - parentId=1:4",
            "1:6 !GET - PStore/root.$parents -> {\"father\":\"Homer\",\"mother\":\"Marge\"}",
            "1:7 !GET - PStore/root.name -> 'BART'",
            "1:8 !PCE - 1:5",
            "1:9 !PCE - 1:4",
            "2:1 !LOG - B",
            "2:2 !GET - PStore/root.$parents -> {\"father\":\"Homer\",\"mother\":\"Marge\"}",
            "3:1 !LOG - C", // no re-processing
            "3:2 !SET - PStore/root.name = 'Bart' (prev: 'BART')",
            "3:3 !DRT - PStore/%Render <- PStore/root.name",
            "3:4 !PCS - !Reconciliation #2 - 1 processor",
            "3:5 !PCS - !Compute #3 (PStore/%Render) P1 Reconciliation - parentId=3:4",
            "3:6 !GET - PStore/root.$parents -> {\"father\":\"HOMER\",\"mother\":\"Marge\"}",
            "3:7 !GET - PStore/root.name -> 'Bart'",
            "3:8 !PCE - 3:5",
            "3:9 !PCE - 3:4",
        ]);
    });

    it('should be supported for arrays (level 1)', async () => {
        const ps = trax.createStore<Person1>("PStore", {
            name: "Bart",
            $family: [
                { name: "Homer" },
                { name: "Marge" },
            ]
        });
        const p = ps.root;

        let output = "";
        ps.compute("Render", () => {
            const f = p.$family;
            output = `${p.name} / ${f.map(p => p.name).join(" & ")}`;
        });

        expect(output).toBe("Bart / Homer & Marge");

        await trax.reconciliation();
        trax.log.info("A");
        p.name = "BART";

        await trax.reconciliation();
        expect(output).toBe("BART / Homer & Marge");

        await trax.reconciliation();
        trax.log.info("B");
        p.$family.push({ name: "Lisa" }); // no changes expected

        await trax.reconciliation();
        expect(output).toBe("BART / Homer & Marge"); // no changes

        trax.log.info("C");
        p.name = "Bart";
        await trax.reconciliation();
        expect(output).toBe("Bart / Homer & Marge & Lisa"); // reprocessed through Bart change

        expect(printLogs(1)).toMatchObject([
            "1:1 !LOG - A",
            "1:2 !SET - PStore/root.name = 'BART' (prev: 'Bart')",
            "1:3 !DRT - PStore/%Render <- PStore/root.name",
            "1:4 !PCS - !Reconciliation #1 - 1 processor",
            "1:5 !PCS - !Compute #2 (PStore/%Render) P1 Reconciliation - parentId=1:4",
            "1:6 !GET - PStore/root.$family -> [{\"name\":\"Homer\"},{\"name\":\"Marge\"}]",
            "1:7 !GET - PStore/root.name -> 'BART'",
            "1:8 !PCE - 1:5",
            "1:9 !PCE - 1:4",
            "2:1 !LOG - B",
            "2:2 !GET - PStore/root.$family -> [{\"name\":\"Homer\"},{\"name\":\"Marge\"}]",
            "3:1 !LOG - C", // no changes
            "3:2 !SET - PStore/root.name = 'Bart' (prev: 'BART')",
            "3:3 !DRT - PStore/%Render <- PStore/root.name", // change
            "3:4 !PCS - !Reconciliation #2 - 1 processor",
            "3:5 !PCS - !Compute #3 (PStore/%Render) P1 Reconciliation - parentId=3:4",
            "3:6 !GET - PStore/root.$family -> [{\"name\":\"Homer\"},{\"name\":\"Marge\"},{\"name\":\"Lisa\"}]",
            "3:7 !GET - PStore/root.name -> 'Bart'",
            "3:8 !PCE - 3:5",
            "3:9 !PCE - 3:4",
        ]);
    });

    it('should be supported for arrays (level 2 - array)', async () => {
        const ps = trax.createStore<Person21>("PStore", {
            name: "Bart",
            $$family: [
                { name: "Homer" },
                { name: "Marge" },
            ]
        });
        const p = ps.root;

        let output = "";
        ps.compute("Render", () => {
            const f = p.$$family;
            output = `${p.name} / ${f.map(p => p.name).join(" & ")}`;
        });

        expect(output).toBe("Bart / Homer & Marge");

        await trax.reconciliation();
        trax.log.info("A");
        p.$$family.push({ name: "Lisa" }); // expect change

        await trax.reconciliation();
        expect(output).toBe("Bart / Homer & Marge & Lisa");

        trax.log.info("B");
        p.$$family[2].name = "LISA"; // no changes in this case

        await trax.reconciliation();
        expect(output).toBe("Bart / Homer & Marge & Lisa");

        trax.log.info("C");
        p.$$family.splice(0, 1, { name: "Maggie" }); // change

        await trax.reconciliation();
        expect(output).toBe("Bart / Maggie & Marge & LISA");
    });

    it('should be supported for arrays (level 2 - array in array)', async () => {
        const ps = trax.createStore<Person22>("PStore", {
            name: "Bart",
            $$family: [
                // first level is wrapped, but not the 2nd level
                [{ name: "Homer" }, { name: "Marge" }],
            ]
        });

        const p = ps.root;

        let output = "";
        ps.compute("Render", () => {
            const f = p.$$family;
            output = `${p.name} / ${f.map(a => "[" + a.map(p => p.name).join("+") + "]").join(" & ")}`;
        });

        expect(output).toBe("Bart / [Homer+Marge]");


        await trax.reconciliation();
        trax.log.info("A");
        p.name = "BART"; // change expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge]");

        trax.log.info("B");
        p.$$family.push([{ name: "Lisa" }]); // level1: change expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa]");

        trax.log.info("C");
        p.$$family[1].push({ name: "Maggie" }); // level2 : no changes expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa]");

        trax.log.info("D");
        p.$$family[1][0].name = "LISA"; // level2 : no changes expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa]");

        trax.log.info("E");
        p.name = "Bart"; // change expected

        await trax.reconciliation();
        expect(output).toBe("Bart / [Homer+Marge] & [LISA+Maggie]");
    });

    it('should be supported for arrays (level 3  - array in array)', async () => {
        const ps = trax.createStore<Person3>("PStore", {
            name: "Bart",
            $$$family: [
                // first level is wrapped, but not the 2nd level
                [{ name: "Homer" }, { name: "Marge" }],
            ]
        });

        const p = ps.root;

        let output = "";
        ps.compute("Render", () => {
            const f = p.$$$family;
            output = `${p.name} / ${f.map(a => "[" + a.map(p => p.name).join("+") + "]").join(" & ")}`;
        });


        expect(output).toBe("Bart / [Homer+Marge]");


        await trax.reconciliation();
        trax.log.info("A");
        p.name = "BART"; // change expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge]");

        trax.log.info("B");
        p.$$$family.push([{ name: "Lisa" }]); // level1: change expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa]");

        trax.log.info("C");
        p.$$$family[1].push({ name: "Maggie" }); // level2 : change expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa+Maggie]");

        trax.log.info("D");
        p.$$$family[1][0].name = "LISA"; // level3 : no changes expected

        await trax.reconciliation();
        expect(output).toBe("BART / [Homer+Marge] & [Lisa+Maggie]");

        trax.log.info("E");
        p.name = "Bart"; // change expected

        await trax.reconciliation();
        expect(output).toBe("Bart / [Homer+Marge] & [LISA+Maggie]");
    });

    // error if $$ prefix used outside of arrays?
});