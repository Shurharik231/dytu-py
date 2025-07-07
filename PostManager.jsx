import React, { useState, useEffect } from 'react';

/**
 * Панель настройки постов:
 *  – редактирование списка постов (добавить/удалить/переименовать)
 *  – выбор, какие подразделения могут быть на каждом посту
 */
export default function PostManager({
  posts = [],
  units = [],
  allowedPerPost = {},
  onAllowedChange,
  onPostsChange
}) {
  // Локальная копия для редактирования
  const [localPosts, setLocalPosts] = useState(posts);

  // синхронизируем при внешнем изменении
  useEffect(() => setLocalPosts(posts), [posts]);

  // Добавить новый пустой пост
  const addPost = () => {
    const next = [...localPosts, 'Новый пост'];
    setLocalPosts(next);
    onPostsChange(next);
  };

  // Переименовать пост по индексу
  const renamePost = (idx, newName) => {
    const next = [...localPosts];
    next[idx] = newName;
    setLocalPosts(next);
    onPostsChange(next);
  };

  // Удалить пост
  const removePost = idx => {
    const next = localPosts.filter((_, i) => i !== idx);
    setLocalPosts(next);
    onPostsChange(next);
    // и очистить allowedPerPost для убранного
    const ap = { ...allowedPerPost };
    delete ap[posts[idx]];
    onAllowedChange(ap);
  };

  // Переключить подразделение в allowedPerPost
  const toggleUnit = (post, unit) => {
    const prev = allowedPerPost[post] || [];
    const next = prev.includes(unit)
      ? prev.filter(u => u !== unit)
      : [...prev, unit];
    onAllowedChange({ ...allowedPerPost, [post]: next });
  };

  return (
    <div style={{
      flex: '0 1 250px',
      border: '1px solid #ccc',
      padding: 12,
      overflowY: 'auto',
      maxHeight: '100%'
    }}>
      <h3>Посты и подразделения</h3>

      {/* Редактор постов */}
      <div style={{ marginBottom: 16 }}>
        <strong>Список постов:</strong>
        {localPosts.map((p, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <input
              type="text"
              value={p}
              onChange={e => renamePost(idx, e.target.value)}
              style={{ flex: 1, marginRight: 8 }}
            />
            <button onClick={() => removePost(idx)}>×</button>
          </div>
        ))}
        <button onClick={addPost} style={{ marginTop: 8 }}>+ Добавить пост</button>
      </div>

      {/* Разрешённые подразделения */}
      <div>
        <strong>Кто может стоять на постах:</strong>
        {localPosts.map(post => (
          <div key={post} style={{ marginTop: 12 }}>
            <em>{post}</em>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {units.map(unit => (
                <label key={unit} style={{ cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={(allowedPerPost[post] || []).includes(unit)}
                    onChange={() => toggleUnit(post, unit)}
                  />{' '}
                  {unit}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
);
}
