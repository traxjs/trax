import { TodoData, TodoFilter } from "../todostore";

const dataSnapshot: TodoData = {
    newEntry: "",
    todos: [{                       // internal todo list (not directly rendered)
        description: "look at trax examples",
        completed: true,
    }, {
        description: "understand reactivity",
        completed: false,
    }, {
        description: "play with trax",
        completed: false,
    }
    ],
    filteredTodos: [                // computed object (from .todos[] and .filter)
        {
            description: "understand reactivity",
            completed: false,
        }, {
            description: "play with trax",
            completed: false,
        }
    ],
    filter: TodoFilter.ACTIVE,
    nbrOfCompletedTodos: 1,         // computed value (from .todos[])
    itemsLeft: 2                    // computed value (from .todos[])
}


