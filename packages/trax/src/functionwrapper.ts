import { ProcessingContext } from "./types";

type SyncFunction = (...args: any[]) => any;
type AsyncGenFunction = (...args: any[]) => Generator<Promise<any>, void, any>;

function noop() { }

/**
 * Wrap sync and generator-based async functions to produce an event stream processing context 
 * @param fn the function to wrap
 * @param startProcessingContext a function that should start and return the processing context
 * @param error a function that will be called when errors must be raised
 * @param onProcessStart [optional] a callback called a the beginning of each processing step. Will stop the processing if it return false
 * @param onProcessEnd [optional] a callback called at the end of each processing step
 * @returns 
 */
export function wrapFunction<F extends SyncFunction | AsyncGenFunction>(
    fn: F,
    startProcessingContext: () => ProcessingContext,
    error: (msg: any) => void,
    onProcessStart: () => false | void = noop,
    onProcessEnd = noop,
): ReturnType<F> extends Generator ? (...args: Parameters<F>) => Promise<any> : (...args: Parameters<F>) => ReturnType<F> {
    /** processing context associated to the wrapped function */
    let processingContext: ProcessingContext | null = null;
    /** Generator returned by the wrapped function in case of async functions */
    let generator: Generator<Promise<any>, void, any> | undefined;

    let generatorPromise: Promise<any> | undefined = undefined;
    let genPromiseResolve: ((v: any) => void) | undefined;
    let genPromiseReject: ((v: any) => void) | undefined;

    return (...args: any[]) => {
        onProcessStart();
        processingContext = startProcessingContext();

        let itr: IteratorResult<Promise<any>, void> | undefined;
        let done = true;
        generator = undefined;
        let v: any = undefined;
        try {
            // compute will indirectly call registerDependency() through proxy getters
            v = fn(...args);
            if (!!v && v.next && typeof v.next === "function") {
                generator = v;
                // get the first iterator value
                itr = v.next();
                done = !!itr!.done;
            } else if (!!v && typeof v === "object" && typeof v.then === "function" && typeof v.catch === "function") {
                // catch promise errors
                v.catch((err: any) => {
                    error(err);
                });
            }
        } catch (ex) {
            error(ex);
        }
        onProcessEnd();

        if (done) {
            processingContext.end();
            processingContext = null;
        } else {
            processingContext.pause();
            processIteratorPromise(itr, generator!);
        }

        if (generator !== undefined) {
            if (generatorPromise) {
                if (genPromiseReject) {
                    genPromiseReject("Processing Cancelled");
                }
            }
            generatorPromise = genPromiseResolve = genPromiseReject = undefined;
            if (done) {
                return Promise.resolve(v);
            } else {
                // we create a promise that will resolve when the generator is done
                generatorPromise = new Promise((resolve, reject) => {
                    genPromiseResolve = resolve;
                    genPromiseReject = reject;
                });
            }
            return generatorPromise;
        }

        return v as any;
    }

    function processIteratorPromise(itr: IteratorResult<Promise<any>, void> | undefined, g: Generator<Promise<any>>) {
        if (itr && !itr.done) {
            const yieldValue = itr.value;
            const logError = (err: any) => {
                error(err);
            }

            if (!!yieldValue && (yieldValue as any).then) {
                // yield returned a promise
                yieldValue.then((v) => {
                    computeNext(v, g);
                }).catch(logError);
            } else {
                // yield did not return a promise - let's create one
                Promise.resolve().then(() => {
                    computeNext(yieldValue, g);
                }).catch(logError);
            }
        }
    }

    function computeNext(nextValue: any, g: Generator<Promise<any>, void, any>) {
        if (g !== generator || !processingContext) return;
        // note: g !==generator when compute() was called before the previous generator processing ended

        if (onProcessStart() === false) {
            resetGenPromise();
            return; // caller is disposed
        }
        processingContext.resume();

        let itr: IteratorResult<Promise<any>, void> | undefined;
        let done = true;

        try {
            // compute will indirectly call registerDependency() through proxy getters
            itr = g.next(nextValue);
            done = !!itr.done;
        } catch (ex) {
            error(ex);
            done = true;
            if (genPromiseReject) {
                genPromiseReject(ex);
            }
            resetGenPromise();
        }

        onProcessEnd();
        if (done) {
            processingContext.end();
            if (genPromiseResolve) {
                genPromiseResolve(itr!.value);
            }
        } else {
            processingContext.pause();
            processIteratorPromise(itr, g);
        }
    }

    function resetGenPromise() {
        genPromiseResolve = genPromiseReject = undefined;
    }
}


