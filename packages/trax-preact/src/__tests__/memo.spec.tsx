// @vitest-environment jsdom
import React from 'react';
import { describe, beforeEach, expect, it } from 'vitest';
import { component, resetPreactEnv } from '..';
import { render } from '@testing-library/preact';
import { trax, traxEvents } from '@traxjs/trax';

// workaround to remove react-dom/test-utils warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface Data {
    title: string;
    showMessage: boolean;
}

describe('Memo', () => {
    let host: HTMLDivElement;
    let mainRenderCount = 0, subRenderCount = 0;

    beforeEach(() => {
        mainRenderCount = 0;
        subRenderCount = 0;
    });

    const MainCpt = component("MainCpt", (props: { data: Data }) => {
        const { data } = props;

        mainRenderCount++
        return <div className="maincpt">
            {data.title}
            <SubCpt showMessage={data.showMessage} />
        </div>
    });

    const SubCpt = component("SubCpt", (props: { showMessage: boolean }) => {
        const { showMessage } = props;
        subRenderCount++;
        return <div className="subcpt">
            {showMessage ? "Hello World" : ""}
        </div>
    });

    function renderCpt(data: Data) {
        resetPreactEnv();
        const container = render(<div>
            <MainCpt data={data} />
        </div>);
        host = container.container as HTMLDivElement;
    };

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }


    it('should properly memoize components', async () => {
        const store = trax.createStore<Data>("TestStore", { title: "Greetings", showMessage: false });
        const data = store.data;
        renderCpt(data);

        expect(host.innerHTML).toBe('<div><div class="maincpt">Greetings<div class="subcpt"></div></div></div>');
        expect(mainRenderCount).toBe(1);
        expect(subRenderCount).toBe(1);

        data.showMessage = true;
        await renderComplete();

        expect(host.innerHTML).toBe('<div><div class="maincpt">Greetings<div class="subcpt">Hello World</div></div></div>');
        expect(mainRenderCount).toBe(2);
        expect(subRenderCount).toBe(2);

        data.title = "Hi";
        await renderComplete();

        expect(host.innerHTML).toBe('<div><div class="maincpt">Hi<div class="subcpt">Hello World</div></div></div>');
        expect(mainRenderCount).toBe(3);
        expect(subRenderCount).toBe(2);
    });

});
