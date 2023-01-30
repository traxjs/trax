import { trax } from '@traxjs/trax';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMessageStore, LOG_MESSAGE_STORE_INITIALIZED, MessageStore } from '../messagestore';

describe('Message Store', () => {
    let store: MessageStore, data: MessageStore["data"];

    beforeEach(() => {
        store = createMessageStore();
        data = store.data;
    });

    function printContent() {
        const r: string[] = [];
        r.push(`Initialized: ${data.initialized}`);
        for (let msg of data.messages) {
            r.push(`- ${msg.id}/${msg.authorId}/${msg.timeStamp}: ${msg.text}`);
        }
        return r;
    }

    it('should load propertly', async () => {
        expect(printContent()).toMatchObject([
            "Initialized: false",
        ]);

        await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED, { src: store.id });
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: true",
            "- M1/U1/1674839000000: Trying is the first step towards failure.",
            "- M2/U1/1674839001000: If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000: Stupidity got us into this mess, and stupidity will get us out.",
            "- M4/U1/1674839006000: Give me the number for 911!",
            "- M5/U2/1674839002000: I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000: Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "- M7/U2/1674839005000: Aim low. Aim so low no one will even care if you succeed",
        ]);
    });

    it('should support adding messages', async () => {
        store.syncNewMessage({ id: "X1", authorId: "U1", timeStamp: 121212, text: "Hi there!" });
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: false",
            "- X1/U1/121212: Hi there!",
        ]);
        await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED, { src: store.id });
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: true",
            "- X1/U1/121212: Hi there!",
            "- M1/U1/1674839000000: Trying is the first step towards failure.",
            "- M2/U1/1674839001000: If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000: Stupidity got us into this mess, and stupidity will get us out.",
            "- M4/U1/1674839006000: Give me the number for 911!",
            "- M5/U2/1674839002000: I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000: Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "- M7/U2/1674839005000: Aim low. Aim so low no one will even care if you succeed",
        ]);
        store.syncNewMessage({ id: "X2", authorId: "U2", timeStamp: 343434, text: "Glad to see you!" });
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: true",
            "- X1/U1/121212: Hi there!",
            "- M1/U1/1674839000000: Trying is the first step towards failure.",
            "- M2/U1/1674839001000: If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000: Stupidity got us into this mess, and stupidity will get us out.",
            "- M4/U1/1674839006000: Give me the number for 911!",
            "- M5/U2/1674839002000: I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000: Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "- M7/U2/1674839005000: Aim low. Aim so low no one will even care if you succeed",
            "- X2/U2/343434: Glad to see you!",
        ]);
    });

    it('should support deleting messages', async () => {
        await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED, { src: store.id });
        store.syncMessageDelete("M6");
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: true",
            "- M1/U1/1674839000000: Trying is the first step towards failure.",
            "- M2/U1/1674839001000: If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000: Stupidity got us into this mess, and stupidity will get us out.",
            "- M4/U1/1674839006000: Give me the number for 911!",
            "- M5/U2/1674839002000: I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M7/U2/1674839005000: Aim low. Aim so low no one will even care if you succeed",
        ]);
    });

    it('should support message update', async () => {
        await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED, { src: store.id });
        store.syncMessageUpdate({ id: "M6", text: "Blah Blah" });
        store.syncMessageUpdate({ id: "M5", timeStamp: 101010, authorId: "U3" });
        await trax.reconciliation();
        expect(printContent()).toMatchObject([
            "Initialized: true",
            "- M1/U1/1674839000000: Trying is the first step towards failure.",
            "- M2/U1/1674839001000: If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000: Stupidity got us into this mess, and stupidity will get us out.",
            "- M4/U1/1674839006000: Give me the number for 911!",
            "- M5/U3/101010: I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000: Blah Blah",
            "- M7/U2/1674839005000: Aim low. Aim so low no one will even care if you succeed",
        ]);
    });

});
