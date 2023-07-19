// @vitest-environment jsdom
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { describe, beforeEach, expect, it } from 'vitest';
import { component, resetReactEnv } from '..';
import { act } from 'react-dom/test-utils';
import { trax } from '@traxjs/trax';

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
        resetReactEnv();
        host = document.createElement('div');
        act(() => {
            const root = ReactDOM.createRoot(host);
            root.render(<MainCpt data={data} />);
        });
    };

    it('should properly memoize components', async () => {
        const store = trax.createStore<Data>("TestStore", { title: "Greetings", showMessage: false });
        const data = store.data;
        renderCpt(data);

        expect(host.innerHTML).toBe('<div class="maincpt">Greetings<div class="subcpt"></div></div>');
        expect(mainRenderCount).toBe(1);
        expect(subRenderCount).toBe(1);

        await act(async () => {
            data.showMessage = true;
        });

        expect(host.innerHTML).toBe('<div class="maincpt">Greetings<div class="subcpt">Hello World</div></div>');
        expect(mainRenderCount).toBe(2);
        expect(subRenderCount).toBe(2);

        await act(async () => {
            data.title = "Hi";
        });

        expect(host.innerHTML).toBe('<div class="maincpt">Hi<div class="subcpt">Hello World</div></div>');
        expect(mainRenderCount).toBe(3);
        expect(subRenderCount).toBe(2);
    });

});
