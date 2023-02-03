
DevTools UI will be composed of 3 main views
- Store View
- Renderer View (Stores with renderers)
- Log View

## Store View

- Shows list of stores, sub stores and processors / sub-processors
- Allow to explore the store data from the root data object (tree)
    - Allow to know if a property is computed and by which processor -> link to see the processor
    - Allow to know which processors use a given property -> link to see the processor
- Allow to explore processors
    - When they were run last
    - List of dependencies -> link to see the object
    - List of computed properties








## Use Cases

- view store data
- determine why a view is not refreshed
    - identify the renderer
    - identify the renderer dependencies -> identify the data object
    - identify the processor that computed the value
        - identify the processor dependencies, follow the processor chain
- determine components that were refreshed after a given action -> logs
- determine components that were disposed after a given action -> logs
- determine what triggered a compute -> logs
- determine what changed and when -> logs


