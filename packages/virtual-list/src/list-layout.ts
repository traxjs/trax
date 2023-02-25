



export interface ListItem {
    key: string;
    /** Top or Left - negative if unset */
    pos: number;
    /** Height or Width - negative if unset */
    size: number;
}





export function checkListLayout(items: ListItem[], scrollPos: number, containerSize: number, bufferSize: number, focusKey?: string): null | {
    startShift: number; endShift: number; pageSize: number; scrollPos: number
} {
    const r = {
        startShift: 0,
        endShift: 0,
        pageSize: -1,
        scrollPos
    }

    const len = items.length;

    if (len === 0) return null;

    /** The following values are computed by the scan function */
    let listSize = 0; // cumulated size of all list items
    let firstVisibleIdx = -1, lastVisibleIdx = -1;
    let avgSize = 0;
    let lastEmptyArea = 0;

    if (!scanList()) return null; // list is not ready yet

    if (firstVisibleIdx < 0) {
        // make all items visible
        r.scrollPos = scrollPos = 0;
        setPositions(0);

        // scan again
        scanList();
    }

    if (firstVisibleIdx < 0) return null;

    if (lastVisibleIdx < len - 1) {
        // update last items position
        let p = items[lastVisibleIdx].pos + items[lastVisibleIdx].size;
        for (let i = lastVisibleIdx + 1; len > i; i++) {
            const itm = items[i];
            itm.pos = p;
            p += itm.size;
        }
    }

    if (firstVisibleIdx > 0) {
        // set the position of the first items
        let p = items[firstVisibleIdx].pos;
        for (let i = firstVisibleIdx - 1; i >= 0; i--) {
            const itm = items[i];
            itm.pos = p - itm.size;
            p -= itm.size;
        }

        if (items[0].pos !== 0) {
            const scrollShift = -items[0].pos;
            scrollPos = r.scrollPos = scrollPos + scrollShift;
            // setPositions(0); // shift all pos
            // scanList();
        }

    }
    setPositions(0); // shift all pos

    scanList();

    r.startShift = firstVisibleIdx - bufferSize;
    if (lastEmptyArea > 0) {
        console.log("BB", lastEmptyArea, avgSize)
        r.endShift = lastVisibleIdx + Math.ceil(lastEmptyArea / avgSize) + bufferSize - len + 1;
    } else {
        r.endShift = lastVisibleIdx + bufferSize - len + 1;
    }

    r.pageSize = len - r.startShift + r.endShift;

    return r;

    function scanList(): boolean {
        listSize = 0;
        firstVisibleIdx = -1;
        lastVisibleIdx = -1;
        avgSize = 0;

        if (len === 0) return false;

        for (let i = 0; len > i; i++) {
            const item = items[i];
            const sz = item.size;
            if (sz < 0) return false; // list is not ready yet
            listSize += sz;
            if (item.pos > -1 && visibility(item.pos, sz, scrollPos, containerSize) !== HIDDEN) {
                lastVisibleIdx = i;
                if (firstVisibleIdx < 0) {
                    firstVisibleIdx = i;
                }
            }
        }
        avgSize = listSize / len;

        const containerEnd = Math.ceil(scrollPos + containerSize);
        const lastItemEnd = scrollPos + items[len - 1].pos + items[len - 1].size;
        if (lastItemEnd < containerEnd && items[len - 1].pos >= 0) {
            console.log("lastEmptyArea", containerEnd, lastItemEnd)
            lastEmptyArea = containerEnd - lastItemEnd;
        } else {
            lastEmptyArea = 0;
        }

        return true;
    }

    function setPositions(startPos: number) {
        let p = startPos;
        for (let item of items) {
            item.pos = p;
            p += item.size;
        }
    }
}

const FULLY_VISIBLE = "FV", PARTLY_VISIBLE = "PV", HIDDEN = "H";

function visibility(pos: number, size: number, scrollPos: number, containerSize: number) {
    const start = Math.ceil(pos);
    const end = Math.floor(pos) + size;
    const containerStart = Math.floor(scrollPos);
    const containerEnd = Math.ceil(scrollPos + containerSize);

    if ((containerStart <= start && start < containerEnd)  // start is visible
        || (containerStart < end && end <= containerEnd)   // end is visible
        || (start <= containerStart && containerEnd <= end)) {  // parts in the middle are visible
        if (containerStart <= start && end <= containerEnd) {
            return FULLY_VISIBLE;
        }
        return PARTLY_VISIBLE;
    }

    return HIDDEN;
}
