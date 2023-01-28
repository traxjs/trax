import { Store, trax } from "@traxjs/trax";
import { messageStore as globalMessageStore, MessageStore } from "./messagestore";
import { userStore as globalUserStore, UserStore } from "./userstore";
import { Message, User } from "./types";

interface MessageGroup {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorStatus: User["status"];
    messages: Message[];
}

interface MessageBoardData {
    loading: boolean;
    groups: MessageGroup[];
}

export type MessageBoardStore = ReturnType<typeof createMessageBoardStore>;

export function createMessageBoardStore(msgStore?: MessageStore, usrStore?: UserStore) {
    const messageStore = msgStore || globalMessageStore;
    const userStore = usrStore || globalUserStore;

    return trax.createStore("MessageBoardStore", (store: Store<MessageBoardData>) => {
        const data = store.init({
            loading: true,
            groups: []
        });
        const messages = messageStore.data.messages;
        const sortedMessage = store.add("SortedMessages", []);

        store.compute("Loading", () => {
            data.loading = !messageStore.data.initialized;
        });

        store.compute("MessageSort", () => {
            messages.sort((m1, m2) => m1.timeStamp - m2.timeStamp);
        });

        store.compute("MessageGroups", () => {
            // create the MessageGroup objects based on the messages collection
            const groups: MessageGroup[] = [];
            let currentMsgGroup: MessageGroup | null = null;
            let currentMessages: Message[] = [];
            for (const msg of messages) {
                if (!currentMsgGroup || currentMsgGroup.authorId !== msg.authorId) {
                    updateCurrentMsgGroup();

                    // get or create a new group for this User/message
                    currentMsgGroup = store.add(["Group", msg.authorId, msg.id], {
                        authorId: msg.authorId,
                        authorName: "", // empty until initialized
                        authorStatus: "Unknown" as User["status"],
                        authorAvatar: "",
                        messages: []
                    });

                    // get or create a new processor
                    const g = currentMsgGroup; // we need this intermediate var to capture it in the processor generator closure
                    store.compute(["AuthorInfo", msg.authorId, msg.id], function* () {
                        const user: User | null = yield userStore.getUser(g!.authorId);
                        if (user) {
                            g!.authorName = user.name;
                            g!.authorStatus = user.status;
                            g!.authorAvatar = user.avatar;
                        }
                    });
                    groups.push(currentMsgGroup);
                }
                currentMessages.push(msg);
            }
            updateCurrentMsgGroup(); // last group

            // update the data.groups arrays without changing its reference
            trax.updateArray(data.groups, groups);

            function updateCurrentMsgGroup() {
                if (currentMsgGroup) {
                    // Update messages without changing the array reference
                    trax.updateArray(currentMsgGroup.messages, currentMessages);
                    currentMessages = [];
                };
                currentMsgGroup = null;
            }
        });

        // Store API
        return {
            data,
            deleteMessage(messageId: string) {
                // This method should normaly make a server request that
                // would translate into the following call (e.g. through SSE push event):
                messageStore.syncMessageDelete(messageId);
            }
        }
    });
};
