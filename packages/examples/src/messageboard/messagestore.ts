import { Store, trax } from "@traxjs/trax";
import { serverAPI } from "./serverapi";
import { Message } from "./types";

interface MessageStoreData {
    initialized: boolean;
    messages: Message[];
}

/** Internal message use to ease test synchronization */
export const LOG_MESSAGE_STORE_INITIALIZED = "@traxjs/examples/messageboard/messagestore:Initialized";

export type MessageStore = ReturnType<typeof createMessageStore>;

export function createMessageStore() {
    return trax.createStore("MessageStore", (store: Store<MessageStoreData>) => {
        let serverMessages: any[];
        const data = store.init({
            messages: [],
            initialized: false
        }, {
            "init": function* (data, cc) {
                // initialize the store (async)
                cc.maxComputeCount = 1; // run once

                let messages = data.messages;
                const msgs: Message[] = yield serverAPI.getLastMessages();
                serverMessages = msgs;
                trax.updateArray(messages, messages.concat(msgs));
                data.initialized = true;
                trax.log.event(LOG_MESSAGE_STORE_INITIALIZED, { src: store.id });
            }
        });

        const messages = data.messages;

        return {
            data,
            // The following methods should be called following SSE events received from the server
            syncNewMessage(m: Message) {
                messages.push(m);
            },
            syncMessageDelete(messageId: string) {
                const idx = messages.findIndex((msg) => msg.id === messageId);
                (idx > -1) && messages.splice(idx, 1);
            },
            syncMessageUpdate(m: Partial<Message> & { id: string }) {
                const msg = messages.find((msg) => msg.id === m.id);
                if (msg) {
                    // update exisiting message
                    updateProp(msg, "authorId", m.authorId);
                    updateProp(msg, "timeStamp", m.timeStamp);
                    updateProp(msg, "text", m.text);
                }
                function updateProp(o: any, propName: string, propValue: any) {
                    if (propValue !== undefined) {
                        o[propName] = propValue;
                    }
                }
            },
            reset() {
                // reset original messages
                trax.updateArray(messages, serverMessages);
            }
        }
    });
}

// Message store singleton
export const messageStore = createMessageStore();
