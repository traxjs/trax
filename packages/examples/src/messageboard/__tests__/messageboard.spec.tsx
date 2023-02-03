import React from 'react';
import { trax, traxEvents } from '@traxjs/trax';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetReactEnv } from "@traxjs/trax-react";
import { fireEvent, render, RenderResult } from '@testing-library/preact';
import { MessageBoard } from '../messageboard';
import { LOG_USER_STORE_GET_USERS } from '../userstore';
import { messageStore } from '../messagestore';

describe('MessageBoard', () => {
    let container: RenderResult, cptDiv: HTMLDivElement;

    beforeEach(() => {
        resetReactEnv();
        messageStore.reset();
    });

    async function init(awaitFullRender = true) {
        // not in beforeEach to avoid missing events
        let p: Promise<any>;
        if (awaitFullRender) {
            p = trax.log.awaitEvent(traxEvents.ProcessingStart, { processorId: /%AuthorInfo/ });
        }
        container = render(<MessageBoard />);
        cptDiv = container.container.querySelector(".message-board")!;
        if (awaitFullRender) {
            await p!;
            await renderComplete();
        }
    }

    async function renderComplete() {
        return trax.log.awaitEvent(traxEvents.ProcessingEnd, { isRenderer: true });
    }

    function groupDivs() {
        return cptDiv.querySelectorAll(".message-group") as any as HTMLDivElement[];
    }

    function printContent() {
        const r: string[] = [];

        const groups = groupDivs();
        for (const div of groups) {
            let avatar = (div.querySelector("img.avatar") as HTMLImageElement)?.src || "x";
            const m = avatar.match(/[\w\.]+$/);
            if (m) {
                avatar = m[0];
            }
            const authorName = div.querySelector(".author-name")?.innerHTML.trim();
            const authorStatus = div.querySelector(".status")?.innerHTML.trim() || "-";
            r.push(`# ${authorName} (${authorStatus}) ${avatar}`);

            const msgs = div.querySelectorAll("li.message") as any as HTMLLIElement[];
            for (const li of msgs) {
                r.push(`- ${li.innerHTML.trim()}`);
            }
        }
        return r;
    }

    function controlPanelDeleteBtn(idx: number) {
        return (cptDiv.querySelectorAll(".message-control-panel .del")[idx]) as HTMLSpanElement;
    }

    function controlPanelAdd1000MessagesBtn() {
        return cptDiv.querySelector(".message-control-panel .add-msg-1000") as HTMLSpanElement;
    }

    it('should load correctly', async () => {
        await init(false);
        // await User sore to request users
        await trax.log.awaitEvent(LOG_USER_STORE_GET_USERS);
        // intermediary state
        expect(printContent()).toMatchObject([
            "# - (-) x",
            "- Trying is the first step towards failure.",
            "- If he's so smart, how come he's dead?",
            "# - (-) x",
            "- I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "# - (-) x",
            "- Stupidity got us into this mess, and stupidity will get us out.",
            "# - (-) x",
            "- Aim low. Aim so low no one will even care if you succeed",
            "# - (-) x",
            "- Give me the number for 911!",
        ]);

        // await AuthorInfo to process
        await renderComplete();
        expect(printContent()).toMatchObject([
            "# Homer Simpson (Away) homer.png",
            "- Trying is the first step towards failure.",
            "- If he's so smart, how come he's dead?",
            "# Marge Simpson (Online) marge.png",
            "- I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "# Homer Simpson (Away) homer.png",
            "- Stupidity got us into this mess, and stupidity will get us out.",
            "# Marge Simpson (Online) marge.png",
            "- Aim low. Aim so low no one will even care if you succeed",
            "# Homer Simpson (Away) homer.png",
            "- Give me the number for 911!",
        ]);
    });

    it('should react to message deletion from control panel', async () => {
        await init();

        expect(printContent()).toMatchObject([
            "# Homer Simpson (Away) homer.png",
            "- Trying is the first step towards failure.",
            "- If he's so smart, how come he's dead?",
            "# Marge Simpson (Online) marge.png",
            "- I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "# Homer Simpson (Away) homer.png",
            "- Stupidity got us into this mess, and stupidity will get us out.",
            "# Marge Simpson (Online) marge.png",
            "- Aim low. Aim so low no one will even care if you succeed",
            "# Homer Simpson (Away) homer.png",
            "- Give me the number for 911!",
        ]);

        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();

        expect(printContent()).toMatchObject([
            "# Homer Simpson (Away) homer.png",
            // First message deleted
            "- If he's so smart, how come he's dead?",
            "# Marge Simpson (Online) marge.png",
            "- I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "# Homer Simpson (Away) homer.png",
            "- Stupidity got us into this mess, and stupidity will get us out.",
            "# Marge Simpson (Online) marge.png",
            "- Aim low. Aim so low no one will even care if you succeed",
            "# Homer Simpson (Away) homer.png",
            "- Give me the number for 911!",
        ]);

        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();
        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();
        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();
        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();
        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();

        expect(printContent()).toMatchObject([
            "# Marge Simpson (Online) marge.png",
            "- Aim low. Aim so low no one will even care if you succeed",
        ]);

        fireEvent.click(controlPanelDeleteBtn(0)!);
        await renderComplete();
        expect(printContent()).toMatchObject([]);
    });

    it('should support to create 1000 messages', async () => {
        await init();
        let btn = controlPanelAdd1000MessagesBtn();
        expect(btn).not.toBe(undefined);
        expect(groupDivs().length).toBe(5);

        fireEvent.click(btn!);
        await renderComplete();

        expect(groupDivs().length).toBe(340); // >1000 messages in 340 groups
    });

});