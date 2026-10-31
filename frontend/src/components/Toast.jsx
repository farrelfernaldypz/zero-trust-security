import Icon from './Icon.jsx';

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === 'error';

  return (
    <div className={`toast toast-${isError ? 'error' : 'success'}`} role="status" aria-live="polite">
      <span className="toast-mark"><Icon name={isError ? 'close' : 'check'} size={17} /></span>
      <span className="toast-copy">
        <strong>{isError ? 'Perlu diperiksa' : 'Berhasil'}</strong>
        <span>{toast.message}</span>
      </span>
      <button className="icon-button toast-dismiss" onClick={onDismiss} aria-label="Tutup notifikasi" type="button">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
