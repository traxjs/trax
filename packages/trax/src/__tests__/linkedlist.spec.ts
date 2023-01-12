import { describe, expect, it } from 'vitest';
import { LinkedList } from '../linkedlist';

describe('Linked List', () => {

    function toString(list: LinkedList<string>) {
        const arr: string[] = [];
        let item = list.head;
        while (item) {
            arr.push(item.value);
            item = item.next;
        }
        return arr.join(":");
    }

    it('should support add, peek and shift', async function () {
        const list = new LinkedList<any>();

        expect(list.size).toBe(0);
        expect(list.head).toBe(undefined);
        expect(list.peek()).toBe(undefined);
        expect(list.shift()).toBe(undefined);

        // number
        list.add(123);
        expect(list.size).toBe(1);
        expect(list.head!.value).toBe(123);
        expect(list.head!.next).toBe(undefined);
        expect(list.peek()).toBe(123);
        const h1 = list.head!; // check if it will be reused

        // string
        list.add("ABC");
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
        list.add(obj);
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
        list.add("XYZ");
        expect(list.size).toBe(1);
        expect(list.head).toBe(h1); // reused
        expect(list.peek()).toBe("XYZ");

        // add again
        list.add("DEF");
        expect(list.size).toBe(2);
        expect(list.head).toBe(h2); // reused
        expect(list.peek()).toBe("DEF");
    });

    it('should support item removal', async function () {
        const list = new LinkedList<any>();
        list.add("A");
        list.add("B");
        list.add("C");
        list.add("A");
        list.add("D");

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

        list.add("X");
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
    });

    it('should support insert with empty function', async () => {
        const list = new LinkedList<string>();
        const noop = (prev?: string, next?: string) => { };

        list.insert(noop);
        expect(list.size).toBe(0);
        expect(toString(list)).toBe("");

        list.add("A");
        list.insert(noop);
        expect(list.size).toBe(1);
        expect(toString(list)).toBe("A");

        list.add("B");
        list.insert(noop);
        expect(list.size).toBe(2);
        expect(toString(list)).toBe("B:A");
    });

    it('should support insert', async () => {
        const list = new LinkedList<string>();
        let letter = "A";
        const ins = (prev?: string, next?: string) => {
            if ((prev && letter < prev) || (next && letter > next)) {
                return;
            }
            return letter;
        };

        letter = "D";
        list.insert(ins);
        expect(list.size).toBe(1);
        expect(toString(list)).toBe("D");

        letter = "B";
        list.insert(ins);
        expect(list.size).toBe(2);
        expect(toString(list)).toBe("B:D");

        letter = "F";
        list.insert(ins);
        expect(list.size).toBe(3);
        expect(toString(list)).toBe("B:D:F");

        letter = "C";
        list.insert(ins);
        expect(list.size).toBe(4);
        expect(toString(list)).toBe("B:C:D:F");

        letter = "A";
        list.insert(ins);
        expect(list.size).toBe(5);
        expect(toString(list)).toBe("A:B:C:D:F");

        letter = "E";
        list.insert(ins);
        expect(list.size).toBe(6);
        expect(toString(list)).toBe("A:B:C:D:E:F");

        letter = "G";
        list.insert(ins);
        expect(list.size).toBe(7);
        expect(toString(list)).toBe("A:B:C:D:E:F:G");
    });
});

