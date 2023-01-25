import { render } from 'preact';

async function main() {
    render(<div>
        Hello World
    </div>, document.getElementById('main')!);
}

main();
