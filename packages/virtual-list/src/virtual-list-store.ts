import { Store, trax, TraxObject } from "@traxjs/trax";
import { checkListLayout } from "./list-layout";


export interface VlsProps<Item extends TraxObject = any> {
    /** CSS class to apply to the virtual list container - must define the list dimensions */
    className: string;
    /** Number of items displayed on first display - default: 30 */
    initialPageSize?: number;
    /** List of items to display, can be mutated. NB: items must be trax objects */
    items: Item[];
    /** 
     * Index of the item that must be set into view. 
     * NB: this prop is a reference to an immutable number object and it will only be interpreted when the reference changes
     * e.g. indexIntoView={new Number(0)} (because new Number(0) !== new Number(0) as 2 different objects are created)
     * Default: new Number(0)
     */
    indexIntoView?: Number;
    /** Number of hidden items that should be kept in the DOM before before/after the first/last visible items */
    bufferSize?: number;
}

export interface VlsItemBlock<Item = any> {
    item: Item;
    /** Unique item key (trax id) */
    key: string;
    /** Top or left - negative when unset */
    pos: number;
    /** Position set in the DOM */
    domPos: number;
    /** Height or width - -1 when item hasn't been rendered yet*/
    size: number;
    /** Item's div reference */
    domRef: HTMLDivElement | null;
    /** True if item is observed by resize observer */
    observed: boolean;
}

interface VlsData<Item extends TraxObject = any> {
    /** Item list provided by the component user */
    items: Item[];
    /** Number of items to display - can be updated depending on item visibility */
    pageSize: number;
    /** First item to display */
    startIndex: number;
    /** Number of non visible items to keep displayed before first / after last */
    bufferSize: number;
    /** [computed] Items selected by the controller to be rendered */
    itemBlocks: VlsItemBlock<Item>[];

}

const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_BUFFER_SIZE = 5;
const UNSET_POS = -10000;

export type VlsStore = ReturnType<typeof createVirtualListStore>;

export function createVirtualListStore(props: VlsProps) {
    return trax.createStore("VirtualListStore", (store: Store<VlsData>) => {
        /** Main div container */
        let container: HTMLDivElement | null = null;
        let containerSize = -1;
        let scrollPos = 0;

        const data = store.init({
            items: props.items,
            pageSize: props.initialPageSize || DEFAULT_PAGE_SIZE,
            startIndex: 0, // TODO
            bufferSize: props.bufferSize || DEFAULT_BUFFER_SIZE,
            itemBlocks: []
        }, (data) => {
            // check that startIndex is compatible with pageSize (may need to change if item collection is updated)
            // and that buffer and page size are consistent
            let bufferSize = data.bufferSize;
            if (bufferSize < 1) {
                bufferSize = data.bufferSize = 1;
            }
            let pageSize = data.pageSize;
            if (pageSize < 2 * bufferSize + 1) {
                pageSize = data.pageSize = 2 * bufferSize + 1;
            }

            // TODO: start index
            const len = data.items.length;
            if (data.startIndex < 0 || data.startIndex >= len) {
                data.startIndex = 0;
            }

        }, (data) => {
            // select item to be displayed based on pageSize and startIndex
            const items = data.items;
            const len = items.length;
            const newItems: VlsData["itemBlocks"] = [];
            const pageSize = data.pageSize;
            console.log("NEW ITEMS")
            let count = 0;
            for (let i = data.startIndex; len > i; i++) {
                const itm = items[i];
                const block = store.add(["ItemBlock", itm], {
                    item: itm,
                    key: "ItemBlock:" + trax.getTraxId(itm),
                    pos: UNSET_POS,
                    domPos: -1000, // value in CSS
                    size: -1,
                    domRef: null,
                    observed: false
                });
                newItems.push(block);
                count++;
                if (count === pageSize) break;
            }
            trax.updateArray(data.itemBlocks, newItems);
        });
        // TODO ensure that enough buffer before/after first/last item

        /**
         * Observe the size of the item blocks
         */
        const rszObserver = new ResizeObserver((entries) => {
            const itemBlocks = data.itemBlocks;
            for (const entry of entries) {
                const blockKey = (entry.target as HTMLDivElement).dataset.blockKey;
                if (blockKey) {
                    const block = itemBlocks.find((v) => v.key === blockKey);
                    if (block) {
                        block.size = entry.contentRect.height;
                    }
                } else {
                    // this is the container
                    containerSize = entry.contentRect.height;
                }
            }
            checkLayout();
        });

        // /**
        //  * Observe the visibility of the Item blocks and update the data model when it changes
        //  */
        // const itsObserver = new IntersectionObserver((entries) => {
        //     const itemBlocks = data.itemBlocks;
        //     for (const entry of entries) {
        //         const blockKey = (entry.target as HTMLDivElement).dataset.blockKey;
        //         const block = itemBlocks.find((v) => v.key === blockKey);
        //         if (block) {
        //             block.visibility = entry.intersectionRatio;
        //             // console.log("--------------> block.visibility", block.index, block.visibility);
        //         } else {
        //             console.log("ERR")
        //         }
        //     }
        //     checkPageSize(data);
        // }, {
        //     root: document.querySelector('.virtual-list'),
        //     rootMargin: '0px',
        //     threshold: 0.1
        // });

        function checkLayout() {
            const r = checkListLayout(data.itemBlocks, scrollPos, containerSize, data.bufferSize);
            if (r && container) {
                if (r.scrollPos !== scrollPos) {
                    scrollPos = r.scrollPos;
                    container.scrollTop = scrollPos;
                }

                if (r.startShift !== 0) {
                    let startIndex = data.startIndex;
                    let pageSize = r.pageSize;
                    startIndex += r.startShift;
                    if (startIndex < 0) {
                        pageSize += startIndex;
                        startIndex = 0;
                    }
                    data.startIndex = startIndex;
                    data.pageSize = pageSize;
                } else {
                    data.pageSize = r.pageSize;
                }

                // update the item positions
                for (const item of data.itemBlocks) {
                    const ref = item.domRef;
                    if (ref) {
                        // if (item.pos === 0) {
                        //     console.log("0 for ", item.key, data.itemBlocks);
                        // }
                        ref.style.top = item.pos + "px";
                        // item.domPos = item.pos;
                    }
                    // if (item.key === "ItemBlock:TestStore/root*messages*0") {
                    //     console.log("ITEM update", item)
                    // }
                }
            }
        }

        return {
            data,
            registerMainContainer(div: HTMLDivElement) {
                container = div;
                container.scrollTop = scrollPos;
                rszObserver.observe(div);
            },
            registerBlockDomElt(block: VlsItemBlock, div: HTMLDivElement) {
                if (div && !block.observed) {
                    block.observed = true;
                    block.domRef = div;
                    rszObserver.observe(div);
                }
            },
            unregisterBlockDomElt(block: VlsItemBlock, div: HTMLDivElement) {
                if (div && block.observed) {
                    block.observed = false;
                    block.domRef = div;
                    rszObserver.unobserve(div);
                }
            },
            dispose() {
                rszObserver.disconnect();
            },
            notifyScroll() {
                if (container) {
                    scrollPos = container!.scrollTop;
                    checkLayout();
                }
            }
        }

    })
}


