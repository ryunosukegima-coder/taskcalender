interface Props {
  title: string;
  onRename: () => void;
  onCreateAnyway: () => void;
  busy?: boolean;
}

export default function DuplicateTitleDialog({ title, onRename, onCreateAnyway, busy }: Props) {
  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <h2>同じ名前のタスクがあります</h2>
        <p>
          「{title}」という名前のタスクはすでに存在します。区別できるように名前を変更することをおすすめします。
        </p>
        <div className="dialog-actions">
          <button type="button" className="button button--primary" onClick={onRename} disabled={busy}>
            名前を変更する
          </button>
          <button type="button" className="button" onClick={onCreateAnyway} disabled={busy}>
            このまま作成する
          </button>
        </div>
      </div>
    </div>
  );
}
