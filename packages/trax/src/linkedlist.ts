
interface $ListItem<T> {
    value: T;
    next?: $ListItem<T>;
}

/**
 * Pool of disposed items that can be reused
 */
let itemPool: $ListItem<any> | undefined;

/**
 * Add a list item to the item pool
 * @param itm 
 */
function addToPool(itm: $ListItem<any>) {
    itm.value = null as any;
    itm.next = itemPool;
    itemPool = itm;
}

/**
 * Get an item from the pool
 * @returns
 */
function getItemFromPool<T>(value: T, next?: $ListItem<T>) {
    if (itemPool) {
        const itm = itemPool;
        itemPool = itm.next;
        itm.value = value;
        itm.next = next;
        return itm;
    }
    return undefined;
}

/**
 * Simple Linked list that can be used to manage stacks
 * Object properties are voluntarily kept minimal to minimize memory footprint
 */
export class LinkedList<T> {
    private _head?: $ListItem<T>;
    private _size: number = 0;

    get head(): $ListItem<T> | undefined {
        return this._head;
    }

    get size(): number {
        return this._size;
    }

    /**
     * Add a new value at the head of the list
     * @param value 
     * @returns the list item
     */
    add(value: T): $ListItem<T> {
        const h = this._head;
        let itm: $ListItem<T> = getItemFromPool(value, h) || { value, next: h };
        this._head = itm;
        this._size++;
        return itm;
    }

    /**
     * Insert an item in the lhe linked list
     * @param fn function that decides where to insert the item. 
     * Once the function returns an item, the iteration will stop
     */
    insert(fn: (prev?: T, next?: T) => T | void) {
        let nd = this._head;
        let v: T | undefined;
        if (!nd) {
            v = fn() || undefined;
            if (v !== undefined) {
                this.add(v);
            }
        } else {
            let prev: $ListItem<T> | undefined;
            while (prev || nd) {
                v = fn(prev?.value, nd?.value) || undefined;
                if (v !== undefined) {
                    // insert the item
                    let itm: $ListItem<T> = getItemFromPool(v, nd) || { value: v, next: nd };
                    if (prev) {
                        prev.next = itm;
                    } else {
                        this._head = itm;
                    }
                    this._size++;
                    return;
                }
                prev = nd
                nd = nd?.next;
            }
        }
    }

    /**
     * Return the item value at the head of the list,
     * but doesn't remove it from the list
     * @returns the head value or undefined
     */
    peek(): T | undefined {
        return this._head ? this._head.value : undefined;
    }

    /**
     * Return the item value at the head of the list,
     * and remove it from the list
     * @returns the head value or undefined
     */
    shift(): T | undefined {
        const h = this._head;
        if (h) {
            const v = h.value;
            this._head = h.next;
            this._size--;
            addToPool(h);
            return v;
        }
        return undefined;
    }

    /**
     * Scan the list and remove the first item with the corresponding value
     * @param value 
     * @returns true if an item was found and removed
     */
    remove(value: T): boolean {
        let item = this._head, last: $ListItem<T> | null = null;
        while (item) {
            if (item.value === value) {
                if (last) {
                    // remove item
                    last.next = item.next;
                    this._size--;
                    addToPool(item);
                } else {
                    // value is the first item
                    this.shift();
                }
                return true;
            }
            last = item;
            item = item.next;
        }
        return false;
    }
}