// function checkPageSize(data: VlsData) {
//     const bufferSize = data.bufferSize;
//     const blocks = data.itemBlocks;
//     let visibleFound = false, visible = true;
//     let firstVisibleIdx = 0, lastVisibleIdx = 0;
//     let invisibleFirstCount = 0, visibleCount = 0;
//     for (const block of blocks) {
//         visible = block.visibility > 0.1;
//         if (block.size < 0) {
//             // This occurs when itsObserver is called before rszObserver
//             return; // will be called again
//         }
//         if (!visibleFound) {
//             if (visible) {
//                 firstVisibleIdx = block.index;
//                 visibleFound = true;
//             } else {
//                 invisibleFirstCount++;
//             }
//         }
//         if (visibleFound) {
//             if (visible) {
//                 lastVisibleIdx = block.index;
//             }
//         }
//     }
//     if (!visibleFound) {
//         // itsObserver hasn't been called yet
//         return;
//     }

//     const currentStartIdx = data.startIndex;
//     let newStartIdx = currentStartIdx;
//     let startBuffer = bufferSize;

//     // if (invisibleFirstCount > bufferSize) {
//     //     newStartIdx += invisibleFirstCount - bufferSize;
//     //     invisibleFirstCount = bufferSize;
//     // } else if (invisibleFirstCount < bufferSize) {
//     //     newStartIdx -= bufferSize - invisibleFirstCount;
//     //     if (newStartIdx < 0) {
//     //         newStartIdx = 0;
//     //         startBuffer = invisibleFirstCount;
//     //     }
//     // }
//     if (firstVisibleIdx < bufferSize) {
//         startBuffer = firstVisibleIdx;
//         if (startBuffer < 0) {
//             startBuffer = 0;
//         }
//     }
//     newStartIdx = firstVisibleIdx - startBuffer;

//     let pageSize = startBuffer + lastVisibleIdx - firstVisibleIdx + bufferSize;

//     if (pageSize !== data.pageSize) {
//         console.log("NEW PAGE SIZE:", pageSize, lastVisibleIdx, firstVisibleIdx);
//         data.pageSize = pageSize;
//     }

//     // console.log("first visible:", firstVisibleIdx, "last visible:", firstVisibleIdx + visibleCount - 1, "invisibleLastCount:", invisibleLastCount)

//     if (newStartIdx !== currentStartIdx) {
//         console.log("NEW STARTIDX:", newStartIdx);
//         data.startIndex = newStartIdx;

//         if (newStartIdx > currentStartIdx) {
//             // element will be removed
//             let scrollShift = 0;
//             for (let i = currentStartIdx; i < newStartIdx; i++) {
//                 if (blocks[i] && blocks[i].size > 0) {
//                     scrollShift += blocks[i].size;
//                 }
//                 console.log("DEL", i)
//             }

//             if (scrollShift > 0) {
//                 const div = document.querySelector('.virtual-list')!;
//                 const stp = div.scrollTop - scrollShift
//                 console.log("new scrollTop", div.scrollTop, scrollShift)
//                 div.scrollTop = stp;
//                 // console.log("new scrollTop2", div.scrollTop)
//             }
//         }

//     }


// }
