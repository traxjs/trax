import React from 'react';
import { trax, traxEvents } from '@traxjs/trax';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetReactEnv } from "@traxjs/trax-react";
import { render, fireEvent, RenderResult } from '@testing-library/preact';
import userEvent from '@testing-library/user-event'
import { RcPlayground } from '../playground';
import { act } from 'preact/test-utils';

describe('RC Playground', () => {
    let container: RenderResult, cptDiv: HTMLDivElement;

    beforeEach(() => {
        resetReactEnv();
        container = render(<RcPlayground />);
        cptDiv = container.container.querySelector(".radar-chart-playground")!;
    });

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    function rangeInput(idx: number) {
        return cptDiv.querySelectorAll("input[type='range']")[idx]! as HTMLInputElement;
    }

    function deleteBtn(idx: number) {
        return cptDiv.querySelectorAll(".delete")[idx]! as HTMLDivElement;
    }

    function addValueBtn() {
        return cptDiv.querySelector("a.add-value")! as HTMLAnchorElement;
    }

    function printValues() {
        const r: string[] = [];
        const min = cptDiv.querySelector(".minValue")?.innerHTML.trim();
        const max = cptDiv.querySelector(".maxValue")?.innerHTML.trim();

        r.push(`Min: ${min} / Max: ${max}`);
        const values = cptDiv.querySelectorAll(".value-panel") as any as HTMLDivElement[];
        for (let div of values) {
            const lbl = div.querySelector("label")?.innerHTML.trim();
            const inputValue = (div.querySelector("input[type='range']") as any)?.value;
            const value = div.querySelector(".value")?.innerHTML.trim();
            r.push(`- ${lbl}: ${inputValue}/${value}`);
        }
        return r;
    }

    async function moveSlider(idx: number, value: number) {
        await act(async () => {
            fireEvent.change(rangeInput(idx), { target: { value } });
            rangeInput(idx)!.dispatchEvent(new Event("input"));
        });
    }

    it('should load correctly', async () => {
        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 100",
            "- V1: 80/80",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
        ]);
    });

    it('should change values', async () => {
        await moveSlider(0, 50);
        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 100",
            "- V1: 50/50",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
        ]);

        await moveSlider(3, 42); // min change
        expect(printValues()).toMatchObject([
            "Min: 42 / Max: 100",
            "- V1: 50/50",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 42/42",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
        ]);

        await moveSlider(5, 9); // min and max change
        expect(printValues()).toMatchObject([
            "Min: 9 / Max: 90",
            "- V1: 50/50",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 42/42",
            "- V5: 70/70",
            "- V6: 9/9",
            "- V7: 90/90",
        ]);
    });

    it('should delete values', async () => {
        fireEvent.click(deleteBtn(1));
        await renderComplete();

        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 100",
            "- V1: 80/80",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
        ]);

        fireEvent.click(deleteBtn(4));
        await renderComplete();

        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 90",
            "- V1: 80/80",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V7: 90/90",
        ]);

        fireEvent.click(deleteBtn(0));
        await renderComplete();
        fireEvent.click(deleteBtn(0));
        await renderComplete();
        fireEvent.click(deleteBtn(0));
        await renderComplete();
        fireEvent.click(deleteBtn(0));
        await renderComplete();

        expect(printValues()).toMatchObject([
            "Min: 90 / Max: 90",
            "- V7: 90/90",
        ]);

        fireEvent.click(deleteBtn(0));
        await renderComplete();

        expect(printValues()).toMatchObject([
            "Min: 0 / Max: 0",
        ]);
    });

    it('should add new values', async () => {
        fireEvent.click(addValueBtn());
        await renderComplete();
        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 100",
            "- V1: 80/80",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
            "- N8: 50/50",
        ]);

        fireEvent.click(addValueBtn());
        await renderComplete();
        expect(printValues()).toMatchObject([
            "Min: 5 / Max: 100",
            "- V1: 80/80",
            "- V2: 90/90",
            "- V3: 75/75",
            "- V4: 5/5",
            "- V5: 70/70",
            "- V6: 100/100",
            "- V7: 90/90",
            "- N8: 50/50",
            "- N9: 50/50",
        ]);


    });
});
