import { Message, User } from "./types";

const BASE_TS = 1674839000000;

/**
 * Mock API to simulate data that should be otherwise
 * fetched from the server
 */
export const serverAPI = {
    async getLastMessages(): Promise<Message[]> {
        await pause(50); // simulate network latency
        const msgs: Message[] = [];
        let count = 1;

        add("U1", 0, "Trying is the first step towards failure.");
        add("U1", 1000, "If he's so smart, how come he's dead?");
        add("U1", 4000, "Stupidity got us into this mess, and stupidity will get us out.");
        add("U1", 6000, "Give me the number for 911!");
        add("U2", 2000, "I guess one person can make a difference. But most of the time, they probably shouldn't.");
        add("U2", 3000, "Homer, we have to do something. Today Bart's drinking people's blood. Tomorrow he could be smoking.");
        add("U2", 5000, "And all this time I Thought 'Googling Yourself' Meant The Other Thing");

        return msgs;
        function add(userId: string, tsShift: number, text: string) {
            msgs.push({
                id: "M" + (count++),
                authorId: userId,
                timeStamp: BASE_TS + tsShift,
                text
            });
        };
    },
    async getUsers(ids: string[]): Promise<User[]> {
        await pause(50); // simulate network latency
        let res: User[] = [];
        let processedIds = new Set<string>();
        for (let id of ids) {
            if (!processedIds.has(id)) {
                processedIds.add(id);
                if (users[id]) {
                    res.push(users[id]);
                }
            }
        }
        return res;
    }
}

async function pause(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const users: { [id: string]: User } = {
    "U1": {
        id: "U1",
        name: "Homer Simpson",
        status: "Away",
        avatar: "homer.png"
    },
    "U2": {
        id: "U2",
        name: "Marge Simpson",
        status: "Online",
        avatar: "marge.png"
    },
    "U3": {
        id: "U3",
        name: "Bart Simpson",
        status: "OOO",
        avatar: "bart.png"
    },
    "U4": {
        id: "U4",
        name: "Lisa Simpson",
        status: "Online",
        avatar: "lisa.png"
    },
    "U5": {
        id: "U5",
        name: "Maggie Simpson",
        status: "Away",
        avatar: "maggie.png"
    }
}