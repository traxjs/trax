import { Store, trax } from "@traxjs/trax";
import { messageStore as globalMessageStore, MessageStore } from "./messagestore";
import { userStore as globalUserStore, UserStore } from "./userstore";
import { Message, User } from "./types";

export interface MessageBoardGroup {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorStatus: User["status"];
    messages: Message[];
}

interface MessageBoardData {
    loading: boolean;
    groups: MessageBoardGroup[];
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
        const messageStoreMsgs = messageStore.data.messages;

        store.compute("Loading", () => {
            data.loading = !messageStore.data.initialized;
        });

        store.compute("MessageGroups", () => {
            // we need to clone messages as sort mutates the array 
            // and we don't want to sort the messageStore collection
            const messages = messageStoreMsgs.slice(0);
            messages.sort((m1, m2) => m1.timeStamp - m2.timeStamp);

            // create the MessageGroup objects based on the messages collection
            const groups: MessageBoardGroup[] = [];
            let currentMsgGroup: MessageBoardGroup | null = null;
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

        // Simply expose the data as API
        return {
            data
        }
    });
};
