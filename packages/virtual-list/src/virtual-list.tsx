import { useEffect, useRef } from "preact/hooks";
import { component, useStore } from "@traxjs/trax-react";
import { createVirtualListStore, VlsItemBlock, VlsProps, VlsStore } from "./virtual-list-store";
import './virtual-list.css';



export const VirtualList = component("VirtualList", (props: VlsProps) => {
    const store = useStore(createVirtualListStore, props);
    const data = store.data;
    const mainDivRef = useRef(null);

    useEffect(() => {
        const div = mainDivRef.current;
        store.registerMainContainer(div!);
    }, []); // run once

    return <div ref={mainDivRef} className={"virtual-list " + props.className} style={{ overflow: "scroll" }}
        onScroll={store.notifyScroll}>
        <div className="virtual-list-content">
            {data.itemBlocks.map(item => <VirtualListItem item={item} key={item.key} store={store} />)}
        </div>
    </div>
});

const VirtualListItem = component("VirtualListItem", (props: { item: VlsItemBlock, store: VlsStore }) => {
    const { item, store } = props;
    const divRef = useRef(null);

    useEffect(() => {
        const div = divRef.current;
        store.registerBlockDomElt(item, div!);

        return function cleanup() {
            store.unregisterBlockDomElt(item, div!);
        };
    }, []); // run once

    return <div ref={divRef} className="virtual-list-item" data-block-key={item.key}>
        Item x {item.key}
    </div>
});


