import { render } from 'preact';
import { TodoList } from './todolist';

async function main() {
    render(<div>
        <TodoList/>
    </div>, document.getElementById('main')!);
}

main();
