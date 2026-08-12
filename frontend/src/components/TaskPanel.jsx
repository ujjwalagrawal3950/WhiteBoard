import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useSelector } from 'react-redux';
import { v4 as uuid } from 'uuid';

export default function TaskPanel({ isOpen, onClose, boardId }) {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const inputRef = useRef(null);
  const socketRef = useSocket();
  const { user } = useSelector(s => s.auth);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onTaskSync = ({ tasks: remoteTasks }) => setTasks(remoteTasks);
    socket.on('task-sync', onTaskSync);
    return () => socket.off('task-sync', onTaskSync);
  }, [socketRef]);

  const emitTasks = useCallback((updatedTasks) => {
    const socket = socketRef?.current;
    if (socket && boardId) socket.emit('task-update', { boardId, tasks: updatedTasks });
  }, [socketRef, boardId]);

  const handleAddTask = () => {
    const text = inputValue.trim();
    if (!text) return;
    const newTask = { id: uuid(), text, completed: false, createdBy: user?.name || 'Anonymous', createdAt: Date.now() };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    emitTasks(updated);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTask();
    if (e.key === 'Escape') onClose();
  };

  const handleToggleComplete = (taskId) => {
    setCompletingId(taskId);
    setTimeout(() => {
      setCompletingId(null);
      const updated = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
      setTasks(updated);
      emitTasks(updated);
    }, 300);
  };

  const handleDelete = (taskId) => {
    setRemovingId(taskId);
    setTimeout(() => {
      setRemovingId(null);
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      emitTasks(updated);
    }, 350);
  };

  const handleStartEdit = (task) => { setEditingId(task.id); setEditValue(task.text); };

  const handleSaveEdit = (taskId) => {
    const text = editValue.trim();
    if (!text) return;
    const updated = tasks.map(t => t.id === taskId ? { ...t, text } : t);
    setTasks(updated);
    emitTasks(updated);
    setEditingId(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e, taskId) => {
    if (e.key === 'Enter') handleSaveEdit(taskId);
    if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
  };

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  return (
    <div className={	ask-panel }>
      <div className="task-panel-header">
        <div className="task-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="5" width="6" height="6" rx="1"/>
            <path d="M3 17h6"/><path d="M12 7h9"/><path d="M12 12h9"/><path d="M12 17h9"/>
            <polyline points="7 8 8 9 10 7"/>
          </svg>
          Tasks
          {tasks.length > 0 && <span className="task-badge">{tasks.length}</span>}
        </div>
        <button className="task-panel-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="task-input-area">
        <input
          ref={inputRef}
          className="task-input"
          placeholder="Add a task..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="task-add-btn" onClick={handleAddTask} disabled={!inputValue.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="task-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3">
              <rect x="3" y="5" width="6" height="6" rx="1"/>
              <path d="M3 17h6"/><path d="M12 7h9"/><path d="M12 12h9"/><path d="M12 17h9"/>
            </svg>
            <p>No tasks yet. Add one above!</p>
          </div>
        ) : (
          <>
            {pending.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                isRemoving={removingId === task.id}
                isCompleting={completingId === task.id}
                isEditing={editingId === task.id}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onToggle={() => handleToggleComplete(task.id)}
                onDelete={() => handleDelete(task.id)}
                onStartEdit={() => handleStartEdit(task)}
                onSaveEdit={() => handleSaveEdit(task.id)}
                onEditKeyDown={(e) => handleEditKeyDown(e, task.id)}
              />
            ))}
            {completed.length > 0 && (
              <>
                <div className="task-section-divider"><span>Completed ({completed.length})</span></div>
                {completed.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isRemoving={removingId === task.id}
                    isCompleting={completingId === task.id}
                    isEditing={editingId === task.id}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onToggle={() => handleToggleComplete(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onStartEdit={() => handleStartEdit(task)}
                    onSaveEdit={() => handleSaveEdit(task.id)}
                    onEditKeyDown={(e) => handleEditKeyDown(e, task.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TaskItem({ task, isRemoving, isCompleting, isEditing, editValue, onEditValueChange, onToggle, onDelete, onStartEdit, onSaveEdit, onEditKeyDown }) {
  return (
    <div className={	ask-item   }>
      <button className={	ask-check } onClick={onToggle}>
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>
      <div className="task-content">
        {isEditing ? (
          <input className="task-edit-input" value={editValue} onChange={e => onEditValueChange(e.target.value)} onKeyDown={onEditKeyDown} onBlur={onSaveEdit} autoFocus />
        ) : (
          <span className="task-text" onDoubleClick={onStartEdit}>{task.text}</span>
        )}
        <span className="task-author">{task.createdBy}</span>
      </div>
      <div className="task-actions">
        {!isEditing && (
          <button className="task-action-btn" onClick={onStartEdit} title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </button>
        )}
        <button className="task-action-btn task-delete-btn" onClick={onDelete} title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
