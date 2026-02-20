import { useState, useEffect } from 'react';
import { loadAppState } from '../../utils/migration';
import { importBoards } from '../../api/boards';

interface Props {
  onImported: () => Promise<void>;
}

export function ImportBanner({ onImported }: Props) {
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    // Check for localStorage data
    const localData = loadAppState();
    if (localData && localData.boards.length > 0) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      const localData = loadAppState();
      if (!localData) return;

      await importBoards(localData.boards);

      // Clear localStorage on success
      localStorage.removeItem('personal-kanban-app');
      localStorage.removeItem('personal-kanban-board');

      setShow(false);
      await onImported();
    } catch {
      // Import may fail if user already has boards
      setShow(false);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="import-banner">
      <span>We found existing boards in your browser. Import them to your account?</span>
      <button
        className="import-banner__btn"
        onClick={handleImport}
        disabled={importing}
      >
        {importing ? 'Importing...' : 'Import Boards'}
      </button>
      <button
        className="import-banner__dismiss"
        onClick={() => setShow(false)}
      >
        ×
      </button>
    </div>
  );
}
