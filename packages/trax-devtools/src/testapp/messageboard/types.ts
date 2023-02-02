
export interface Message {
    id: string;
    authorId: string;
    timeStamp: number; // epoch time
    text: string;
}

export interface User {
    id: string;
    name: string;
    status: "Online" | "Away" | "OOO" | "Unknown";
    avatar: string;
}
