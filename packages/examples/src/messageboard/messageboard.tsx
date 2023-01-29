import { trax } from "@traxjs/trax";
import { component, componentId, useStore } from "@traxjs/trax-react";
import { createMessageBoardStore, MessageBoardGroup } from "./messageboardstore";
import { Message } from "./types";
import './css/messageboard.css';
import { messageStore } from "./messagestore";

export const MessageBoard = component("MessageBoard", () => {
    const store = useStore(createMessageBoardStore);
    const data = store.data;

    let content: any = "[Loading]";
    if (!data.loading) {
        if (data.groups.length) {
            content = data.groups.map((g) => <MessageGroup key={trax.getTraxId(g)} group={g} />);
        } else {
            content = "No messages..."
        }
    }

    return <div className="message-board">
        <h1> Message Board </h1>
        {content}
        <ControlPanel />
    </div>
});

const MessageGroup = component("MessageGroup", (props: { group: MessageBoardGroup }) => {
    const { group } = props;

    let avatar: any = "";
    if (group.authorAvatar) {
        avatar = <img className="avatar" alt={group.authorName} src={"/avatars/" + group.authorAvatar} />
    }

    return <div className="message-group" data-id={componentId()}>
        <div className="avatar-panel">
            {avatar}
        </div>
        <div className="content">
            <section className="author">
                <p className="author-name"> {group.authorName || " - "} </p>
                <p className={"status " + group.authorStatus.toLowerCase()}> {group.authorStatus || " "} </p>
            </section>
            <ul className="messages">
                {group.messages.map(m =>
                    <MessageCpt message={m} key={m.id} />
                )}
            </ul>
        </div>
    </div>
});

const MessageCpt = component("MessageCpt", (props: { message: Message }) => {
    const { message } = props;

    return <li className="message" data-id={componentId()}> {message.text} </li>
});

const ControlPanel = component("ControlPanel", () => {
    const messages = messageStore.data.messages;

    return <div className="message-control-panel" data-id={componentId()}>
        <div>
            {/* <h2> Control Panel </h2> */}
            <p> Unprocessed messages, as received from the server: </p>
            <ul>
                {messages.map(m => <li>
                    <span className="meta-data">{m.id} at {m.timeStamp} from {m.authorId}: </span>
                    <span className="text">{m.text}</span>
                    <span className="del" onClick={() => messageStore.syncMessageDelete(m.id)} title="Delete this message"> ✕ </span>
                </li>)}
            </ul>
        </div>
    </div>
});
