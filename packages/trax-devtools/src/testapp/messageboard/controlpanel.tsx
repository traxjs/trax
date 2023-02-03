import { trax } from "@traxjs/trax";
import { component, componentId } from "@traxjs/trax-react";
import { useTraxState } from "@traxjs/trax-react/lib/core";
import './css/messageboard.css';
import { messageStore } from "./messagestore";
import { users } from "./serverapi";
import { userStore } from "./userstore";

export const ControlPanel = component("ControlPanel", () => {
    const messages = messageStore.data.messages;
    const uid = componentId();
    const state = useTraxState({
        selectedUser: "U1",
        newMessageCount: 0
    });

    return <div className="message-control-panel" data-id={componentId()}>
        <div>
            <h2> Control Panel </h2>

            <div>
                <p className="server-sim">
                    Simulate Server notifications:
                </p>
                <div className="users">
                    {Object.keys(users).map((k) => {
                        const user = users[k];
                        // create a unique htmlId for this component instance
                        const htmlId = uid + "-" + user.id;
                        return <>
                            <input id={htmlId} type="radio" value={user.id} name="user"
                                checked={state.selectedUser === user.id}
                                onChange={() => state.selectedUser = user.id} />
                            <label htmlFor={htmlId}> {user.id}({user.name}) </label>
                        </>
                    })}
                </div>
                <div className="user-actions">
                    <span className="label">Update user info: </span>
                    {
                        ["Online", "Away", "OOO", "Unknown"].map(status =>
                            <button className="change-status" onClick={() => setUserStatus(status as any)}>
                                {status}
                            </button>
                        )
                    }
                    <span className="label"> - </span>
                    <button className="change-name" onClick={toggleUserName}>
                        Update Name
                    </button>
                    <span className="label"> - </span>
                    <button className="change-avatar" onClick={toggleAvatar}>
                        Update Avatar
                    </button>
                </div>
                <div>
                    <span className="label">Add new Message: </span>
                    <button className="add-msg" onClick={() => addMessage("First")}>First</button>
                    <button className="add-msg" onClick={() => addMessage("Middle")}>Middle</button>
                    <button className="add-msg" onClick={() => addMessage("Last")}>Last</button>
                </div>
            </div>
        </div>
        {messages.length > 100 ? "" : <>
            <p className="messages"> Unprocessed messages, as received from the server: </p>
            <ul className="messages">
                {messages.map(m => <li>
                    <span className="meta-data">{m.id} at {m.timeStamp} from {m.authorId}: </span>
                    <span className="text">{m.text}</span>
                    <span className="del" onClick={() => messageStore.syncMessageDelete(m.id)} title="Delete this message"> ✕ </span>
                </li>)}
            </ul>
            <button className="add-msg-1000" onClick={() => add1000Messages()}>Add 1000 messages</button>
        </>
        }
    </div >

    function setUserStatus(status: "Online" | "Away" | "OOO" | "Unknown") {
        userStore.updateUser({ id: state.selectedUser, status });
    }

    async function toggleUserName() {
        const usr = await userStore.getUser(state.selectedUser);
        if (usr) {
            const name = usr.name;
            userStore.updateUser({
                id: state.selectedUser,
                name: name.match(/[a-z]/) ? name.toLocaleUpperCase() : users[state.selectedUser].name
            });
        }
    }

    async function toggleAvatar() {
        const usr = await userStore.getUser(state.selectedUser);
        if (usr) {
            const avatar = usr.avatar;
            userStore.updateUser({
                id: state.selectedUser,
                avatar: avatar === "ned.png" ? users[state.selectedUser].avatar : "ned.png"
            });
        }
    }

    function addMessage(position: "First" | "Middle" | "Last") {
        const idx = state.newMessageCount % homerQuotes.length;
        state.newMessageCount++;
        let minTs = Number.MAX_SAFE_INTEGER, maxTs = 0;
        if (messages.length === 0) {
            minTs = maxTs = 1674839000000;
        } else {
            messages.forEach(m => {
                const ts = m.timeStamp;
                if (ts > maxTs) {
                    maxTs = ts;
                }
                if (ts < minTs) {
                    minTs = ts;
                }
            });
        }
        let timeStamp = 0;
        if (position === "First") {
            timeStamp = minTs - 1000;
        } else if (position === "Last") {
            timeStamp = maxTs + 1000;
        } else {
            timeStamp = Math.floor((minTs + maxTs) / 2);
        }

        // Add Message: First, Middle, Last
        messageStore.syncNewMessage({
            id: "X" + state.newMessageCount,
            authorId: state.selectedUser,
            timeStamp,
            text: homerQuotes[idx]
        });
    }

    function add1000Messages() {
        const userIds = Object.keys(users);
        let ts = 1674839000000;
        let count = state.newMessageCount;
        const quoteLength = homerQuotes.length;
        let userIdIdx = 0;
        let groupCount = 0;
        for (let i = 0; 1000 > i; i++) {
            ts += 1000;
            count++;
            groupCount++;
            const idx = count % quoteLength;
            if (groupCount > userIdIdx) {
                userIdIdx++;
                groupCount = 0;
            }
            if (userIdIdx >= userIds.length) {
                userIdIdx = 0;
            }
            messageStore.syncNewMessage({
                id: "X" + count,
                authorId: userIds[userIdIdx],
                timeStamp: ts,
                text: homerQuotes[idx]
            });
        }
        state.newMessageCount = count;
    }
});

const homerQuotes: string[] = [
    "It's so simple to be wise… just think of something stupid to say and then don't say it",
    "English? Who needs that? I'm never going to England.",
    "I think the saddest day of my life was when I realised I could beat my dad at most things, and Bart experienced that at the age of four.",
    "I hope I didn't brain my damage.",
    "Roads are just a suggestion Marge, just like pants.",
    "Kids are great. You can teach them to hate what you hate and, with the Internet and all, they practically raise themselves.",
    "My beer! You never had a chance to become my urine!",
    "Okay. I'm not going to kill you, but I'm going to tell you three things that will haunt you the rest of your days. You ruined your father. You crippled your family. And baldness is hereditary!",
    "Facts are meaningless. You could use facts to prove anything that's even remotely true!",
    "All right, brain. You don't like me and I don't like you, but let's just do this and I can get back to killing you with beer.",
    "I'm in no condition to drive…wait! I shouldn't listen to myself, I'm drunk!",
    "I'm a white male, age 18 to 49. Everyone listens to me, no matter how dumb my suggestions are."
]



