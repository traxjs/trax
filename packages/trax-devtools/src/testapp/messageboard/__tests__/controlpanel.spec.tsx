import React from 'react';
import { trax, traxEvents } from '@traxjs/trax';
import { resetReactEnv } from '@traxjs/trax-react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, RenderResult } from '@testing-library/preact';
import { ControlPanel } from '../controlpanel';
import { LOG_MESSAGE_STORE_INITIALIZED, messageStore } from '../messagestore';
import { userStore } from '../userstore';

describe('Control Panel', () => {
    let container: RenderResult, cptDiv: HTMLDivElement;

    beforeEach(() => {
        resetReactEnv();
    });

    async function init(awaitFullRender = true) {
        // not in beforeEach to avoid missing events
        let p: Promise<any>;
        if (awaitFullRender) {
            p = trax.log.awaitEvent(traxEvents.ProcessingStart, { processorId: /#ControlPanel/ });
        }
        container = render(<ControlPanel />);
        cptDiv = container.container.querySelector(".message-control-panel")!;
        if (!messageStore.data.initialized) {
            // first time
            await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED);
            p = trax.log.awaitEvent(traxEvents.ProcessingStart, { processorId: /#ControlPanel/ });
        } else if (awaitFullRender) {
            await p!;
        }
    }

    async function renderDetected() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    function addMsgButton(idx: number) {
        return cptDiv.querySelectorAll("button.add-msg")[idx]! as HTMLButtonElement;
    }

    function changeStatusButton(idx: number) {
        return cptDiv.querySelectorAll("button.change-status")[idx]! as HTMLButtonElement;
    }

    function changeNameBtn() {
        return cptDiv.querySelector("button.change-name")! as HTMLButtonElement;
    }

    function changeAvatarBtn() {
        return cptDiv.querySelector("button.change-avatar")! as HTMLButtonElement;
    }

    function delMsgButton(idx: number) {
        return cptDiv.querySelectorAll("ul.messages li span.del")[idx]! as HTMLSpanElement;
    }

    function userRadioInput(idx: number) {
        return cptDiv.querySelectorAll("input[type='radio']")[idx]! as HTMLInputElement;
    }

    function content() {
        const r: string[] = [];
        const lis = cptDiv.querySelectorAll("ul.messages li") as any as HTMLLIElement[];
        for (const li of lis) {
            let md = (li.querySelector(".meta-data") as HTMLSpanElement)?.innerHTML.trim();
            let text = (li.querySelector(".text") as HTMLSpanElement)?.innerHTML.trim();
            if (text.length > 12) {
                text = text.slice(0, 12) + "...";
            }
            r.push(`# ${md} - ${text}`);
        }
        return r;
    }

    it('should load properly', async () => {
        await init();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
        ]);
    });

    it('should allow to add and delete messages', async () => {
        await init();

        fireEvent.click(addMsgButton(0));
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            "# X1 at 1674838999000 from U1: - It's so simp...", // new message from U1 with first TS
        ]);

        fireEvent.click(userRadioInput(1)); // Select U2
        fireEvent.click(addMsgButton(2)); // Last message TS
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            "# X1 at 1674838999000 from U1: - It's so simp...",
            "# X2 at 1674839007000 from U2: - English? Who...", // new message from U2 with last TS
        ]);

        fireEvent.click(userRadioInput(1)); // Select U3
        fireEvent.click(addMsgButton(1)); // Middle TS
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            "# X1 at 1674838999000 from U1: - It's so simp...",
            "# X2 at 1674839007000 from U2: - English? Who...",
            "# X3 at 1674839003000 from U2: - I think the ...", // middle TimeStamp
        ]);

        fireEvent.click(delMsgButton(9)); // last
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            "# X1 at 1674838999000 from U1: - It's so simp...",
            "# X2 at 1674839007000 from U2: - English? Who...",
            // no more X3
        ]);

        fireEvent.click(delMsgButton(7)); // X1
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            // no X1
            "# X2 at 1674839007000 from U2: - English? Who...",
        ]);

        fireEvent.click(delMsgButton(7)); // X2
        await renderDetected();
        expect(content()).toMatchObject([
            "# M1 at 1674839000000 from U1: - Trying is th...",
            "# M2 at 1674839001000 from U1: - If he's so s...",
            "# M3 at 1674839004000 from U1: - Stupidity go...",
            "# M4 at 1674839006000 from U1: - Give me the ...",
            "# M5 at 1674839002000 from U2: - I guess one ...",
            "# M6 at 1674839003000 from U2: - Homer, we ha...",
            "# M7 at 1674839005000 from U2: - Aim low. Aim...",
            // no X2
        ]);
    });

    it('should allow to toggle user name', async () => {
        await init();
        fireEvent.click(userRadioInput(1)); // Select U2

        let usr = await userStore.getUser("U2");
        expect(usr?.name).toBe("Marge Simpson");

        fireEvent.click(changeNameBtn());
        await trax.reconciliation();
        expect(usr?.name).toBe("MARGE SIMPSON");

        fireEvent.click(changeNameBtn());
        await trax.reconciliation();
        expect(usr?.name).toBe("Marge Simpson");
    });

    it('should allow to toggle user avatar', async () => {
        await init();
        fireEvent.click(userRadioInput(3)); // Select U4

        let usr = await userStore.getUser("U4");
        expect(usr?.avatar).toBe("lisa.png");

        fireEvent.click(changeAvatarBtn());
        usr = await userStore.getUser("U4");
        expect(usr?.avatar).toBe("ned.png");

        fireEvent.click(changeAvatarBtn());
        usr = await userStore.getUser("U4");
        expect(usr?.avatar).toBe("lisa.png");
    });

    it('should allow to change user status', async () => {
        await init();
        fireEvent.click(userRadioInput(2)); // Select U3

        let usr = await userStore.getUser("U3");
        expect(usr?.status).toBe("OOO");

        fireEvent.click(changeStatusButton(0)); // online
        await trax.reconciliation();
        expect(usr?.status).toBe("Online");

        fireEvent.click(changeStatusButton(1)); // away
        await trax.reconciliation();
        expect(usr?.status).toBe("Away");

        fireEvent.click(changeStatusButton(2)); // ooo
        await trax.reconciliation();
        expect(usr?.status).toBe("OOO");

        fireEvent.click(changeStatusButton(3)); // unknown
        await trax.reconciliation();
        expect(usr?.status).toBe("Unknown");
    });

});
