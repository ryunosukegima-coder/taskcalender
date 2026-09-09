import { useState } from "react";
import { useCategoryOptions } from "../../hooks/useTasks";
import { MAX_CATEGORY_LENGTH } from "../../lib/validation";

const NEW_CATEGORY_OPTION = "__new__";

interface Props {
  id?: string;
  value: string; // "" = 未分類
  onChange: (value: string) => void;
  className?: string;
}

// Existing categories are offered as a dropdown so adding/editing a task
// never requires retyping a category name; "+ 新しいカテゴリー" reveals a
// plain text field for the rare case of introducing a brand new one.
export default function CategorySelect({ id, value, onChange, className }: Props) {
  const options = useCategoryOptions();
  const [showNewInput, setShowNewInput] = useState(value !== "" && !options.includes(value));

  if (showNewInput) {
    return (
      <div className="category-select-new">
        <input
          id={id}
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_CATEGORY_LENGTH}
          placeholder="新しいカテゴリー名"
          className={className}
        />
        <button
          type="button"
          className="category-select-cancel"
          onClick={() => {
            setShowNewInput(false);
            onChange("");
          }}
          aria-label="新しいカテゴリーの入力をやめる"
          title="やめる"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      className={className}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY_OPTION) {
          setShowNewInput(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="">未分類</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={NEW_CATEGORY_OPTION}>+ 新しいカテゴリー...</option>
    </select>
  );
}
