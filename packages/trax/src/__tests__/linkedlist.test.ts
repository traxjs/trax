import { describe, expect, it } from 'vitest';
import { LinkedList } from '../linkedlist';

describe('Linked List', () => {
    it('should support insert, peek and shift', async function () {
        const list = new LinkedList<any>();

        expect(list.size).toBe(0);
        expect(list.head).toBe(undefined);
        expect(list.peek()).toBe(undefined);
        expect(list.shift()).toBe(undefined);

        // number
        list.insert(123);
        expect(list.size).toBe(1);
        expect(list.head!.value).toBe(123);
        expect(list.head!.next).toBe(undefined);
        expect(list.peek()).toBe(123);
        const h1 = list.head!; // check if it will be reused

        // string
        list.insert("ABC");
        expect(list.size).toBe(2);
        expect(list.head!.value).toBe("ABC");
        expect(list.head!.next).toBe(h1);
        expect(list.peek()).toBe("ABC");
        const h2 = list.head!; // check if it will be reused

        // shift #1
        let v = list.shift();
        expect(v).toBe("ABC");
        expect(list.size).toBe(1);
        expect(list.head).toBe(h1);
        expect(list.peek()).toBe(123);

        // objects
        const obj = { hello: "world" };
        list.insert(obj);
        expect(list.size).toBe(2);
        expect(list.head!.value).toBe(obj);
        expect(list.head!.next).toBe(h1);
        expect(list.peek()).toBe(obj);
        expect(list.head).toBe(h2); // reused

        // shift #2
        v = list.shift();
        expect(v).toBe(obj);
        expect(list.size).toBe(1);
        expect(list.head).toBe(h1);
        expect(list.peek()).toBe(123);

        // shift #3
        v = list.shift();
        expect(v).toBe(123);
        expect(list.size).toBe(0);
        expect(list.head).toBe(undefined);

        // add again
        list.insert("XYZ");
        expect(list.size).toBe(1);
        expect(list.head).toBe(h1); // reused
        expect(list.peek()).toBe("XYZ");

        // add again
        list.insert("DEF");
        expect(list.size).toBe(2);
        expect(list.head).toBe(h2); // reused
        expect(list.peek()).toBe("DEF");
    });


    it('should support max length', async function () {
        const list = new LinkedList<any>();

        expect(list.size).toBe(0);
        expect(list.head).toBe(undefined);
        // expect(list.shift()).toBe(undefined);

    });

    it('should support item removal', async function () {
        const list = new LinkedList<any>();
        list.insert("A");
        list.insert("B");
        list.insert("C");
        list.insert("A");
        list.insert("D");

        // items are in reverse order:
        expect(toString(list)).toBe("D:A:C:B:A");

        let v = list.remove("A");
        expect(v).toBe(true);
        expect(list.size).toBe(4);
        expect(toString(list)).toBe("D:C:B:A");

        v = list.remove("X");
        expect(v).toBe(false);
        expect(list.size).toBe(4);
        expect(toString(list)).toBe("D:C:B:A");

        v = list.remove("D");
        expect(v).toBe(true);
        expect(list.size).toBe(3);
        expect(toString(list)).toBe("C:B:A");

        v = list.remove("A");
        expect(v).toBe(true);
        expect(list.size).toBe(2);
        expect(toString(list)).toBe("C:B");

        list.shift();
        expect(list.size).toBe(1);
        expect(toString(list)).toBe("B");

        list.insert("X");
        expect(list.size).toBe(2);
        expect(toString(list)).toBe("X:B");

        v = list.remove("Y");
        expect(v).toBe(false);
        expect(list.size).toBe(2);
        expect(toString(list)).toBe("X:B");

        list.shift();
        v = list.remove("B");
        expect(v).toBe(true);
        expect(list.size).toBe(0);
        expect(toString(list)).toBe("");

        function toString(list: LinkedList<string>) {
            const arr: string[] = [];
            let item = list.head;
            while (item) {
                arr.push(item.value);
                item = item.next;
            }
            return arr.join(":");
        }
    });
});

