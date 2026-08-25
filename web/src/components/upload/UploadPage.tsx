import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useResultsContext } from '../../data/ResultsContext';

export function UploadPage() {
  const { t } = useLang();
  const { uploadFile, error } = useResultsContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    void uploadFile(file);
  }, [uploadFile]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  return (
    <div className="upload-screen">
      <div className="upload-title">{t('uploadTitle')}</div>
      <div className="upload-subtitle">{t('uploadSubtitle')}</div>
      <div
        className={`upload-dropzone${dragActive ? ' drag-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <button className="btn-primary" onClick={() => inputRef.current?.click()}>
          {t('uploadButton')}
        </button>
        <span className="upload-drop-hint">{t('uploadDropHint')}</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <div className="upload-error">{t('uploadError')}: {error}</div>}
    </div>
  );
}
