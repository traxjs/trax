import { trax } from "@traxjs/trax";
import { component, componentId, useStore } from "@traxjs/trax-react";
import { createMessageBoardStore, MessageBoardGroup } from "./messageboardstore";
import { ControlPanel } from "./controlpanel";
import { Message } from "./types";
import './css/messageboard.css';

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
        <div className="messages">
            {content}
        </div>
        <ControlPanel />
    </div>
});

const MessageGroup = component("MessageGroup", (props: { group: MessageBoardGroup }) => {
    const { group } = props;

    let avatar: any = "";
    if (group.authorAvatar) {
        avatar = <img className="avatar" alt={group.authorName} src={"/avatars/" + group.authorAvatar} />
    }
    let status: string = group.authorStatus || " ";
    if (status === "OOO") {
        status = " Out of Office ";
    } else if (status === "Unknown") {
        status = " - ";
    }

    return <div className="message-group" data-id={componentId()}>
        <div className="avatar-panel">
            {avatar}
        </div>
        <div className="content">
            <section className="author">
                <p className="author-name"> {group.authorName || " - "} </p>
                <p className={"status " + group.authorStatus.toLowerCase()}> {status} </p>
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


