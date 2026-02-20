import { useNavigate } from 'react-router-dom';

interface Props {
  message: string;
  action?: { label: string; href: string };
  onDismiss: () => void;
}

export function Toast({ message, action, onDismiss }: Props) {
  const navigate = useNavigate();

  return (
    <div className="toast">
      <span className="toast__message">{message}</span>
      {action && (
        <button
          className="toast__action"
          onClick={() => {
            navigate(action.href);
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
      <button className="toast__dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
