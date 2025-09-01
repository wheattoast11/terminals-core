/**
 * React integration example: Todo app with time travel
 */

import React, { useState } from 'react'
import { createEventStoreHook, BaseEvent } from '../src'

// Event types with proper extension
interface AddTodoEvent extends BaseEvent {
  type: 'add-todo'
  payload: { id: string; text: string }
}

interface ToggleTodoEvent extends BaseEvent {
  type: 'toggle-todo'
  payload: { id: string }
}

interface DeleteTodoEvent extends BaseEvent {
  type: 'delete-todo'
  payload: { id: string }
}

interface EditTodoEvent extends BaseEvent {
  type: 'edit-todo'
  payload: { id: string; text: string }
}

type Event = AddTodoEvent | ToggleTodoEvent | DeleteTodoEvent | EditTodoEvent

// State
interface Todo {
  id: string
  text: string
  completed: boolean
}

interface State {
  todos: Todo[]
}

// Reducer
const reducer = (state: State, event: Event): State => {
  switch (event.type) {
    case 'add-todo':
      return {
        todos: [...state.todos, {
          id: event.payload.id,
          text: event.payload.text,
          completed: false
        }]
      }
    
    case 'toggle-todo':
      return {
        todos: state.todos.map(todo =>
          todo.id === event.payload.id
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      }
    
    case 'delete-todo':
      return {
        todos: state.todos.filter(todo => todo.id !== event.payload.id)
      }
    
    case 'edit-todo':
      return {
        todos: state.todos.map(todo =>
          todo.id === event.payload.id
            ? { ...todo, text: event.payload.text }
            : todo
        )
      }
    
    default:
      return state
  }
}

// Create store hook
const useTodoStore = createEventStoreHook<Event, State>(
  { todos: [] },
  reducer,
  { enableCheckpoints: true, checkpointInterval: 10 }
)

// App component
export function TodoApp() {
  const { state, dispatch, undo, redo, canUndo, canRedo, events, save, load } = useTodoStore()
  const [input, setInput] = useState('')

  const addTodo = () => {
    if (input.trim()) {
      dispatch({
        type: 'add-todo',
        payload: {
          id: `todo-${Date.now()}`,
          text: input.trim()
        }
      })
      setInput('')
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Todo App with Time Travel</h1>
      
      {/* Add todo */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Add a todo..."
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add
        </button>
      </div>

      {/* Time travel controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          ← Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Redo →
        </button>
        <span className="px-3 py-1 text-gray-600">
          {events.length} events
        </span>
        <button
          onClick={save}
          className="px-3 py-1 bg-green-200 rounded"
        >
          Save
        </button>
        <button
          onClick={load}
          className="px-3 py-1 bg-yellow-200 rounded"
        >
          Load
        </button>
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {state.todos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => dispatch({
                type: 'toggle-todo',
                payload: { id: todo.id }
              })}
            />
            <span className={todo.completed ? 'line-through' : ''}>
              {todo.text}
            </span>
            <button
              onClick={() => dispatch({
                type: 'delete-todo',
                payload: { id: todo.id }
              })}
              className="ml-auto text-red-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Event log */}
      <details className="mt-8">
        <summary className="cursor-pointer text-gray-600">Event Log</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">
          {JSON.stringify(events, null, 2)}
        </pre>
      </details>
    </div>
  )
}