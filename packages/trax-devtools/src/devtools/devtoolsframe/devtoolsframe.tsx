import { loadClientProxy } from '../proxy/clientProxy';
import { MutableRef, useEffect, useRef } from 'preact/hooks';
import './devtoolsframe.css';
import '/src/devtools/proxy/clientProxy';

/** Load the devtools in an iframe (test environment) */
export function DevToolsFrame(props: { panelSrc: string, theme: "dark" | "default" }) {
    const { panelSrc, theme } = props;
    const frameRef: MutableRef<HTMLIFrameElement | null> = useRef(null);

    useEffect(() => {
        loadClientProxy(frameRef.current?.contentWindow || undefined);
    }, []);

    let url = panelSrc;
    if (theme === "dark") {
        url += '?theme=dark&mode=iframe';
    } else {
        url += '?mode=iframe';
    }

    return <iframe className="trax-devtools-frame" ref={frameRef} src={url} />
}

