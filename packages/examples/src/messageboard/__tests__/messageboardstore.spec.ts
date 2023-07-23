import { TraxProcessor, trax } from '@traxjs/trax';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMessageBoardStore, MessageBoardStore } from '../messageboardstore';
import { createMessageStore, LOG_MESSAGE_STORE_INITIALIZED, MessageStore } from '../messagestore';
import { createUserStore, LOG_USER_STORE_USERS_RECEIVED, UserStore } from '../userstore';

describe('MessageBoard Store', () => {
    let store: MessageBoardStore,
        data: MessageBoardStore["data"],
        msgStore: MessageStore,
        usrStore: UserStore,
        content = [] as string[];
    const rs = trax.createStore("Render", {});
    let ps: TraxProcessor;

    beforeEach(() => {
        msgStore = createMessageStore();
        usrStore = createUserStore();
        store = createMessageBoardStore(msgStore, usrStore);
        data = store.data;

        ps = rs.compute("PrintContent", () => {
            // this processor will force the message board store lazy processors to run
            const r: string[] = [];
            data.loading && r.push('[loading...]');
            for (const g of data.groups) {
                r.push(`#${g.authorId}/${g.authorStatus}/${g.authorAvatar} - ${g.authorName}`);
                for (const m of g.messages) {
                    r.push(`- ${m.id}/${m.authorId}/${m.timeStamp} ${m.text}`);
                }
            }
            content = r;
        });
    });

    afterEach(() => {
        ps!.dispose();
    })

    it('should load properly', async () => {
        expect(data.loading).toBe(true);
        expect(content).toMatchObject([
            "[loading...]",
        ]);
        await trax.log.awaitEvent(LOG_MESSAGE_STORE_INITIALIZED, { src: msgStore.id });
        await trax.reconciliation();

        expect(data.loading).toBe(false);

        // User info pending:
        expect(content).toMatchObject([
            "#U1/Unknown/ - ",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Unknown/ - ",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Unknown/ - ",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Unknown/ - ",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Unknown/ - ",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);

        // User info received:
        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });
        await trax.reconciliation();

        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);
    });

    it('should react to new messages', async () => {
        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });

        // existing user, recent message
        msgStore.syncNewMessage({
            id: "X1",
            authorId: "U2",
            timeStamp: 1674839007000,
            text: "New Message"
        })

        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
            "#U2/Online/marge.png - Marge Simpson",
            "- X1/U2/1674839007000 New Message",
        ]);

        // existing user, old message
        msgStore.syncNewMessage({
            id: "X2",
            authorId: "U2",
            timeStamp: 1674838000000,
            text: "First Message"
        });

        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U2/Online/marge.png - Marge Simpson",
            "- X2/U2/1674838000000 First Message",
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
            "#U2/Online/marge.png - Marge Simpson",
            "- X1/U2/1674839007000 New Message",
        ]);

        // new user, old message
        msgStore.syncNewMessage({
            id: "X3",
            authorId: "U3",
            timeStamp: 1674839006500,
            text: "Hello World!"
        });
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U2/Online/marge.png - Marge Simpson",
            "- X2/U2/1674838000000 First Message",
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
            "#U3/Unknown/ - ", // pending
            "- X3/U3/1674839006500 Hello World!",
            "#U2/Online/marge.png - Marge Simpson",
            "- X1/U2/1674839007000 New Message",
        ]);

        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U2/Online/marge.png - Marge Simpson",
            "- X2/U2/1674838000000 First Message",
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
            "#U3/OOO/bart.png - Bart Simpson", // updated
            "- X3/U3/1674839006500 Hello World!",
            "#U2/Online/marge.png - Marge Simpson",
            "- X1/U2/1674839007000 New Message",
        ]);

    });

    it('should reaction to message deletion', async () => {
        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });

        msgStore.syncMessageDelete("M5");
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);

        // collapse 2nd group
        msgStore.syncMessageDelete("M6");
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);

        msgStore.syncMessageDelete("M4");
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
        ]);
    });

    it('should react to user info update', async () => {
        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);

        usrStore.updateUser({ id: "U1", name: "HOMER", status: "Online" });

        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Online/homer.png - HOMER", // change
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 I guess one person can make a difference. But most of the time, they probably shouldn't.",
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Online/homer.png - HOMER", // change
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Online/homer.png - HOMER", // change
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);
    });

    it('should react to message update', async () => {
        await trax.log.awaitEvent(LOG_USER_STORE_USERS_RECEIVED, { src: usrStore.id });
        msgStore.syncMessageUpdate({
            id: "M5",
            text: "NEW TEXT"
        });
        await trax.reconciliation();
        expect(content).toMatchObject([
            "#U1/Away/homer.png - Homer Simpson",
            "- M1/U1/1674839000000 Trying is the first step towards failure.",
            "- M2/U1/1674839001000 If he's so smart, how come he's dead?",
            "#U2/Online/marge.png - Marge Simpson",
            "- M5/U2/1674839002000 NEW TEXT", // update
            "- M6/U2/1674839003000 Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.",
            "#U1/Away/homer.png - Homer Simpson",
            "- M3/U1/1674839004000 Stupidity got us into this mess, and stupidity will get us out.",
            "#U2/Online/marge.png - Marge Simpson",
            "- M7/U2/1674839005000 Aim low. Aim so low no one will even care if you succeed",
            "#U1/Away/homer.png - Homer Simpson",
            "- M4/U1/1674839006000 Give me the number for 911!",
        ]);
    });
});
