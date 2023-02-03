import { Store, trax } from "@traxjs/trax";
import { serverAPI } from "./serverapi";
import { User } from "./types";

interface UserStoreData {
    [userId: string]: User;
}

/** Internal message use to ease test synchronization */
export const LOG_USER_STORE_GET_USERS = "@traxjs/examples/messageboard/userstore:GetUsers";
export const LOG_USER_STORE_USERS_RECEIVED = "@traxjs/examples/messageboard/userstore:UsersReceived";

export type UserStore = ReturnType<typeof createUserStore>;

export function createUserStore() {
    return trax.createStore("UserStore", (store: Store<UserStoreData>) => {
        const users = store.init({});
        let pendingRequestTimer: any = null;
        let pendingUserPromises = new Map<string, Promise<User | null>>();
        let pendingUserResolvers = new Map<string, (u: User | null) => void>();
        let pendingUserRequests = new Map<string, number>();
        let requestCount = 0;

        return {
            /** Return cached user or batch user requests to limit server requests */
            getUser,
            updateUser: store.async(function* (user: Partial<User> & { id: string }) {
                let u = users[user.id];
                if (!u) {
                    u = yield getUser(user.id);
                }
                if (u) {
                    // update user content but keep the same object
                    u.name = user.name || u.name;
                    u.status = user.status || u.status;
                    u.avatar = user.avatar || u.avatar;
                }
            })
        }

        async function getUser(id: string): Promise<User | null> {
            const usr = users[id]; // user is in cache
            if (usr) return usr;

            // buffer multiple calls in one server request
            if (!pendingUserPromises.get(id)) {
                pendingUserPromises.set(id, new Promise(resolve => {
                    pendingUserResolvers.set(id, resolve);
                }));
                if (!pendingRequestTimer) {
                    pendingRequestTimer = setTimeout(submitPendingRequest, 10);
                }
            }
            return pendingUserPromises.get(id) as Promise<User>;
        }

        async function submitPendingRequest() {
            // call the server and resolve all pending promises
            pendingRequestTimer = null;
            const userIds: string[] = [];
            const count = ++requestCount;
            for (let k of pendingUserPromises.keys()) {
                if (!pendingUserRequests.get(k)) {
                    pendingUserRequests.set(k, count);
                    userIds.push(k);
                }
            }
            if (userIds.length) {
                trax.log.event(LOG_USER_STORE_GET_USERS, { src: store.id });
                const response = await serverAPI.getUsers(userIds);

                for (let user of response) {
                    const id = user.id;
                    const usr = store.add(["User", id], user); // add to store - usr = trax object
                    users[id] = usr; // store the user in the cache
                    resolvePromise(id, usr);
                }
                // manage case where server didn't return all the requested users
                // return null in this case
                for (let k of pendingUserRequests) {
                    if (k[1] === count) {
                        resolvePromise(k[0], null);
                    }
                }
                trax.log.event(LOG_USER_STORE_USERS_RECEIVED, { src: store.id });
            }

            function resolvePromise(userId: string, result: User | null) {
                pendingUserPromises.delete(userId);
                pendingUserRequests.delete(userId);
                // callback the pending promises
                const cb = pendingUserResolvers.get(userId);
                if (cb) {
                    cb(result); // resolve the pending promise for this user
                    pendingUserResolvers.delete(userId);
                }
            }
        }
    });
}

// User store singleton
export const userStore = createUserStore();
